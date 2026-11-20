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
        + (("Pay on delivery (UPI to the marketplace)" if o.pay_to_marketplace else "Cash on delivery")
           if o.payment_method == PaymentMethod.COD
           else "Paid online" if o.payment_status == "paid" else "Online payment (UPI / card)"),
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
        [f"Hi {esc(o.seller.business_name)},", ("A buyer has placed an order with you. It's confirmed — please pack and ship it." if o.status == OrderStatus.CONFIRMED else "A buyer has placed an order with you. Please confirm it."),
         *_summary(o), f"Ship to: {ship}"],
        ("Open the order", _site("/seller/orders")),
    )


def order_placed(orders: list[Order]) -> None:
    """Cash on delivery: the order is placed (and confirmed) straight away."""
    for o in orders:
        lead = ("Your order is confirmed and the seller is getting it ready. We'll email you when it ships."
                if o.status == OrderStatus.CONFIRMED
                else "We've sent your order to the seller. You'll get an email when it's confirmed.")
        _buyer(o, f"Order placed — {o.order_number}", "Thanks for your order!", [lead])
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
    if o.status == OrderStatus.SHIPPED and (o.courier or o.tracking_number):
        lead.append(f"Courier: <b>{esc(o.courier or '—')}</b> · Tracking number: <b>{esc(o.tracking_number or '—')}</b>")
    if o.status == OrderStatus.SHIPPED and settings.auto_deliver_days > 0:
        lead.append("When it arrives, tap <b>I've received it</b> on your order page.")
    if o.status == OrderStatus.CANCELLED and o.payment_method == PaymentMethod.ONLINE and o.payment_status != "pending":
        lead.append("Your refund is being processed — we'll email you when it's done.")
    if o.status == OrderStatus.DELIVERED and o.payment_method == PaymentMethod.COD:
        if o.pay_to_marketplace and o.payment_status != "paid":
            lead.append(f"If you haven't yet, please pay {_money(o.total)} to us by UPI — "
                        "the details and QR code are on your order page.")
        elif not o.pay_to_marketplace:
            lead.append(f"Cash payment of {_money(o.total)} received.")
    if o.status == OrderStatus.SHIPPED and o.payment_method == PaymentMethod.COD and o.pay_to_marketplace:
        lead.append(f"When it arrives, pay {_money(o.total)} to us by UPI — not to the delivery person. "
                    "The details and QR code are on your order page.")
    _buyer(o, f"{heading} — {o.order_number}", heading, lead)


def refund_started(o: Order) -> None:
    _buyer(o, f"Refund started — {o.order_number}", "Refund started",
           [f"We've started a refund of {_money(o.total)} to your original payment method. "
            "It usually reaches your account in 5–7 working days."], with_summary=False)


def refund_done(o: Order) -> None:
    _buyer(o, f"Refund completed — {o.order_number}", "Refund completed",
           [f"Your refund of {_money(o.total)} for order {esc(o.order_number)} has been processed."],
           with_summary=False)


# ---------- Enquiries: every order is checked by the admin with the seller first ----------

def enquiry_received(orders: list[Order], admin_emails: list[str]) -> None:
    for o in orders:
        _buyer(o, f"Enquiry received — {o.order_number}", "We've received your enquiry",
               ["Thanks! Our team is confirming availability and terms with the seller. "
                "We'll email you as soon as it's approved"
                + (" — you'll pay online then. No money has been taken yet." if o.payment_method == PaymentMethod.ONLINE else ".")])
        b, sp = o.buyer, o.seller
        owner = sp.user if hasattr(sp, "user") else None
        details = [
            f"<b>{esc(b.full_name)}</b> wants to buy from <b>{esc(sp.business_name)}</b>.",
            *_summary(o),
            f"<b>Buyer</b>: {esc(b.full_name)} ({esc(b.buyer_type)}) · {esc(b.email)}"
            + (f" · {esc(b.phone)}" if b.phone else "")
            + f" · ships to {esc(o.shipping_city)}, {esc(o.shipping_state)}",
            f"<b>Seller</b>: {esc(sp.business_name)}"
            + (f" · {esc(owner.full_name)} · {esc(owner.email)}" if owner else "")
            + (f" · {esc(sp.phone or (owner.phone if owner else None) or '')}" if (sp.phone or (owner and owner.phone)) else ""),
            "Contact the seller to confirm stock, price and your commission, then approve or decline it.",
        ]
        for to in admin_emails:
            send_email(to, f"New enquiry {o.order_number}: {b.full_name} → {sp.business_name}",
                       "New enquiry to review", details,
                       ("Review the enquiry", _site(f"/admin/orders?status=enquiry&open={o.id}")))


def enquiry_approved(o: Order) -> None:
    if o.payment_method == PaymentMethod.ONLINE:
        _buyer(o, f"Approved — please pay for {o.order_number}", "Your enquiry is approved",
               [f"Good news — the seller can supply your order. Please pay {_money(o.total)} online "
                f"within {settings.approved_payment_hours} hours to confirm it; after that it's cancelled "
                "and the stock is released.",
                "Open your order and tap <b>Pay now</b>."])
    else:
        _buyer(o, f"Order confirmed — {o.order_number}", "Your enquiry is approved",
               ["Good news — the seller can supply your order and is getting it ready. "
                f"When it arrives, pay {_money(o.total)} to us by UPI (not to the seller or delivery person) — "
                "the details and QR code are on your order page."])


def enquiry_declined(o: Order) -> None:
    lead = ["Sorry — we couldn't arrange this order with the seller, so it has been cancelled. No money was taken."]
    if o.decline_reason:
        lead.append(f"Reason: {esc(o.decline_reason)}")
    _buyer(o, f"Enquiry declined — {o.order_number}", "We couldn't confirm your enquiry", lead)


def offer_to_seller(o: Order) -> None:
    """The admin approved an enquiry: ask the seller to accept the agreed commission."""
    user = o.seller.user if hasattr(o.seller, "user") else None
    if not user:
        return
    commission = (o.subtotal * o.commission_rate / 100).quantize(Decimal("0.01"))
    how = "online" if o.payment_method == PaymentMethod.ONLINE else "by UPI on delivery"
    you_get = (f"The buyer pays the marketplace {how} — please don't collect money from the buyer. "
               f"After delivery we pay you <b>{_money(o.total - commission)}</b> "
               f"({_money(o.total)} minus {_money(commission)} commission).")
    send_email(
        user.email, f"Please accept order {o.order_number} ({o.commission_rate.normalize():f}% commission)",
        "A new order is waiting for you",
        [f"Hi {esc(o.seller.business_name)},",
         f"A buyer in {esc(o.shipping_city)} wants to order from you. As agreed with our team, the marketplace "
         f"commission is <b>{o.commission_rate.normalize():f}%</b> ({_money(commission)}).",
         *_summary(o), you_get,
         "Please accept it if the commission is okay, or decline and tell us why. "
         "The order is only confirmed once you accept."],
        ("Accept or decline", _site(f"/seller/orders?open={o.id}")),
    )


def seller_answered(o: Order, *, accepted: bool, admin_emails: list[str]) -> None:
    if accepted:
        subject = f"{o.seller.business_name} accepted {o.order_number}"
        lines = [f"<b>{esc(o.seller.business_name)}</b> accepted order {esc(o.order_number)} at "
                 f"{o.commission_rate.normalize():f}% commission.",
                 "It's now waiting for the buyer's payment." if o.status == OrderStatus.AWAITING_PAYMENT
                 else "It's confirmed and the seller will ship it."]
    else:
        subject = f"{o.seller.business_name} declined the offer for {o.order_number}"
        lines = [f"<b>{esc(o.seller.business_name)}</b> didn't accept the commission for order {esc(o.order_number)}.",
                 f"Their reason: {esc(o.seller_response or '—')}",
                 "It's back in your Enquiries: agree new terms and approve again, or decline it for the buyer."]
    for to in admin_emails:
        send_email(to, subject, subject, lines, ("Open the order", _site(f"/admin/orders?open={o.id}")))


def offer_expired(o: Order, admin_emails: list[str]) -> None:
    _buyer(o, f"Order cancelled — {o.order_number}", "We couldn't confirm your order",
           ["Sorry — the seller didn't confirm this order in time, so it has been cancelled. "
            "No money was taken. You're welcome to order again or choose another seller."])
    user = o.seller.user if hasattr(o.seller, "user") else None
    if user:
        send_email(user.email, f"Offer expired — {o.order_number}", "This order offer has expired",
                   [f"Hi {esc(o.seller.business_name)},",
                    f"You didn't accept order {esc(o.order_number)} within {settings.seller_answer_hours} hours, "
                    "so it was cancelled and the buyer has been told."])
    for to in admin_emails:
        send_email(to, f"Offer expired: {o.seller.business_name} didn't answer {o.order_number}",
                   "Offer expired", [f"<b>{esc(o.seller.business_name)}</b> didn't answer within "
                                     f"{settings.seller_answer_hours} hours. Order {esc(o.order_number)} was cancelled "
                                     "and the buyer was told."])


def buyer_says_paid(o: Order, admin_emails: list[str]) -> None:
    for to in admin_emails:
        send_email(to, f"Buyer says they paid {o.order_number}", "Check this payment",
                   [f"<b>{esc(o.buyer.full_name)}</b> says they paid <b>{_money(o.total)}</b> for order "
                    f"{esc(o.order_number)} by UPI.",
                    f"Reference: <b>{esc(o.cod_reference or '—')}</b>",
                    "Check it in your bank / UPI app, then mark the payment as received on the order."],
                   ("Open the order", _site(f"/admin/orders?open={o.id}")))


def cod_payment_received(o: Order) -> None:
    _buyer(o, f"Payment received — {o.order_number}", "Thanks, we've received your payment",
           [f"We've received your payment of {_money(o.total)} for order {esc(o.order_number)}."],
           with_summary=False)
