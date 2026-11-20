from decimal import Decimal

from tests.conftest import approve_orders, make_product, make_seller, place_order

ADDRESS = {"shipping_name": "Priya", "shipping_phone": "9876543210", "shipping_address": "12 Main Street",
           "shipping_city": "Chennai", "shipping_state": "Tamil Nadu", "shipping_pincode": "600001"}


def test_bulk_price_applies_by_quantity(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category)
    for qty, price in [(3, "100"), (6, "90"), (25, "90"), (26, "80")]:
        cart = client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": qty}, headers=buyer).json()
        item = cart["groups"][0]["items"][0]
        assert Decimal(item["unit_price"]) == Decimal(price), qty
        client.delete(f"/api/v1/cart/items/{item['id']}", headers=buyer)


def test_min_order_and_stock_enforced(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category, min_order_qty=5, stock=10)
    assert client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 2}, headers=buyer).status_code == 400
    assert client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 11}, headers=buyer).status_code == 400
    assert client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 5}, headers=buyer).status_code == 200


def test_checkout_splits_by_seller_and_reduces_stock(client, seller, admin, buyer, category):
    p1 = make_product(client, seller, admin, category, stock=50)
    other = make_seller(client, admin, "other@test.io")
    p2 = make_product(client, other, admin, category, name="Ragi", price="50", price_tiers=[], stock=20)
    client.post("/api/v1/cart/items", json={"product_id": p1, "quantity": 10}, headers=buyer)
    client.post("/api/v1/cart/items", json={"product_id": p2, "quantity": 4}, headers=buyer)

    r = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer)
    assert r.status_code == 201, r.text
    orders = r.json()
    assert len(orders) == 2
    assert len({o["checkout_ref"] for o in orders}) == 1
    totals = sorted(Decimal(o["total"]) for o in orders)
    assert totals == [Decimal("200"), Decimal("900")]

    assert client.get(f"/api/v1/products/{p1}").json()["stock"] == 40
    assert client.get("/api/v1/cart", headers=buyer).json()["item_count"] == 0
    # Enquiries first: sellers see nothing until the admin approves
    assert {o["status"] for o in orders} == {"enquiry"}
    assert client.get("/api/v1/seller/orders", headers=seller).json() == []
    approve_orders(client, admin, orders)
    # each seller only sees their own order
    assert len(client.get("/api/v1/seller/orders", headers=seller).json()) == 1
    assert len(client.get("/api/v1/seller/orders", headers=other).json()) == 1


def test_checkout_fails_when_stock_ran_out(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category, stock=10)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 8}, headers=buyer)
    client.patch(f"/api/v1/seller/products/{pid}", json={"stock": 5}, headers=seller)
    assert client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).status_code == 400
    assert client.get(f"/api/v1/products/{pid}").json()["stock"] == 5


def test_status_flow_and_cancel_restocks(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category, stock=10)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 4}, headers=buyer)
    oid = place_order(client, buyer, admin, ADDRESS)[0]["id"]

    # sellers can't skip steps
    r = client.patch(f"/api/v1/seller/orders/{oid}/status", json={"status": "delivered"}, headers=seller)
    assert r.status_code == 400
    assert client.patch(f"/api/v1/seller/orders/{oid}/status", json={"status": "confirmed"}, headers=seller).status_code == 200

    r = client.post(f"/api/v1/orders/{oid}/cancel", headers=buyer)
    assert r.json()["status"] == "cancelled"
    assert client.get(f"/api/v1/products/{pid}").json()["stock"] == 10


def test_delivered_cod_marked_paid(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    oid = place_order(client, buyer, admin, ADDRESS)[0]["id"]
    for st in ["confirmed", "packed", "shipped", "delivered"]:
        r = client.patch(f"/api/v1/seller/orders/{oid}/status", json={"status": st}, headers=seller)
        assert r.status_code == 200, st
    assert r.json()["payment_status"] == "paid"


def test_buyer_cannot_see_other_buyers_order(client, seller, admin, buyer, category):
    from tests.conftest import register
    pid = make_product(client, seller, admin, category)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    oid = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"]
    other, _ = register(client, "b2@test.io")
    assert client.get(f"/api/v1/orders/{oid}", headers=other).status_code == 404
    other_seller = make_seller(client, admin, "s2@test.io")
    assert client.patch(f"/api/v1/seller/orders/{oid}/status", json={"status": "confirmed"}, headers=other_seller).status_code == 404


def test_order_items_show_product_photo(client, seller, admin, buyer, category):
    from tests.conftest import real_png

    pid = make_product(client, seller, admin, category)
    client.post(f"/api/v1/seller/products/{pid}/images", headers=seller,
                files={"files": ("p.png", real_png(), "image/png")})
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
    client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer)
    item = client.get("/api/v1/orders", headers=buyer).json()[0]["items"][0]
    assert item["image"].startswith(f"/media/products/{pid}/")
    got = client.get(item["image"])  # per-product folder must be served too
    assert got.status_code == 200 and got.headers["content-type"] == "image/webp"


def test_enquiry_approve_and_decline(client, seller, admin, buyer, category, monkeypatch):
    sent = []
    monkeypatch.setattr("app.services.notify.send_email", lambda to, subject, *a, **k: sent.append((to, subject)))
    p1 = make_product(client, seller, admin, category, stock=10)
    client.post("/api/v1/cart/items", json={"product_id": p1, "quantity": 2}, headers=buyer)
    o = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]
    # The admin is told who wants what, from whom
    admin_mail = [s for to, s in sent if s.startswith("New enquiry")]
    assert admin_mail and "seller@test.io Farm" in admin_mail[0]
    # Sellers can't act on it; the admin sees contact details
    assert client.patch(f"/api/v1/seller/orders/{o['id']}/status", json={"status": "confirmed"}, headers=seller).status_code == 404
    listed = client.get("/api/v1/admin/orders?status=enquiry", headers=admin).json()[0]
    assert listed["seller_email"] == "seller@test.io" and listed["buyer_email"] == "buyer@test.io"
    # Only admins approve, with the agreed commission
    assert client.post(f"/api/v1/admin/orders/{o['id']}/approve", json={"commission_percent": "8"}, headers=seller).status_code == 403
    r = client.post(f"/api/v1/admin/orders/{o['id']}/approve", json={"commission_percent": "8.5"}, headers=admin)
    assert r.status_code == 200 and r.json()["commission_rate"] == "8.50" and r.json()["approved_at"]
    assert client.post(f"/api/v1/admin/orders/{o['id']}/approve", json={"commission_percent": "8"}, headers=admin).status_code == 400

    # A second enquiry is declined: cancelled, stock back, buyer told why
    client.post("/api/v1/cart/items", json={"product_id": p1, "quantity": 3}, headers=buyer)
    o2 = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]
    assert client.get(f"/api/v1/products/{p1}").json()["stock"] == 5
    r = client.post(f"/api/v1/admin/orders/{o2['id']}/decline", json={"reason": "Out of season"}, headers=admin)
    assert r.json()["status"] == "cancelled" and r.json()["decline_reason"] == "Out of season"
    assert client.get(f"/api/v1/products/{p1}").json()["stock"] == 8
    assert f"Enquiry declined — {o2['order_number']}" in {s for _, s in sent}


def test_buyer_can_cancel_enquiry(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category, stock=10)
    client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 4}, headers=buyer)
    o = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]
    assert client.post(f"/api/v1/orders/{o['id']}/cancel", headers=buyer).json()["status"] == "cancelled"
    assert client.get(f"/api/v1/products/{pid}").json()["stock"] == 10


def test_seller_never_sees_declined_or_withdrawn_enquiries(client, seller, admin, buyer, category):
    pid = make_product(client, seller, admin, category, stock=20)
    ids = []
    for _ in range(2):
        client.post("/api/v1/cart/items", json={"product_id": pid, "quantity": 1}, headers=buyer)
        ids.append(client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"])
    client.post(f"/api/v1/admin/orders/{ids[0]}/decline", json={"reason": "No stock"}, headers=admin)
    client.post(f"/api/v1/orders/{ids[1]}/cancel", headers=buyer)
    assert client.get("/api/v1/seller/orders", headers=seller).json() == []
    assert client.get(f"/api/v1/seller/orders/{ids[0]}", headers=seller).status_code == 404
    assert client.get("/api/v1/seller/stats", headers=seller).json()["total_orders"] == 0
