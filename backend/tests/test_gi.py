"""GI workflow rules added in the GI audit."""

from tests.conftest import make_product, make_seller, register

PDF = b"%PDF-1.4 gi"
GI = "/api/v1/seller/gi-records"


def add_gi(client, seller, doc=True, **overrides):
    data = {"record_type": "registered_product", "gi_product_name": "Kovilpatti Kadalai Mittai",
            "geographical_region": "Thoothukudi", "registration_number": "GI-100", **overrides}
    files = {"document": ("gi.pdf", PDF, "application/pdf")} if doc else None
    return client.post(GI, headers=seller, data=data, files=files)


def review(client, admin, gid, status, notes=None):
    return client.patch(f"/api/v1/admin/gi-records/{gid}", headers=admin,
                        json={"verification_status": status, "admin_notes": notes})


def test_verified_application_never_shows_gi_badge(client, seller, admin, category):
    gid = add_gi(client, seller, record_type="application", registration_number="APP-9").json()["id"]
    pid = make_product(client, seller, admin, category, gi_record_id=gid)
    r = review(client, admin, gid, "verified")
    assert r.status_code == 200 and r.json()["can_show_badge"] is False
    assert client.get(f"/api/v1/products/{pid}").json()["is_gi_verified"] is False
    assert client.get("/api/v1/products?gi=true").json()["total"] == 0


def test_registered_product_shows_badge_after_verification(client, seller, admin, category):
    gid = add_gi(client, seller).json()["id"]
    pid = make_product(client, seller, admin, category, gi_record_id=gid)
    assert client.get(f"/api/v1/products/{pid}").json()["is_gi_verified"] is False
    review(client, admin, gid, "verified")
    p = client.get(f"/api/v1/products/{pid}").json()
    assert p["is_gi_verified"] is True and p["gi"]["record_type"] == "registered_product"
    assert client.get("/api/v1/products?gi=true").json()["total"] == 1


def test_numbers_required_per_record_type(client, seller):
    assert add_gi(client, seller, registration_number="").status_code == 422
    r = add_gi(client, seller, record_type="authorised_user")
    assert r.status_code == 422 and "Authorised user" in r.json()["detail"]
    r = add_gi(client, seller, record_type="authorised_user", authorised_user_number="AU-1")
    assert r.status_code == 201 and r.json()["authorised_user_number"] == "AU-1"
    # authorised-user number is dropped for other types
    r = add_gi(client, seller, authorised_user_number="AU-2")
    assert r.json()["authorised_user_number"] is None


def test_request_info_then_seller_resubmits(client, seller, admin):
    gid = add_gi(client, seller).json()["id"]
    assert review(client, admin, gid, "info_requested").status_code == 422  # note required
    r = review(client, admin, gid, "info_requested", "Please upload the GI certificate page 2")
    assert r.json()["verification_status"] == "info_requested"
    assert r.json()["reviewed_by_name"] == "Admin"

    mine = client.get(GI, headers=seller).json()[0]
    assert mine["verification_status"] == "info_requested"
    assert mine["admin_notes"] == "Please upload the GI certificate page 2"

    r = client.put(f"{GI}/{gid}", headers=seller, data={
        "record_type": "registered_product", "gi_product_name": "Kovilpatti Kadalai Mittai",
        "geographical_region": "Thoothukudi", "registration_number": "GI-100",
        "seller_notes": "Uploaded full certificate"},
        files={"document": ("gi2.pdf", PDF + b"v2", "application/pdf")})
    assert r.status_code == 200
    assert r.json()["verification_status"] == "pending"
    assert r.json()["seller_notes"] == "Uploaded full certificate"
    assert client.get(f"/api/v1/documents/gi-records/{gid}", headers=admin).content == PDF + b"v2"


def test_editing_verified_record_removes_badge_until_rereviewed(client, seller, admin, category):
    gid = add_gi(client, seller).json()["id"]
    pid = make_product(client, seller, admin, category, gi_record_id=gid)
    review(client, admin, gid, "verified")
    client.put(f"{GI}/{gid}", headers=seller, data={
        "record_type": "registered_product", "gi_product_name": "Changed",
        "geographical_region": "Thoothukudi", "registration_number": "GI-100"})
    assert client.get(f"/api/v1/products/{pid}").json()["is_gi_verified"] is False


def test_reject_needs_note_and_verify_needs_document(client, seller, admin):
    gid = add_gi(client, seller, doc=False).json()["id"]
    assert review(client, admin, gid, "rejected").status_code == 422
    assert review(client, admin, gid, "verified").status_code == 400
    assert review(client, admin, gid, "rejected", "Number not found").json()["verification_status"] == "rejected"


def test_sellers_cannot_touch_other_sellers_gi(client, seller, admin, buyer):
    gid = add_gi(client, seller).json()["id"]
    other = make_seller(client, admin, "other@test.io")
    data = {"record_type": "registered_product", "gi_product_name": "X",
            "geographical_region": "Y", "registration_number": "Z"}
    assert client.put(f"{GI}/{gid}", headers=other, data=data).status_code == 404
    assert client.delete(f"{GI}/{gid}", headers=other).status_code == 404
    assert client.get(f"/api/v1/documents/gi-records/{gid}", headers=other).status_code == 403
    assert client.get(f"/api/v1/documents/gi-records/{gid}", headers=buyer).status_code == 403
    assert review(client, buyer, gid, "verified").status_code == 403
    assert review(client, other, gid, "verified").status_code == 403


def test_admin_can_filter_by_type_and_status(client, seller, admin):
    add_gi(client, seller)
    add_gi(client, seller, record_type="application", registration_number="APP-1")
    rows = client.get("/api/v1/admin/gi-records?record_type=application", headers=admin).json()
    assert [r["record_type"] for r in rows] == ["application"]
    gid = rows[0]["id"]
    review(client, admin, gid, "info_requested", "Need filing receipt")
    rows = client.get("/api/v1/admin/gi-records?status=info_requested", headers=admin).json()
    assert [r["id"] for r in rows] == [gid]
