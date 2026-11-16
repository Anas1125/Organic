"""Online payments with Razorpay: start, confirm, failure, expiry and refunds.

Life of an online checkout:
  1. Checkout creates the orders as "awaiting_payment" and holds the stock.
  2. start_payment() creates a Razorpay order; the buyer pays in Razorpay's window.
  3. confirm_paid() (from the browser, and again from the webhook) checks the payment
     with Razorpay and moves the orders to "pending" for the sellers. Safe to repeat.
  4. A failed attempt is recorded; the buyer can retry or cancel.
  5. Unpaid checkouts are cancelled after PAYMENT_WINDOW_MINUTES and the stock released.
  6. Cancelling a paid order refunds that order's amount through Razorpay.
"""

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import CartItem, Order, Payment, Product, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.services import notify
from app.services import razorpay as rzp

logger = logging.getLogger("terralens")


def _orders(db: Session, ref: str, *, lock: bool = False) -> list[Order]:
    stmt = (
        select(Order)
        .where(Order.checkout_ref == ref)
        .options(selectinload(Order.items), selectinload(Order.seller), selectinload(Order.buyer))
        .order_by(Order.id)
    )
    if lock:
        stmt = stmt.with_for_update(of=Order)
    return list(db.scalars(stmt))


def start_payment(db: Session, buyer: User, ref: str) -> dict:
    """Razorpay order for an unpaid checkout. Re-uses the open one when retrying."""
    expire_stale(db)
    orders = [o for o in _orders(db, ref) if o.buyer_id == buyer.id]
    unpaid = [o for o in orders if o.status == OrderStatus.AWAITING_PAYMENT]
    if not orders:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    if not unpaid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "These orders don't need payment any more")
    amount = sum((o.total for o in unpaid), Decimal(0))

    payment = db.scalar(
        select(Payment).where(Payment.checkout_ref == ref, Payment.status.in_(("created", "failed")))
        .order_by(Payment.id.desc())
    )
    if not payment or payment.amount != amount:
        rp = rzp.create_order(amount, receipt=ref, notes={"checkout_ref": ref})
        payment = Payment(checkout_ref=ref, buyer_id=buyer.id, amount=amount, razorpay_order_id=rp["id"])
        db.add(payment)
        db.commit()
    return {
        "key_id": settings.razorpay_key_id,
        "razorpay_order_id": payment.razorpay_order_id,
        "amount": rzp.paise(amount),
        "currency": "INR",
        "checkout_ref": ref,
        "order_numbers": [o.order_number for o in unpaid],
        "name": buyer.full_name,
        "email": buyer.email,
        "contact": unpaid[0].shipping_phone,
        "expires_at": (unpaid[0].created_at + timedelta(minutes=settings.payment_window_minutes)).isoformat(),
    }


def confirm_paid(db: Session, razorpay_order_id: str, razorpay_payment_id: str) -> Payment:
    """Check the payment with Razorpay and mark the checkout paid. Idempotent."""
    payment = db.scalar(
        select(Payment).where(Payment.razorpay_order_id == razorpay_order_id).with_for_update()
    )
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    if payment.status == "paid":
        return payment

    info = rzp.fetch_payment(razorpay_payment_id)
    if info.get("order_id") != razorpay_order_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment does not match this order")
    if info.get("status") == "authorized":
        info = rzp.capture(razorpay_payment_id, info["amount"])
    if info.get("status") != "captured":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment has not completed yet")

    payment.status = "paid"
    payment.razorpay_payment_id = razorpay_payment_id
    payment.method = info.get("method")
    payment.error = None

    orders = _orders(db, payment.checkout_ref, lock=True)
    late = []  # paid after the orders were cancelled/expired → refund
    for o in orders:
        if o.status == OrderStatus.AWAITING_PAYMENT:
            o.status = OrderStatus.PENDING
            o.payment_status = PaymentStatus.PAID
        elif o.status == OrderStatus.CANCELLED and o.payment_status == PaymentStatus.PENDING:
            o.payment_status = PaymentStatus.PAID
            late.append(o)
    db.commit()

    for o in late:
        refund_order(db, o, reason="Payment arrived after the order was cancelled")
    paid = [o for o in orders if o.status == OrderStatus.PENDING]
    if paid:
        notify.payment_received(paid, payment)
    return payment


def record_failure(db: Session, razorpay_order_id: str, reason: str | None) -> Payment | None:
    payment = db.scalar(select(Payment).where(Payment.razorpay_order_id == razorpay_order_id))
    if not payment or payment.status == "paid":
        return payment
    first_failure = payment.status != "failed"
    payment.status = "failed"
    payment.error = (reason or "Payment failed")[:300]
    db.commit()
    if first_failure:
        orders = [o for o in _orders(db, payment.checkout_ref) if o.status == OrderStatus.AWAITING_PAYMENT]
        if orders:
            notify.payment_failed(orders, payment.error)
    return payment


def _release(db: Session, order: Order) -> None:
    ids = [i.product_id for i in order.items if i.product_id]
    for p in db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update()):
        for i in order.items:
            if i.product_id == p.id:
                p.stock += i.quantity


def cancel_unpaid(db: Session, ref: str, *, buyer: User | None, why: str) -> list[Order]:
    """Cancel a checkout that was never paid, release the stock and (for the buyer)
    put the items back in their cart so they can try again."""
    orders = [o for o in _orders(db, ref, lock=True) if o.status == OrderStatus.AWAITING_PAYMENT]
    if buyer:
        orders = [o for o in orders if o.buyer_id == buyer.id]
    for o in orders:
        _release(db, o)
        o.status = OrderStatus.CANCELLED
        o.payment_status = PaymentStatus.PENDING
        o.notes = ((o.notes + " · ") if o.notes else "") + why
        if buyer:
            for i in o.items:
                if i.product_id and not db.scalar(
                    select(CartItem).where(CartItem.buyer_id == buyer.id, CartItem.product_id == i.product_id)
                ):
                    db.add(CartItem(buyer_id=buyer.id, product_id=i.product_id, quantity=i.quantity))
    for p in db.scalars(select(Payment).where(Payment.checkout_ref == ref, Payment.status.in_(("created", "failed")))):
        p.status = "cancelled" if buyer else "expired"
    db.commit()
    return orders


def expire_stale(db: Session) -> None:
    """Cancel online checkouts left unpaid for too long. Called whenever orders are listed,
    so no scheduled job is needed. Asks Razorpay first, in case the payment did go through."""
    cutoff = datetime.now(UTC) - timedelta(minutes=settings.payment_window_minutes)
    refs = set(db.scalars(
        select(Order.checkout_ref).where(
            Order.status == OrderStatus.AWAITING_PAYMENT, Order.created_at < cutoff
        )
    ))
    for ref in refs:
        try:
            if rzp.enabled():
                for p in db.scalars(select(Payment).where(Payment.checkout_ref == ref)):
                    captured = [x for x in rzp.order_payments(p.razorpay_order_id) if x.get("status") in ("captured", "authorized")]
                    if captured:
                        confirm_paid(db, p.razorpay_order_id, captured[0]["id"])
                        break
                else:
                    cancel_unpaid(db, ref, buyer=None, why="Not paid in time")
            else:
                cancel_unpaid(db, ref, buyer=None, why="Not paid in time")
        except HTTPException:
            db.rollback()
            logger.warning("Could not check payment for checkout %s; will retry later", ref)


def refund_order(db: Session, order: Order, *, reason: str) -> Order:
    """Refund one paid online order in full. Several orders can share one payment,
    so each is refunded for its own amount."""
    if order.payment_method != PaymentMethod.ONLINE or order.payment_status not in (
        PaymentStatus.PAID, PaymentStatus.REFUND_FAILED,
    ):
        return order
    payment = db.scalar(
        select(Payment).where(Payment.checkout_ref == order.checkout_ref, Payment.status == "paid")
    )
    if not payment or not payment.razorpay_payment_id:
        return _refund_failed(db, order, "No completed Razorpay payment was found for this order")
    try:
        r = rzp.refund(payment.razorpay_payment_id, order.total, notes={"order": order.order_number, "reason": reason[:200]})
    except HTTPException as e:
        return _refund_failed(db, order, f"Razorpay: {e.detail}")
    order.refund_id = r.get("id")
    order.refund_error = None
    if r.get("status") == "processed":
        order.payment_status = PaymentStatus.REFUNDED
        order.refunded_at = datetime.now(UTC)
    else:
        order.payment_status = PaymentStatus.REFUND_PENDING
    db.commit()
    notify.refund_started(order)
    return order


def _refund_failed(db: Session, order: Order, why: str) -> Order:
    logger.error("Refund failed for %s: %s", order.order_number, why)
    order.payment_status = PaymentStatus.REFUND_FAILED
    order.refund_error = why[:300]
    db.commit()
    return order


def refund_settled(db: Session, refund_id: str, ok: bool) -> None:
    order = db.scalar(select(Order).where(Order.refund_id == refund_id).options(selectinload(Order.buyer)))
    if not order or order.payment_status == PaymentStatus.REFUNDED:
        return
    order.payment_status = PaymentStatus.REFUNDED if ok else PaymentStatus.REFUND_FAILED
    if ok:
        order.refunded_at = datetime.now(UTC)
    db.commit()
    if ok:
        notify.refund_done(order)
