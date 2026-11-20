import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import schemas as s
from app.core.config import settings
from app.models import CartItem, Order, OrderItem, Product, SiteSettings, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus, Role
from app.services import notify, payments
from app.services import razorpay as rzp
from app.services.pricing import check_quantity, unit_price_for
from app.services.queries import visible_products

# Which statuses a seller may move an order to from each status.
SELLER_FLOW: dict[str, set[str]] = {
    OrderStatus.ENQUIRY: set(),  # only the admin approves or declines an enquiry
    OrderStatus.SELLER_REVIEW: set(),  # the seller answers with Accept / Decline instead
    OrderStatus.AWAITING_PAYMENT: set(),  # only the buyer (or the payment window) can end this
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PACKED, OrderStatus.CANCELLED},
    OrderStatus.PACKED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

ORDER_LOAD = (
    selectinload(Order.items).selectinload(OrderItem.product).selectinload(Product.images),
    selectinload(Order.seller),
    selectinload(Order.buyer),
)


def first_status() -> str:
    """Where a placed (and, for online orders, paid) order starts."""
    return OrderStatus.CONFIRMED if settings.auto_confirm_orders else OrderStatus.PENDING


def _new_order_number() -> str:
    return f"TL-{datetime.now(UTC):%y%m%d}-{secrets.token_hex(3).upper()}"


def checkout(db: Session, buyer: User, body: s.CheckoutIn) -> list[Order]:
    """Turn the buyer's cart into one order per seller. All-or-nothing."""
    cart = db.scalars(select(CartItem).where(CartItem.buyer_id == buyer.id)).all()
    if not cart:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")
    online = body.payment_method == PaymentMethod.ONLINE
    if online and not rzp.enabled():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Online payment isn't available right now. Please choose cash on delivery.")

    # Lock product rows so two buyers can't buy the same last units at once.
    product_ids = sorted(ci.product_id for ci in cart)
    products = {
        p.id: p
        for p in db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .options(selectinload(Product.price_tiers), selectinload(Product.seller))
            .with_for_update(of=Product)
        )
    }

    visible_ids = set(
        db.scalars(
            visible_products().where(Product.id.in_(product_ids)).with_only_columns(Product.id)
        )
    )

    by_seller: dict[int, list[tuple[Product, int]]] = {}
    for ci in cart:
        p = products.get(ci.product_id)
        if not p or p.id not in visible_ids:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "An item in your cart is no longer available. Please remove it and try again.",
            )
        check_quantity(p, ci.quantity)
        by_seller.setdefault(p.seller_id, []).append((p, ci.quantity))

    ref = secrets.token_hex(8)
    site = db.get(SiteSettings, 1)
    commission = site.commission_percent if site else Decimal(0)
    orders: list[Order] = []
    for seller_id, lines in by_seller.items():
        order = Order(
            order_number=_new_order_number(),
            checkout_ref=ref,
            buyer_id=buyer.id,
            seller_id=seller_id,
            status=OrderStatus.ENQUIRY,  # the admin agrees terms with the seller first
            payment_method=PaymentMethod.ONLINE if online else PaymentMethod.COD,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal(0),
            total=Decimal(0),
            commission_rate=commission or Decimal(0),
            pay_to_marketplace=True,  # online, or UPI to the marketplace on delivery
            **body.model_dump(exclude={"payment_method"}),
        )
        subtotal = Decimal(0)
        for p, qty in lines:
            price = unit_price_for(p, qty)
            line_total = (price * qty).quantize(Decimal("0.01"))
            subtotal += line_total
            order.items.append(
                OrderItem(
                    product_id=p.id,
                    product_name=p.name,
                    unit=p.unit,
                    quantity=qty,
                    unit_price=price,
                    line_total=line_total,
                )
            )
            p.stock -= qty
        order.subtotal = subtotal
        order.total = subtotal  # delivery charges / tax can be added here later
        db.add(order)
        orders.append(order)

    for ci in cart:
        db.delete(ci)
    db.commit()
    for o in orders:
        db.refresh(o)
    notify.enquiry_received(orders, _admin_emails(db))
    return orders


def _admin_emails(db: Session) -> list[str]:
    return list(db.scalars(select(User.email).where(User.role == Role.ADMIN, User.is_active.is_(True))))


def approve(db: Session, order: Order, commission: Decimal) -> Order:
    """The admin agreed terms with the seller by phone: send the seller the offer (with the
    commission) to accept. Can be sent again with a new rate while the seller hasn't accepted."""
    if order.status not in (OrderStatus.ENQUIRY, OrderStatus.SELLER_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This enquiry has already been handled")
    order.commission_rate = commission
    order.approved_at = datetime.now(UTC)
    order.status = OrderStatus.SELLER_REVIEW
    db.commit()
    db.refresh(order)
    notify.offer_to_seller(order)
    return order


def seller_accept(db: Session, order: Order) -> Order:
    """The seller agreed to the commission. Cash on delivery is confirmed now; an online
    order waits for the buyer to pay (then the seller ships it)."""
    if order.status != OrderStatus.SELLER_REVIEW:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order isn't waiting for your answer")
    order.accepted_at = datetime.now(UTC)
    order.seller_response = None
    if order.payment_method == PaymentMethod.ONLINE:
        order.status = OrderStatus.AWAITING_PAYMENT
        # Its own payment reference, so each order is paid on its own
        # (the other sellers' orders from the same checkout may be accepted later).
        order.checkout_ref = f"{order.checkout_ref[:20]}-{order.id}"
    else:
        order.status = first_status()
    db.commit()
    db.refresh(order)
    notify.enquiry_approved(order)
    notify.seller_answered(order, accepted=True, admin_emails=_admin_emails(db))
    return order


def seller_decline(db: Session, order: Order, reason: str) -> Order:
    """The seller said no to the offer: it goes back to the admin to agree new terms
    (or decline the buyer). The buyer isn't told yet."""
    if order.status != OrderStatus.SELLER_REVIEW:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order isn't waiting for your answer")
    order.status = OrderStatus.ENQUIRY
    order.approved_at = None
    order.seller_response = reason
    db.commit()
    db.refresh(order)
    notify.seller_answered(order, accepted=False, admin_emails=_admin_emails(db))
    return order


def decline(db: Session, order: Order, reason: str) -> Order:
    if order.status not in (OrderStatus.ENQUIRY, OrderStatus.SELLER_REVIEW):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This enquiry has already been handled")
    order.decline_reason = reason
    order = change_status(db, order, OrderStatus.CANCELLED, as_admin=True, notify_buyer=False)
    notify.enquiry_declined(order)
    return order


def _restock(db: Session, order: Order) -> None:
    ids = [i.product_id for i in order.items if i.product_id]
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update())
    }
    for item in order.items:
        if item.product_id in products:
            products[item.product_id].stock += item.quantity


def change_status(
    db: Session, order: Order, new_status: str, *, as_admin: bool,
    courier: str | None = None, tracking_number: str | None = None, notify_buyer: bool = True,
) -> Order:
    if new_status not in OrderStatus.__members__.values():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown order status")
    if new_status == order.status:
        return order
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cancelled orders cannot be changed")
    if not as_admin and new_status not in SELLER_FLOW[order.status]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move an order from '{order.status}' to '{new_status}'",
        )
    if order.status == OrderStatus.ENQUIRY and new_status != OrderStatus.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Approve the enquiry first")
    if order.status == OrderStatus.SELLER_REVIEW and new_status != OrderStatus.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Waiting for the seller to accept the commission")
    if order.status == OrderStatus.AWAITING_PAYMENT and new_status != OrderStatus.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This order hasn't been paid yet")
    if order.status == OrderStatus.ENQUIRY and new_status == OrderStatus.CANCELLED and not order.decline_reason:
        order.decline_reason = "Cancelled before it was confirmed"  # the seller never saw it
    refund = False
    if new_status == OrderStatus.CANCELLED:
        _restock(db, order)
        if order.payment_status == PaymentStatus.PAID:
            if order.payment_method == PaymentMethod.ONLINE:
                refund = True  # money goes back through Razorpay
            else:
                order.payment_status = PaymentStatus.REFUNDED
    now = datetime.now(UTC)
    if new_status == OrderStatus.SHIPPED:
        order.shipped_at = now
        order.courier = (courier or "").strip() or order.courier
        order.tracking_number = (tracking_number or "").strip() or order.tracking_number
    if new_status == OrderStatus.DELIVERED:
        order.delivered_at = now
        if order.payment_method == PaymentMethod.COD and not order.pay_to_marketplace:
            order.payment_status = PaymentStatus.PAID  # older orders: the seller collected the cash
    order.status = new_status
    db.commit()
    if refund:
        payments.refund_order(db, order, reason="Order cancelled")
    db.refresh(order)
    if notify_buyer:
        notify.status_changed(order)
    return order


def expire_offers(db: Session) -> int:
    """Cancel offers the seller hasn't answered within SELLER_ANSWER_HOURS."""
    cutoff = datetime.now(UTC) - timedelta(hours=settings.seller_answer_hours)
    stale = db.scalars(
        select(Order).where(Order.status == OrderStatus.SELLER_REVIEW, Order.approved_at < cutoff)
        .options(*ORDER_LOAD).limit(200)
    ).all()
    admins = _admin_emails(db) if stale else []
    for o in stale:
        o.decline_reason = "The seller didn't confirm in time"
        change_status(db, o, OrderStatus.CANCELLED, as_admin=True, notify_buyer=False)
        notify.offer_expired(o, admins)
    return len(stale)
