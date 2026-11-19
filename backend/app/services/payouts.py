"""What each seller is owed, and recording payouts.

Buyers pay the platform (online) or the seller (cash on delivery). Once an order is
delivered and paid it is "open" for settlement:
  * online: the platform owes the seller the total minus commission
  * cash on delivery: the seller owes the platform the commission
An order refunded after it was settled is taken back in the next payout.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Order, Payout, SellerProfile, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.services.mailer import esc, send_email

CENT = Decimal("0.01")


@dataclass
class Line:
    order: Order
    kind: str  # "sale" or "reversal"
    commission: Decimal
    amount: Decimal  # + platform owes seller, - seller owes platform


def commission_of(o: Order) -> Decimal:
    return (o.subtotal * (o.commission_rate or 0) / 100).quantize(CENT, ROUND_HALF_UP)


def effect(o: Order) -> Decimal:
    c = commission_of(o)
    return (o.total - c) if o.payment_method == PaymentMethod.ONLINE else -c


def open_lines(db: Session, seller_id: int | None = None) -> list[Line]:
    stmt = select(Order).where(
        or_(
            # delivered and paid, not settled yet
            (Order.status == OrderStatus.DELIVERED)
            & (Order.payment_status == PaymentStatus.PAID)
            & Order.payout_id.is_(None),
            # settled, then refunded, not taken back yet
            Order.payout_id.is_not(None)
            & (Order.payment_status == PaymentStatus.REFUNDED)
            & Order.reversal_payout_id.is_(None),
        )
    ).order_by(Order.delivered_at, Order.id)
    if seller_id is not None:
        stmt = stmt.where(Order.seller_id == seller_id)
    lines = []
    for o in db.scalars(stmt):
        if o.payout_id is None:
            amount = effect(o)
            if amount:  # cash on delivery at 0% commission: no money changes hands
                lines.append(Line(o, "sale", commission_of(o), amount))
        else:
            lines.append(Line(o, "reversal", Decimal(0), -(o.payout_amount or 0)))
    return lines


def balance(lines: list[Line]) -> Decimal:
    return sum((ln.amount for ln in lines), Decimal(0)).quantize(CENT)


def settle(db: Session, seller_id: int, expected: Decimal, reference: str | None, note: str | None, admin: User) -> Payout:
    # Lock the seller so two admins can't settle the same orders twice.
    seller = db.scalar(select(SellerProfile).where(SellerProfile.id == seller_id).with_for_update())
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seller not found")
    lines = open_lines(db, seller_id)
    if not lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to settle for this seller")
    amount = balance(lines)
    if amount != Decimal(expected).quantize(CENT):
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"The amount changed to ₹{amount} (new orders came in). Please check and try again."
        )
    payout = Payout(seller_id=seller_id, amount=amount, reference=reference, note=note, created_by=admin.id)
    db.add(payout)
    db.flush()
    for ln in lines:
        if ln.kind == "sale":
            ln.order.payout_id = payout.id
            ln.order.payout_amount = ln.amount
        else:
            ln.order.reversal_payout_id = payout.id
    db.commit()
    db.refresh(payout)
    _tell_seller(seller, payout, len(lines))
    return payout


def _tell_seller(seller: SellerProfile, payout: Payout, count: int) -> None:
    if payout.amount >= 0:
        heading = f"We've sent you ₹{payout.amount}"
        first = f"A payout of <strong>₹{payout.amount}</strong> for {count} order(s) has been sent to your account."
    else:
        heading = f"₹{-payout.amount} commission received"
        first = f"We've recorded your payment of <strong>₹{-payout.amount}</strong> commission for {count} cash-on-delivery order(s)."
    paras = [first]
    if payout.reference:
        paras.append(f"Transaction reference: <strong>{esc(payout.reference)}</strong>")
    if payout.note:
        paras.append(esc(payout.note))
    paras.append("You can see every order in it under Seller hub → Payouts.")
    send_email(seller.user.email, heading, heading, paras)
