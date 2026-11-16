"""Order automation without a courier: auto-confirm, bulk updates, tracking,
buyer 'received', auto-delivery after N days, and the daily cron endpoint."""

from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.db import SessionLocal
from app.models import Order
from tests.conftest import make_product
from tests.test_orders import ADDRESS


def _orders(client, buyer, seller, admin, category, n=3):
    ids = []
    for i in range(n):
        pid = make_product(client, seller, admin, category, name=f"Item {i}", stock=50)
        client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
        ids.append(client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"])
    return ids


def test_bulk_ship_with_tracking_then_buyer_receives(client, buyer, seller, admin, category):
    ids = _orders(client, buyer, seller, admin, category)
    r = client.post("/api/v1/seller/orders/bulk-status", json={"order_ids": ids, "status": "packed"}, headers=seller).json()
    assert len(r["updated"]) == 3 and r["failed"] == []
    r = client.post("/api/v1/seller/orders/bulk-status", headers=seller, json={
        "order_ids": ids + [99999], "status": "shipped", "courier": "India Post",
        "tracking": {str(ids[0]): "EE123456789IN"},
    }).json()
    assert len(r["updated"]) == 3 and r["failed"][0]["id"] == 99999
    first = client.get(f"/api/v1/orders/{ids[0]}", headers=buyer).json()
    assert first["courier"] == "India Post" and first["tracking_number"] == "EE123456789IN"
    assert first["auto_delivery_on"]
    # Can't skip back or forward illegally in bulk; failures are reported, not fatal
    r = client.post("/api/v1/seller/orders/bulk-status", json={"order_ids": ids, "status": "confirmed"}, headers=seller).json()
    assert r["updated"] == [] and len(r["failed"]) == 3

    got = client.post(f"/api/v1/orders/{ids[0]}/received", headers=buyer).json()
    assert got["status"] == "delivered" and got["payment_status"] == "paid"  # COD paid on delivery
    assert client.post(f"/api/v1/orders/{ids[0]}/received", headers=buyer).status_code == 400


def test_auto_delivery_after_days_and_cron(client, buyer, seller, admin, category, monkeypatch):
    ids = _orders(client, buyer, seller, admin, category, n=2)
    for st in ("packed", "shipped"):
        client.post("/api/v1/seller/orders/bulk-status", json={"order_ids": ids, "status": st}, headers=seller)
    with SessionLocal() as db:
        db.get(Order, ids[0]).shipped_at = datetime.now(UTC) - timedelta(days=settings.auto_deliver_days + 1)
        db.commit()

    # The daily job needs the secret
    monkeypatch.setattr(settings, "cron_secret", "s3cret")
    assert client.get("/api/v1/internal/run-automation").status_code == 401
    r = client.get("/api/v1/internal/run-automation", headers={"Authorization": "Bearer s3cret"})
    assert r.json()["delivered"] == 1
    statuses = {o["id"]: o["status"] for o in client.get("/api/v1/orders", headers=buyer).json()}
    assert statuses[ids[0]] == "delivered" and statuses[ids[1]] == "shipped"


def test_pending_orders_are_confirmed_by_automation(client, buyer, seller, admin, category, monkeypatch):
    monkeypatch.setattr(settings, "auto_confirm_orders", False)
    ids = _orders(client, buyer, seller, admin, category, n=1)
    assert client.get(f"/api/v1/orders/{ids[0]}", headers=buyer).json()["status"] == "pending"
    monkeypatch.setattr(settings, "auto_confirm_orders", True)
    assert client.get("/api/v1/orders", headers=buyer).json()[0]["status"] == "confirmed"
