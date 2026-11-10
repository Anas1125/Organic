"""Tests run against TEST_DATABASE_URL, which is wiped for every test."""

import os
import tempfile
from pathlib import Path

# Point the app at the test database *before* it is imported.
for line in Path(__file__).resolve().parents[1].joinpath(".env").read_text().splitlines():
    if line.startswith("TEST_DATABASE_URL="):
        os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="terralens-test-")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category, User  # noqa: E402

assert "test" in str(engine.url), "Refusing to run tests against a non-test database"

PASSWORD = "test-pass-123"


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean():
    yield
    with engine.begin() as conn:
        tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def category():
    with SessionLocal() as db:
        c = Category(name="Rice & Grains", slug="rice-grains")
        db.add(c)
        db.commit()
        return c.id


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin(client):
    with SessionLocal() as db:
        db.add(User(email="admin@test.io", password_hash=hash_password(PASSWORD),
                    full_name="Admin", role="admin"))
        db.commit()
    r = client.post("/api/v1/auth/login", json={"email": "admin@test.io", "password": PASSWORD})
    return auth(r.json()["access_token"])


def register(client, email, role="buyer", **extra):
    body = {"email": email, "password": PASSWORD, "full_name": "Test User", "role": role, **extra}
    if role == "seller":
        body.setdefault("seller", {"business_name": f"{email} Farm"})
    r = client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    return auth(data["access_token"]), data["user"]


@pytest.fixture
def buyer(client):
    return register(client, "buyer@test.io")[0]


def make_seller(client, admin, email="seller@test.io"):
    headers, user = register(client, email, role="seller")
    r = client.patch(f"/api/v1/admin/sellers/{user['seller_id']}/status", json={"status": "approved"}, headers=admin)
    assert r.status_code == 200
    return headers


@pytest.fixture
def seller(client, admin):
    return make_seller(client, admin)


def make_product(client, seller, admin, category, approve=True, **overrides):
    body = {
        "name": "Organic Rice", "description": "Good rice", "category_id": category,
        "price": "100", "unit": "kg", "stock": 50, "min_order_qty": 1,
        "price_tiers": [
            {"min_qty": 1, "max_qty": 5, "unit_price": "100"},
            {"min_qty": 6, "max_qty": 25, "unit_price": "90"},
            {"min_qty": 26, "max_qty": 100, "unit_price": "80"},
        ],
        **overrides,
    }
    r = client.post("/api/v1/seller/products", json=body, headers=seller)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    if approve:
        r = client.patch(f"/api/v1/admin/products/{pid}/status", json={"status": "approved"}, headers=admin)
        assert r.status_code == 200
    return pid
