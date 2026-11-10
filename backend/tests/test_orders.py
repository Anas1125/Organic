from decimal import Decimal

from tests.conftest import make_product, make_seller

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
    oid = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"]

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
    oid = client.post("/api/v1/orders/checkout", json=ADDRESS, headers=buyer).json()[0]["id"]
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
