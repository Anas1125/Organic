from tests.conftest import PASSWORD, register


def test_register_and_login(client):
    headers, user = register(client, "a@test.io")
    assert user["role"] == "buyer"
    r = client.post("/api/v1/auth/login", json={"email": "A@test.io", "password": PASSWORD})
    assert r.status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == "a@test.io"


def test_duplicate_email_rejected(client):
    register(client, "a@test.io")
    r = client.post("/api/v1/auth/register", json={
        "email": "a@test.io", "password": PASSWORD, "full_name": "X Y", "role": "buyer"})
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
