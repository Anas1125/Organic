"""Online payment endpoints (Razorpay)."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import schemas as s
from app.core.config import settings
from app.core.deps import require_buyer
from app.db import get_db
from app.models import User
from app.services import payments
from app.services import razorpay as rzp

logger = logging.getLogger("terralens")
router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/config")
def config():
    """Tells the checkout page which payment options to show."""
    return {
        "online_enabled": rzp.enabled(),
        "key_id": settings.razorpay_key_id if rzp.enabled() else None,
        "payment_window_minutes": settings.payment_window_minutes,
    }


@router.post("/checkout/{ref}/start", response_model=s.PaymentStartOut)
def start(ref: str, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    """Open (or re-open, to retry) the Razorpay payment for an unpaid checkout."""
    return payments.start_payment(db, buyer, ref)


@router.post("/verify", response_model=s.Message)
def verify(body: s.PaymentVerifyIn, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    """Called by the browser after Razorpay reports success. The signature proves the
    details came from Razorpay; the payment is then double-checked with Razorpay."""
    if not rzp.valid_payment_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment could not be verified")
    payment = payments.confirm_paid(db, body.razorpay_order_id, body.razorpay_payment_id)
    if payment.buyer_id != buyer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    return s.Message(detail="Payment successful")


@router.post("/failed", response_model=s.Message)
def failed(body: s.PaymentFailedIn, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    payment = payments.record_failure(db, body.razorpay_order_id, body.reason)
    if not payment or payment.buyer_id != buyer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found")
    return s.Message(detail="Payment failure recorded")


@router.post("/checkout/{ref}/cancel", response_model=s.Message)
def cancel(ref: str, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    """Give up on paying: orders are cancelled and the items go back in the cart."""
    if not payments.cancel_unpaid(db, ref, buyer=buyer, why="Cancelled before payment"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nothing to cancel")
    return s.Message(detail="Order cancelled — the items are back in your cart")


@router.post("/razorpay/webhook", include_in_schema=False)
async def webhook(request: Request, db: Session = Depends(get_db)):
    """Razorpay → us. Catches payments even if the buyer closed the browser, and refund results.
    Set this URL and RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard."""
    body = await request.body()
    if not rzp.valid_webhook_signature(body, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bad signature")
    event = json.loads(body)
    kind = event.get("event", "")
    ent = event.get("payload", {})
    try:
        if kind in ("payment.captured", "order.paid"):
            p = ent["payment"]["entity"]
            payments.confirm_paid(db, p["order_id"], p["id"])
        elif kind == "payment.failed":
            p = ent["payment"]["entity"]
            payments.record_failure(db, p["order_id"], p.get("error_description"))
        elif kind == "refund.processed":
            payments.refund_settled(db, ent["refund"]["entity"]["id"], ok=True)
        elif kind == "refund.failed":
            payments.refund_settled(db, ent["refund"]["entity"]["id"], ok=False)
    except HTTPException as e:
        # Unknown order etc. Answer 200 so Razorpay doesn't keep retrying something we can't use.
        logger.warning("Razorpay webhook %s ignored: %s", kind, e.detail)
    return {"ok": True}
