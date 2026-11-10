"""Only the main (owner) admin can add or remove admins."""

from app.db import SessionLocal
from app.models import User
from tests.conftest import PASSWORD, auth

NEW = {"full_name": "Second Admin", "email": "second@test.io", "password": "second-pass-1"}


def login(client, email, password):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_owner_adds_and_removes_admin(client, admin):
    r = client.post("/api/v1/admin/admins", json=NEW, headers=admin)
    assert r.status_code == 201 and r.json()["role"] == "admin" and not r.json()["is_owner"]
    assert client.post("/api/v1/admin/admins", json=NEW, headers=admin).status_code == 409

    listed = client.get("/api/v1/admin/admins", headers=admin).json()
    assert [a["email"] for a in listed] == ["admin@test.io", "second@test.io"]  # owner first

    assert login(client, NEW["email"], NEW["password"]).status_code == 200
    assert client.delete(f"/api/v1/admin/admins/{r.json()['id']}", headers=admin).status_code == 204
    assert login(client, NEW["email"], NEW["password"]).status_code == 401


def test_other_admins_cannot_manage_admins(client, admin):
    client.post("/api/v1/admin/admins", json=NEW, headers=admin)
    second = auth(login(client, NEW["email"], NEW["password"]).json()["access_token"])
    owner_id = client.get("/api/v1/auth/me", headers=admin).json()["id"]

    assert client.get("/api/v1/admin/admins", headers=second).status_code == 403
    extra = {**NEW, "email": "third@test.io"}
    assert client.post("/api/v1/admin/admins", json=extra, headers=second).status_code == 403
    assert client.delete(f"/api/v1/admin/admins/{owner_id}", headers=second).status_code == 403
    # Nor through the general users screen
    r = client.patch(f"/api/v1/admin/users/{owner_id}", json={"is_active": False}, headers=second)
    assert r.status_code == 403
    # ...but normal admin work still works
    assert client.get("/api/v1/admin/stats", headers=second).status_code == 200


def test_owner_cannot_be_removed_or_deactivated(client, admin):
    owner_id = client.get("/api/v1/auth/me", headers=admin).json()["id"]
    assert client.delete(f"/api/v1/admin/admins/{owner_id}", headers=admin).status_code == 400
    r = client.patch(f"/api/v1/admin/users/{owner_id}", json={"is_active": False}, headers=admin)
    assert r.status_code == 400


def test_owner_changes_own_email_and_password(client, admin):
    body = {"email": "client@shop.in", "new_password": "client-pass-9"}
    assert client.patch("/api/v1/auth/me", json=body, headers=admin).status_code == 400  # no current pw
    body["current_password"] = PASSWORD
    r = client.patch("/api/v1/auth/me", json=body, headers=admin)
    assert r.status_code == 200 and r.json()["email"] == "client@shop.in"
    assert login(client, "admin@test.io", PASSWORD).status_code == 401
    assert login(client, "client@shop.in", "client-pass-9").status_code == 200


def test_seed_does_not_recreate_admin(client, admin, monkeypatch):
    from app import seed
    from app.core.config import settings

    monkeypatch.setattr(settings, "seed_admin_email", "seed@test.io")
    monkeypatch.setattr(settings, "seed_admin_password", "seed-pass-123")
    with SessionLocal() as db:
        seed.seed_base(db)
        emails = [u.email for u in db.query(User).filter_by(role="admin")]
    assert emails == ["admin@test.io"]
