"""Order emails to buyers and sellers. Every function is safe to call: failures are logged."""

from decimal import Decimal

from app.core.config import settings
from app.models import Order, Payment
from app.models.enums import OrderStatus, PaymentMethod
from app.services.mailer import esc, send_email


def _money(v: Decimal) -> str:
    return f"₹{v:,.2f}".replace(".00", "")


def _site(path: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}{path}"


def _items(o: Order) -> str:
    rows = "".join(
        f"<li>{esc(i.product_name)} — {i.quantity} {esc(i.unit)} × {_money(i.unit_price)} = <b>{_money(i.line_total)}</b></li>"
        for i in o.items
    )
    return f'<ul style="padding-left:18px;margin:0">{rows}</ul>'


def _summary(o: Order) -> list[str]:
    return [
        f"<b>Order {esc(o.order_number)}</b> from {esc(o.seller.business_name)}",
        _items(o),
        f"Total: <b>{_money(o.total)}</b> · "
        + ("Cash on delivery" if o.payment_method == PaymentMethod.COD else "Paid online"),
    ]


def _buyer(o: Order, subject: str, heading: str, lead: list[str], with_summary: bool = True) -> None:
    send_email(
        o.buyer.email, subject, heading,
        [f"Hi {esc(o.buyer.full_name)},", *lead, *(_summary(o) if with_summary else [])],
        ("View your order", _site(f"/orders/{o.id}")),
    )


def _seller(o: Order) -> None:
    user = o.seller.user if hasattr(o.seller, "user") else None
    if not user:
        return
    ship = f"{esc(o.shipping_name)}, {esc(o.shipping_city)}, {esc(o.shipping_state)} {esc(o.shipping_pincode)}"
    send_email(
        user.email, f"New order {o.order_number}", "You have a new order",
        [f"Hi {esc(o.seller.business_name)},", "A buyer has placed an order with you. Please confirm it.",
         *_summary(o), f"Ship to: {ship}"],
        ("Open the order", _site("/seller/orders")),
    )


def order_placed(orders: list[Order]) -> None:
    """Cash on delivery: the order is placed straight away."""
    for o in orders:
        _buyer(o, f"Order placed — {o.order_number}", "Thanks for your order!",
               ["We've sent your order to the seller. You'll get an email when it's confirmed."])
        _seller(o)


def payment_received(orders: list[Order], payment: Payment) -> None:
    how = f" by {payment.method.upper()}" if payment.method else ""
    for o in orders:
        _buyer(o, f"Payment received — {o.order_number}", "Payment successful",
               [f"We've received your payment of {_money(o.total)}{how}. Your order is now with the seller."])
        _seller(o)


def payment_failed(orders: list[Order], reason: str) -> None:
    o = orders[0]
    total = sum((x.total for x in orders), Decimal(0))
    send_email(
        o.buyer.email, "Payment didn't go through", "Your payment failed",
        [f"Hi {esc(o.buyer.full_name)},",
         f"Your payment of {_money(total)} didn't go through: {esc(reason)}.",
         f"No money was taken. Your items are held for {settings.payment_window_minutes} minutes — "
         "open your orders and tap <b>Pay now</b> to try again."],
        ("Try again", _site("/orders")),
    )


STATUS_TEXT = {
    OrderStatus.CONFIRMED: ("Order confirmed", "The seller has confirmed your order and is getting it ready."),
    OrderStatus.PACKED: ("Order packed", "Your order is packed and will be handed to the courier soon."),
    OrderStatus.SHIPPED: ("Out for delivery", "Your order has been shipped and is on its way to you."),
    OrderStatus.DELIVERED: ("Order delivered", "Your order has been delivered. Thank you for buying on Terralens!"),
    OrderStatus.CANCELLED: ("Order cancelled", "Your order has been cancelled."),
}


def status_changed(o: Order) -> None:
    if o.status not in STATUS_TEXT:
        return
    heading, text = STATUS_TEXT[o.status]
    lead = [text]
    if o.status == OrderStatus.CANCELLED and o.payment_method == PaymentMethod.ONLINE and o.payment_status != "pending":
        lead.append("Your refund is being processed — we'll email you when it's done.")
    if o.status == OrderStatus.DELIVERED and o.payment_method == PaymentMethod.COD:
        lead.append(f"Cash payment of {_money(o.total)} received.")
    _buyer(o, f"{heading} — {o.order_number}", heading, lead)


def refund_started(o: Order) -> None:
    _buyer(o, f"Refund started — {o.order_number}", "Refund started",
           [f"We've started a refund of {_money(o.total)} to your original payment method. "
            "It usually reaches your account in 5–7 working days."], with_summary=False)


def refund_done(o: Order) -> None:
    _buyer(o, f"Refund completed — {o.order_number}", "Refund completed",
           [f"Your refund of {_money(o.total)} for order {esc(o.order_number)} has been processed."],
           with_summary=False)
