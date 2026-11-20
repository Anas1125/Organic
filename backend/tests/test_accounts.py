"""Remember me, forgot password and reset."""

import re
from datetime import UTC, datetime

import jwt

from app.core.config import settings
from tests.conftest import PASSWORD, auth, register


def _exp_days(token):
    p = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    return (datetime.fromtimestamp(p["exp"], UTC) - datetime.fromtimestamp(p["iat"], UTC)).days


def test_remember_me_gives_longer_login(client, buyer):
    email = client.get("/api/v1/auth/me", headers=buyer).json()["email"]
    short = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).json()["access_token"]
    long = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD, "remember": True}).json()["access_token"]
    assert _exp_days(short) < 2 and _exp_days(long) == settings.remember_me_days


def test_forgot_and_reset_password(client, buyer, monkeypatch):
    sent = []
    monkeypatch.setattr("app.routers.auth.send_email", lambda to, subject, heading, paras, button=None: sent.append((to, button)))
    email = client.get("/api/v1/auth/me", headers=buyer).json()["email"]

    # Same answer for unknown emails, and nothing is sent
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@test.io"})
    known = client.post("/api/v1/auth/forgot-password", json={"email": email.upper()})
    assert unknown.json() == known.json() and len(sent) == 1
    # At most one email a minute
    client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert len(sent) == 1

    token = re.search(r"token=([\w-]+)", sent[0][1][1])[1]
    assert client.post("/api/v1/auth/reset-password", json={"token": "x" * 30, "password": "new-pass-123"}).status_code == 400
    r = client.post("/api/v1/auth/reset-password", json={"token": token, "password": "new-pass-123"})
    assert r.status_code == 200
    # Link works once; old password and old logins stop working
    assert client.post("/api/v1/auth/reset-password", json={"token": token, "password": "again-123456"}).status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": email, "password": "new-pass-123"}).status_code == 200


def test_taken_email_explains_what_to_do(client):
    register(client, "shop.owner@gmail.com")
    body = {"email": "Shop.Owner@gmail.com", "password": PASSWORD, "full_name": "Shop Owner", "role": "seller",
            "seller": {"business_name": "Owner Farm"}}
    r = client.post("/api/v1/auth/register", json=body)
    assert r.status_code == 409
    msg = r.json()["detail"]
    assert "buyer account" in msg and "shop.owner+seller@gmail.com" in msg
    # Same type again: just log in
    r = client.post("/api/v1/auth/register", json={**body, "role": "buyer", "seller": None})
    assert "log in" in r.json()["detail"]
