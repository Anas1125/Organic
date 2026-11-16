"""Razorpay online payments: success, failure, cancel, expiry, refunds and webhooks.
Razorpay itself is replaced by a small fake, so no network calls are made."""

import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta

import pytest

from app.core.config import settings
from app.db import SessionLocal
from app.models import Order, Product
from tests.conftest import make_product
from tests.test_orders import ADDRESS

SECRET = "test_secret"
HOOK = "hook_secret"


class FakeRazorpay:
    def __init__(self):
        self.orders, self.payments, self.refunds = {}, {}, []

    def create_order(self, amount, receipt, notes=None):
        oid = f"order_{len(self.orders) + 1:04d}"
        self.orders[oid] = {"id": oid, "amount": int(amount * 100)}
        return self.orders[oid]

    def pay(self, oid, status="captured", method="upi"):
        pid = f"pay_{len(self.payments) + 1:04d}"
        self.payments[pid] = {"id": pid, "order_id": oid, "status": status, "amount": self.orders[oid]["amount"], "method": method}
        sig = hmac.new(SECRET.encode(), f"{oid}|{pid}".encode(), hashlib.sha256).hexdigest()
        return {"razorpay_order_id": oid, "razorpay_payment_id": pid, "razorpay_signature": sig}

    def fetch_payment(self, pid):
        return self.payments[pid]

    def order_payments(self, oid):
        return [p for p in self.payments.values() if p["order_id"] == oid]

    def capture(self, pid, amount):
        self.payments[pid]["status"] = "captured"
        return self.payments[pid]

    def refund(self, pid, amount, notes=None):
        rid = f"rfnd_{len(self.refunds) + 1:04d}"
        self.refunds.append((pid, amount))
        return {"id": rid, "status": "pending"}


@pytest.fixture
def rzp(monkeypatch):
    fake = FakeRazorpay()
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_x")
    monkeypatch.setattr(settings, "razorpay_key_secret", SECRET)
    monkeypatch.setattr(settings, "razorpay_webhook_secret", HOOK)
    from app.services import razorpay as mod

    for name in ("create_order", "fetch_payment", "order_payments", "capture", "refund"):
        monkeypatch.setattr(mod, name, getattr(fake, name))
    return fake


@pytest.fixture
def mails(monkeypatch):
    sent = []
    monkeypatch.setattr("app.services.notify.send_email", lambda to, subject, *a, **k: sent.append((to, subject)))
    return sent


def _checkout_online(client, buyer, seller, admin, category, qty=2):
    pid = make_product(client, seller, admin, category, stock=10)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": qty}, headers=buyer)
    orders = client.post("/api/v1/orders/checkout", json={**ADDRESS, "payment_method": "online"}, headers=buyer).json()
    return pid, orders


def _stock(pid):
    with SessionLocal() as db:
        return db.get(Product, pid).stock


def test_online_not_offered_without_keys(client, buyer, seller, admin, category):
    assert client.get("/api/v1/payments/config").json()["online_enabled"] is False
    pid = make_product(client, seller, admin, category)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    r = client.post("/api/v1/orders/checkout", json={**ADDRESS, "payment_method": "online"}, headers=buyer)
    assert r.status_code == 400


def test_successful_payment(client, buyer, seller, admin, category, rzp, mails):
    pid, orders = _checkout_online(client, buyer, seller, admin, category)
    o = orders[0]
    assert o["status"] == "awaiting_payment" and _stock(pid) == 8
    # Sellers don't see unpaid orders, and nobody is emailed yet
    assert client.get("/api/v1/seller/orders", headers=seller).json() == [] and mails == []

    start = client.post(f"/api/v1/payments/checkout/{o['checkout_ref']}/start", headers=buyer).json()
    assert start["amount"] == 20000 and start["key_id"] == "rzp_test_x"
    paid = rzp.pay(start["razorpay_order_id"])
    bad = {**paid, "razorpay_signature": "0" * 64}
    assert client.post("/api/v1/payments/verify", json=bad, headers=buyer).status_code == 400
    assert client.post("/api/v1/payments/verify", json=paid, headers=buyer).status_code == 200
    # Again (e.g. webhook + browser) is harmless
    assert client.post("/api/v1/payments/verify", json=paid, headers=buyer).status_code == 200

    got = client.get(f"/api/v1/orders/{o['id']}", headers=buyer).json()
    assert got["status"] == "pending" and got["payment_status"] == "paid" and got["payment_method"] == "online"
    assert len(client.get("/api/v1/seller/orders", headers=seller).json()) == 1
    assert {s for _, s in mails} == {f"Payment received — {o['order_number']}", f"New order {o['order_number']}"}


def test_failed_then_retry(client, buyer, seller, admin, category, rzp, mails):
    _, orders = _checkout_online(client, buyer, seller, admin, category)
    ref = orders[0]["checkout_ref"]
    start = client.post(f"/api/v1/payments/checkout/{ref}/start", headers=buyer).json()
    r = client.post("/api/v1/payments/failed", json={"razorpay_order_id": start["razorpay_order_id"], "reason": "UPI app declined"}, headers=buyer)
    assert r.status_code == 200 and mails[-1][1] == "Payment didn't go through"
    # Retry reuses the same Razorpay order and can still succeed
    again = client.post(f"/api/v1/payments/checkout/{ref}/start", headers=buyer).json()
    assert again["razorpay_order_id"] == start["razorpay_order_id"]
    assert client.post("/api/v1/payments/verify", json=rzp.pay(again["razorpay_order_id"]), headers=buyer).status_code == 200


def test_cancel_unpaid_restores_stock_and_cart(client, buyer, seller, admin, category, rzp):
    pid, orders = _checkout_online(client, buyer, seller, admin, category, qty=3)
    assert _stock(pid) == 7 and client.get("/api/v1/cart", headers=buyer).json()["item_count"] == 0
    r = client.post(f"/api/v1/payments/checkout/{orders[0]['checkout_ref']}/cancel", headers=buyer)
    assert r.status_code == 200
    assert _stock(pid) == 10
    assert client.get("/api/v1/cart", headers=buyer).json()["item_count"] == 1
    assert client.get(f"/api/v1/orders/{orders[0]['id']}", headers=buyer).json()["status"] == "cancelled"


def test_unpaid_orders_expire(client, buyer, seller, admin, category, rzp):
    pid, orders = _checkout_online(client, buyer, seller, admin, category)
    client.post(f"/api/v1/payments/checkout/{orders[0]['checkout_ref']}/start", headers=buyer)
    with SessionLocal() as db:
        db.get(Order, orders[0]["id"]).created_at = datetime.now(UTC) - timedelta(hours=2)
        db.commit()
    got = client.get("/api/v1/orders", headers=buyer).json()[0]
    assert got["status"] == "cancelled" and _stock(pid) == 10


def test_paid_but_browser_closed_is_not_expired(client, buyer, seller, admin, category, rzp):
    """If the buyer paid but never came back, expiry asks Razorpay first and keeps the order."""
    _, orders = _checkout_online(client, buyer, seller, admin, category)
    start = client.post(f"/api/v1/payments/checkout/{orders[0]['checkout_ref']}/start", headers=buyer).json()
    rzp.pay(start["razorpay_order_id"])
    with SessionLocal() as db:
        db.get(Order, orders[0]["id"]).created_at = datetime.now(UTC) - timedelta(hours=2)
        db.commit()
    got = client.get("/api/v1/orders", headers=buyer).json()[0]
    assert got["status"] == "pending" and got["payment_status"] == "paid"


def _paid_order(client, buyer, seller, admin, category, rzp):
    _, orders = _checkout_online(client, buyer, seller, admin, category)
    start = client.post(f"/api/v1/payments/checkout/{orders[0]['checkout_ref']}/start", headers=buyer).json()
    client.post("/api/v1/payments/verify", json=rzp.pay(start["razorpay_order_id"]), headers=buyer)
    return orders[0]


def test_cancel_paid_order_refunds(client, buyer, seller, admin, category, rzp, mails):
    o = _paid_order(client, buyer, seller, admin, category, rzp)
    r = client.post(f"/api/v1/orders/{o['id']}/cancel", headers=buyer).json()
    assert r["status"] == "cancelled" and r["payment_status"] == "refund_pending" and r["refund_id"]
    assert rzp.refunds and str(rzp.refunds[0][1]) == "200.00"
    assert any(s.startswith("Refund started") for _, s in mails)


def _hook(client, event, payload):
    body = json.dumps({"event": event, "payload": payload}).encode()
    sig = hmac.new(HOOK.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/api/v1/payments/razorpay/webhook", content=body, headers={"x-razorpay-signature": sig, "content-type": "application/json"})


def test_webhooks(client, buyer, seller, admin, category, rzp, mails):
    # Bad signature is refused
    assert client.post("/api/v1/payments/razorpay/webhook", content=b"{}", headers={"x-razorpay-signature": "x"}).status_code == 400

    # payment.captured marks the order paid even if the browser never called /verify
    _, orders = _checkout_online(client, buyer, seller, admin, category)
    start = client.post(f"/api/v1/payments/checkout/{orders[0]['checkout_ref']}/start", headers=buyer).json()
    p = rzp.pay(start["razorpay_order_id"])
    ent = {"payment": {"entity": {"id": p["razorpay_payment_id"], "order_id": p["razorpay_order_id"]}}}
    assert _hook(client, "payment.captured", ent).status_code == 200
    assert client.get(f"/api/v1/orders/{orders[0]['id']}", headers=buyer).json()["payment_status"] == "paid"

    # Admin refund, then Razorpay says it's done
    r = client.post(f"/api/v1/admin/orders/{orders[0]['id']}/refund", headers=admin).json()
    assert r["payment_status"] == "refund_pending"
    assert _hook(client, "refund.processed", {"refund": {"entity": {"id": r["refund_id"]}}}).status_code == 200
    assert client.get(f"/api/v1/orders/{orders[0]['id']}", headers=buyer).json()["payment_status"] == "refunded"
    assert any(s.startswith("Refund completed") for _, s in mails)


def test_status_emails(client, buyer, seller, admin, category, mails):
    pid = make_product(client, seller, admin, category)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    o = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]
    assert {s for _, s in mails} == {f"Order placed — {o['order_number']}", f"New order {o['order_number']}"}
    for st, subject in [("confirmed", "Order confirmed"), ("packed", "Order packed"), ("shipped", "Out for delivery"), ("delivered", "Order delivered")]:
        client.patch(f"/api/v1/seller/orders/{o['id']}/status", json={"status": st}, headers=seller)
        assert mails[-1][1] == f"{subject} — {o['order_number']}"
