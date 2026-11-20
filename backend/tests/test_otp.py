"""Email one-time codes at sign-up and on new-device login."""

import re

import pytest

from app.core.config import settings

SIGNUP = {"email": "priya@shop.in", "password": "secret-pass-1", "full_name": "Priya", "phone": "9876543210", "role": "buyer"}


@pytest.fixture
def mail(monkeypatch):
    """Pretend email is set up and capture the codes we send."""
    sent = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "smtp_user", "shop@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr("app.services.otp.send_email", lambda to, subject, heading, paras, button=None: sent.append((to, subject)) or True)
    return sent


def _code(sent):
    return re.match(r"(\d{6}) is your", sent[-1][1])[1]


def test_signup_needs_code(client, mail):
    r = client.post("/api/v1/auth/register", json=SIGNUP).json()
    assert r["otp_required"] and r["access_token"] is None and r["email_hint"].startswith("pr")
    # Can't log in before verifying — a fresh code is sent instead
    assert client.post("/api/v1/auth/login", json={"email": SIGNUP["email"], "password": SIGNUP["password"]}).json()["otp_required"]
    wrong = client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": "000000"})
    assert wrong.status_code == 400 and "tries left" in wrong.json()["detail"]
    ok = client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": _code(mail)}).json()
    assert ok["access_token"] and ok["user"]["email"] == SIGNUP["email"]


def test_login_code_and_trusted_device(client, mail):
    r = client.post("/api/v1/auth/register", json=SIGNUP).json()
    client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": _code(mail)})

    login = {"email": SIGNUP["email"], "password": SIGNUP["password"]}
    r = client.post("/api/v1/auth/login", json=login).json()
    assert r["otp_required"]
    ok = client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": _code(mail), "remember": True}).json()
    assert ok["access_token"] and ok["device_token"]
    # Same browser next time: no code
    again = client.post("/api/v1/auth/login", json={**login, "device_token": ok["device_token"]}).json()
    assert again["access_token"] and not again["otp_required"]
    # Wrong password still fails, device or not
    bad = client.post("/api/v1/auth/login", json={**login, "password": "nope-nope", "device_token": ok["device_token"]})
    assert bad.status_code == 401


def test_code_limits(client, mail):
    r = client.post("/api/v1/auth/register", json=SIGNUP).json()
    assert client.post("/api/v1/auth/resend-otp", json={"challenge": r["challenge"]}).status_code == 429  # too soon
    for _ in range(5):
        client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": "111111"})
    locked = client.post("/api/v1/auth/verify-otp", json={"challenge": r["challenge"], "code": _code(mail)})
    assert locked.status_code == 429
    assert client.post("/api/v1/auth/verify-otp", json={"challenge": "junk", "code": "123456"}).status_code == 400


def test_demo_accounts_and_no_mail_skip_otp(client, mail, monkeypatch):
    # @example.com inboxes don't exist, so no code is asked
    r = client.post("/api/v1/auth/register", json={**SIGNUP, "email": "demo@example.com"}).json()
    assert r["access_token"] and not r["otp_required"]
    # Without email that reaches everyone (no SMTP; Resend only on its shared address), OTP stays off
    monkeypatch.setattr(settings, "smtp_host", None)
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    r = client.post("/api/v1/auth/register", json={**SIGNUP, "email": "other@shop.in"}).json()
    assert r["access_token"]
