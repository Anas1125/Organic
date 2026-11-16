"""Minimal Razorpay REST client (https://razorpay.com/docs/api/).

Uses the key id + secret from settings. Amounts are in paise (₹1 = 100 paise).
"""

import hashlib
import hmac
from decimal import Decimal

import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

API = "https://api.razorpay.com/v1"
logger = logging.getLogger("terralens")


def enabled() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def paise(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1")))


def _call(method: str, path: str, **kw) -> dict:
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Online payment is not set up yet")
    try:
        r = httpx.request(
            method, f"{API}{path}",
            auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=15, **kw,
        )
    except httpx.HTTPError:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't reach the payment provider. Please try again.")
    if r.status_code >= 400:
        try:
            err = r.json()["error"]
            msg = err.get("description") or "The payment provider returned an error"
            extra = ", ".join(
                f"{k}: {err[k]}" for k in ("field", "reason", "source", "step", "code") if err.get(k) and err[k] != "NA"
            )
            if extra:
                msg = f"{msg} ({extra})"
            logger.error("Razorpay %s %s -> HTTP %s %s", method, path, r.status_code, r.text[:1000])
        except Exception:
            msg = f"The payment provider returned an error (HTTP {r.status_code})"
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, msg)
    return r.json()


def create_order(amount: Decimal, receipt: str, notes: dict | None = None) -> dict:
    return _call("POST", "/orders", json={
        "amount": paise(amount), "currency": "INR", "receipt": receipt[:40], "notes": notes or {},
    })


def fetch_order(order_id: str) -> dict:
    return _call("GET", f"/orders/{order_id}")


def order_payments(order_id: str) -> list[dict]:
    return _call("GET", f"/orders/{order_id}/payments").get("items", [])


def fetch_payment(payment_id: str) -> dict:
    return _call("GET", f"/payments/{payment_id}")


def capture(payment_id: str, amount_paise: int) -> dict:
    return _call("POST", f"/payments/{payment_id}/capture", json={"amount": amount_paise, "currency": "INR"})


def refundable(payment_id: str) -> int:
    """Paise that can still be refunded on this payment."""
    p = fetch_payment(payment_id)
    return int(p.get("amount", 0)) - int(p.get("amount_refunded", 0))


def refund(payment_id: str, amount: Decimal, notes: dict | None = None) -> dict:
    """Refund part or all of a captured payment. Only the amount is required; notes are
    sent when given, and dropped on a retry if Razorpay doesn't accept them."""
    body = {"amount": paise(amount)}
    if notes:
        try:
            return _call("POST", f"/payments/{payment_id}/refund", json={**body, "notes": notes})
        except HTTPException as e:
            if "invalid request" not in str(e.detail).lower():
                raise
    try:
        return _call("POST", f"/payments/{payment_id}/refund", json=body)
    except HTTPException as e:
        if "invalid request" not in str(e.detail).lower():
            raise
        # Full refund: Razorpay refunds the whole remaining amount when none is given.
        if refundable(payment_id) == body["amount"]:
            return _call("POST", f"/payments/{payment_id}/refund", json={})
        raise


def valid_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Checkout success handler: HMAC-SHA256 of "<order_id>|<payment_id>" with the key secret."""
    expected = hmac.new(
        (settings.razorpay_key_secret or "").encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def valid_webhook_signature(body: bytes, signature: str) -> bool:
    if not settings.razorpay_webhook_secret:
        return False
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")
