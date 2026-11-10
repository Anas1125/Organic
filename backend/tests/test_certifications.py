from tests.conftest import make_product, make_seller

PDF = b"%PDF-1.4 test"


def add_cert(client, seller):
    r = client.post("/api/v1/seller/certifications", headers=seller,
                    data={"certification_type": "NPOP", "certification_number": "N-1",
                          "issuing_authority": "APEDA", "expiry_date": "2099-01-01"},
                    files={"document": ("c.pdf", PDF, "application/pdf")})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_organic_badge_only_after_admin_approval(client, seller, admin, category):
    cid = add_cert(client, seller)
    pid = make_product(client, seller, admin, category, organic_certification_id=cid)
    assert client.get(f"/api/v1/products/{pid}").json()["is_organic_verified"] is False
    assert client.get("/api/v1/products?organic=true").json()["total"] == 0

    client.patch(f"/api/v1/admin/certifications/{cid}", json={"status": "approved"}, headers=admin)
    p = client.get(f"/api/v1/products/{pid}").json()
    assert p["is_organic_verified"] is True and p["organic"]["certification_number"] == "N-1"
    assert client.get("/api/v1/products?organic=true").json()["total"] == 1


def test_expired_cert_gives_no_badge(client, seller, admin, category):
    r = client.post("/api/v1/seller/certifications", headers=seller,
                    data={"certification_type": "NPOP", "certification_number": "N-2",
                          "issuing_authority": "APEDA", "issue_date": "2020-01-01", "expiry_date": "2021-01-01"},
                    files={"document": ("c.pdf", PDF, "application/pdf")})
    cid = r.json()["id"]
    client.patch(f"/api/v1/admin/certifications/{cid}", json={"status": "approved"}, headers=admin)
    pid = make_product(client, seller, admin, category, organic_certification_id=cid)
    assert client.get(f"/api/v1/products/{pid}").json()["is_organic_verified"] is False


def test_gi_badge_only_after_verification(client, seller, admin, category):
    r = client.post("/api/v1/seller/gi-records", headers=seller, data={
        "record_type": "authorised_user", "gi_product_name": "Madurai Malli",
        "geographical_region": "Madurai", "registration_number": "GI-42",
        "authorised_user_number": "AU-7"},
        files={"document": ("gi.pdf", PDF, "application/pdf")})
    gid = r.json()["id"]
    pid = make_product(client, seller, admin, category, gi_record_id=gid)
    assert client.get(f"/api/v1/products/{pid}").json()["is_gi_verified"] is False
    client.patch(f"/api/v1/admin/gi-records/{gid}", json={"verification_status": "verified"}, headers=admin)
    assert client.get(f"/api/v1/products/{pid}").json()["is_gi_verified"] is True


def test_cannot_link_other_sellers_cert(client, seller, admin, category):
    cid = add_cert(client, seller)
    other = make_seller(client, admin, "other@test.io")
    r = client.post("/api/v1/seller/products", headers=other, json={
        "name": "Rice", "category_id": category, "price": "10", "unit": "kg", "stock": 5,
        "organic_certification_id": cid})
    assert r.status_code == 422


def test_documents_are_private(client, seller, admin, buyer):
    cid = add_cert(client, seller)
    assert client.get(f"/api/v1/documents/certifications/{cid}", headers=seller).content == PDF
    assert client.get(f"/api/v1/documents/certifications/{cid}", headers=admin).status_code == 200
    assert client.get(f"/api/v1/documents/certifications/{cid}", headers=buyer).status_code == 403
    assert client.get(f"/media/documents/organic/1/x.pdf").status_code == 404


def test_rejects_non_pdf_document(client, seller):
    r = client.post("/api/v1/seller/certifications", headers=seller,
                    data={"certification_type": "NPOP", "certification_number": "N-1", "issuing_authority": "A"},
                    files={"document": ("c.pdf", b"MZ evil", "application/pdf")})
    assert r.status_code == 400
