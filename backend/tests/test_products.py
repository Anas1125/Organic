from tests.conftest import real_png, make_product, make_seller


def test_product_hidden_until_approved(client, seller, admin, category):
    pid = make_product(client, seller, admin, category, approve=False)
    assert client.get(f"/api/v1/products/{pid}").status_code == 404
    client.patch(f"/api/v1/admin/products/{pid}/status", json={"status": "approved"}, headers=admin)
    assert client.get(f"/api/v1/products/{pid}").status_code == 200


def test_reject_requires_reason(client, seller, admin, category):
    pid = make_product(client, seller, admin, category, approve=False)
    r = client.patch(f"/api/v1/admin/products/{pid}/status", json={"status": "rejected"}, headers=admin)
    assert r.status_code == 422


def test_seller_cannot_touch_other_sellers_product(client, seller, admin, category):
    pid = make_product(client, seller, admin, category)
    other = make_seller(client, admin, "other@test.io")
    assert client.patch(f"/api/v1/seller/products/{pid}", json={"price": "1"}, headers=other).status_code == 404
    assert client.delete(f"/api/v1/seller/products/{pid}", headers=other).status_code == 404


def test_overlapping_tiers_rejected(client, seller, category):
    r = client.post("/api/v1/seller/products", headers=seller, json={
        "name": "Rice", "category_id": category, "price": "10", "unit": "kg", "stock": 5,
        "price_tiers": [{"min_qty": 1, "max_qty": 10, "unit_price": "9"},
                        {"min_qty": 5, "max_qty": 20, "unit_price": "8"}]})
    assert r.status_code == 422


def test_editing_name_sends_back_to_review_but_stock_does_not(client, seller, admin, category):
    pid = make_product(client, seller, admin, category)
    r = client.patch(f"/api/v1/seller/products/{pid}", json={"stock": 99}, headers=seller)
    assert r.json()["status"] == "approved"
    r = client.patch(f"/api/v1/seller/products/{pid}", json={"name": "New Name"}, headers=seller)
    assert r.json()["status"] == "pending"


def test_search_and_filter(client, seller, admin, category):
    make_product(client, seller, admin, category, name="Black Rice")
    make_product(client, seller, admin, category, name="Ragi", price_tiers=[])
    assert client.get("/api/v1/products?q=black").json()["total"] == 1
    assert client.get("/api/v1/products?bulk=true").json()["total"] == 1
    assert client.get("/api/v1/products?category=rice-grains").json()["total"] == 2


def test_upload_rejects_fake_image(client, seller, admin, category):
    pid = make_product(client, seller, admin, category)
    r = client.post(f"/api/v1/seller/products/{pid}/images", headers=seller,
                    files={"files": ("x.png", b"not really a png", "image/png")})
    assert r.status_code == 400
    fake = b"\x89PNG\r\n\x1a\n" + b"0" * 100  # right header, not a real image
    r = client.post(f"/api/v1/seller/products/{pid}/images", headers=seller,
                    files={"files": ("x.png", fake, "image/png")})
    assert r.status_code == 400
    png = real_png()
    r = client.post(f"/api/v1/seller/products/{pid}/images", headers=seller,
                    files={"files": ("x.png", png, "image/png")})
    assert r.status_code == 201 and len(r.json()["images"]) == 1


def test_district_filter_and_list(client, seller, admin, category):
    from app.db import SessionLocal
    from app.models import GIRecord, Product

    pid = make_product(client, seller, admin, category)
    make_product(client, seller, admin, category, name="Plain Rice")
    with SessionLocal() as db:
        p = db.get(Product, pid)
        gi = GIRecord(seller_id=p.seller_id, record_type="registered_product", gi_product_name="X",
                      geographical_region="Thanjavur district, Tamil Nadu", verification_status="verified")
        db.add(gi)
        db.flush()
        p.gi_record_id = gi.id
        db.commit()
    assert client.get("/api/v1/products/districts").json() == [{"name": "Thanjavur", "product_count": 1}]
    r = client.get("/api/v1/products?district=Thanjavur").json()
    assert r["total"] == 1 and r["items"][0]["id"] == pid
