from tests.conftest import PASSWORD, auth, register


def test_register_and_login(client):
    headers, user = register(client, "a@test.io")
    assert user["role"] == "buyer"
    r = client.post("/api/v1/auth/login", json={"email": "A@test.io", "password": PASSWORD})
    assert r.status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == "a@test.io"


def test_duplicate_email_rejected(client):
    register(client, "a@test.io")
    r = client.post("/api/v1/auth/register", json={
        "email": "a@test.io", "password": PASSWORD, "full_name": "X Y", "phone": "9876543210", "role": "buyer"})
    assert r.status_code == 409


def test_wrong_password(client):
    register(client, "a@test.io")
    r = client.post("/api/v1/auth/login", json={"email": "a@test.io", "password": "nope-nope"})
    assert r.status_code == 401


def test_cannot_self_register_as_admin(client):
    r = client.post("/api/v1/auth/register", json={
        "email": "x@test.io", "password": PASSWORD, "full_name": "X Y", "role": "admin"})
    assert r.status_code == 422


def test_seller_starts_pending_and_cannot_add_products(client, category):
    headers, user = register(client, "s@test.io", role="seller")
    assert user["seller_status"] == "pending"
    r = client.post("/api/v1/seller/products", headers=headers, json={
        "name": "Rice", "category_id": category, "price": "10", "unit": "kg", "stock": 5})
    assert r.status_code == 403


def test_role_guards(client, buyer):
    assert client.get("/api/v1/admin/stats", headers=buyer).status_code == 403
    assert client.get("/api/v1/seller/products", headers=buyer).status_code == 403
    assert client.get("/api/v1/cart").status_code == 401


def test_deactivated_user_blocked(client, admin):
    headers, user = register(client, "a@test.io")
    client.patch(f"/api/v1/admin/users/{user['id']}", json={"is_active": False}, headers=admin)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_phone_is_required_and_tidied(client):
    body = {"email": "p@test.io", "password": PASSWORD, "full_name": "P Q", "role": "buyer"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 422  # missing
    assert client.post("/api/v1/auth/register", json={**body, "phone": "12345"}).status_code == 422
    r = client.post("/api/v1/auth/register", json={**body, "phone": "098765-43210"})
    assert r.status_code == 201 and r.json()["user"]["phone"] == "+91 98765 43210"
    # A seller's business phone starts as their mobile number
    seller = {**body, "email": "s2@test.io", "role": "seller", "phone": "+91 91234 56789", "seller": {"business_name": "S Farm"}}
    h = auth(client.post("/api/v1/auth/register", json=seller).json()["access_token"])
    assert client.get("/api/v1/seller/profile", headers=h).json()["phone"] == "+91 91234 56789"


def test_seller_profile_needs_phone_and_fills_missing_account_phone(client, admin):
    from app.db import SessionLocal
    from app.models import User
    h, user = register(client, "old@test.io", role="seller")
    with SessionLocal() as db:  # an account from before phones were required
        db.get(User, user["id"]).phone = None
        db.commit()
    body = {"business_name": "Old Farm"}
    assert client.put("/api/v1/seller/profile", json=body, headers=h).status_code == 422
    assert client.put("/api/v1/seller/profile", json={**body, "phone": "9123456780"}, headers=h).status_code == 200
    assert client.get("/api/v1/auth/me", headers=h).json()["phone"] == "+91 91234 56780"
