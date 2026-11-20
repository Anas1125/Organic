"""Seller payouts: bank/UPI details, commission, settling, refunds after settling."""

from decimal import Decimal

from app.db import SessionLocal
from app.models import Order
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from tests.conftest import make_product, make_seller
from tests.test_orders import ADDRESS


def _order(client, buyer, seller, admin, category, *, online=False, name="Item", seller_collected=False):
    pid = make_product(client, seller, admin, category, name=name, price="100", price_tiers=[])
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    oid = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"]
    with SessionLocal() as db:  # deliver it (and pay online) without going through Razorpay
        o = db.get(Order, oid)
        o.status = OrderStatus.DELIVERED
        o.payment_status = PaymentStatus.PAID
        if online:
            o.payment_method = PaymentMethod.ONLINE
        if seller_collected:  # an older cash order, paid to the seller
            o.pay_to_marketplace = False
        db.commit()
    return oid


def _due(client, admin, seller_name="seller@test.io Farm"):
    rows = client.get("/api/v1/admin/payouts", headers=admin).json()["sellers"]
    return next(r for r in rows if r["business_name"] == seller_name)


def test_payout_details_are_checked(client, seller):
    put = lambda body: client.put("/api/v1/seller/payout-details", json=body, headers=seller)  # noqa: E731
    assert put({"payout_upi": "not-an-upi"}).status_code == 422
    assert put({"bank_account_number": "123456789012"}).status_code == 422  # name and IFSC missing
    assert put({"bank_account_name": "A", "bank_account_number": "123456789012", "bank_ifsc": "bad"}).status_code == 422
    r = put({"payout_upi": "farm.shop@okaxis", "bank_account_name": "Farm Co", "bank_account_number": "123456789012", "bank_ifsc": "sbin0001234"})
    assert r.status_code == 200 and r.json()["bank_ifsc"] == "SBIN0001234"
    assert client.get("/api/v1/seller/payouts", headers=seller).json()["details"]["payout_upi"] == "farm.shop@okaxis"


def test_settle_online_and_cash_orders(client, buyer, seller, admin, category, monkeypatch):
    mails = []
    monkeypatch.setattr("app.services.payouts.send_email", lambda to, subject, *a: mails.append(subject))
    # An order before any commission keeps 0% even after the rate changes
    _order(client, buyer, seller, admin, category, name="Old")
    assert client.put("/api/v1/admin/payouts-commission", json={"commission_percent": "10"}, headers=admin).status_code == 200
    _order(client, buyer, seller, admin, category, online=True, name="Online")  # seller is owed 90
    _order(client, buyer, seller, admin, category, name="Paid on delivery")  # paid to us: seller is owed 90
    _order(client, buyer, seller, admin, category, name="Cash", seller_collected=True)  # seller owes 10
    # (the "Old" 0% order was paid to the marketplace: the seller is owed all 100)

    due = _due(client, admin)
    assert Decimal(due["balance"]) == Decimal("270.00") and due["order_count"] == 4

    sid = due["seller_id"]
    # The amount the admin saw must still be right
    assert client.post(f"/api/v1/admin/payouts/{sid}", json={"amount": "70"}, headers=admin).status_code == 409
    r = client.post(f"/api/v1/admin/payouts/{sid}", json={"amount": "270", "reference": "UTR123"}, headers=admin)
    assert r.status_code == 201 and r.json()["order_count"] == 4 and mails

    mine = client.get("/api/v1/seller/payouts", headers=seller).json()
    assert Decimal(mine["balance"]) == 0 and mine["lines"] == [] and mine["history"][0]["reference"] == "UTR123"
    assert client.post(f"/api/v1/admin/payouts/{sid}", json={"amount": "0"}, headers=admin).status_code == 400


def test_refund_after_payout_is_taken_back(client, buyer, seller, admin, category, monkeypatch):
    monkeypatch.setattr("app.services.payouts.send_email", lambda *a: None)
    client.put("/api/v1/admin/payouts-commission", json={"commission_percent": "5"}, headers=admin)
    oid = _order(client, buyer, seller, admin, category, online=True)
    sid = _due(client, admin)["seller_id"]
    assert client.post(f"/api/v1/admin/payouts/{sid}", json={"amount": "95"}, headers=admin).status_code == 201
    with SessionLocal() as db:
        o = db.get(Order, oid)
        o.payment_status = PaymentStatus.REFUNDED
        db.commit()
    lines = client.get("/api/v1/seller/payouts", headers=seller).json()["lines"]
    assert [(ln["kind"], Decimal(ln["amount"])) for ln in lines] == [("reversal", Decimal("-95.00"))]
    assert client.post(f"/api/v1/admin/payouts/{sid}", json={"amount": "-95"}, headers=admin).status_code == 201
    assert client.get("/api/v1/seller/payouts", headers=seller).json()["lines"] == []


def test_only_admins_settle(client, seller, admin):
    other = make_seller(client, admin, "other@test.io")
    assert client.get("/api/v1/admin/payouts", headers=seller).status_code == 403
    assert client.post("/api/v1/admin/payouts/1", json={"amount": "1"}, headers=other).status_code == 403
    assert client.put("/api/v1/admin/payouts-commission", json={"commission_percent": "60"}, headers=admin).status_code == 422
