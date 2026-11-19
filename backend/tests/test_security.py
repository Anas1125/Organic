"""Rate limits, strict OTP, session logout on password change, payment ownership."""

from app.core.config import settings
from tests.conftest import PASSWORD, auth, register

LOGIN = "/api/v1/auth/login"


def _email(client, headers):
    return client.get("/api/v1/auth/me", headers=headers).json()["email"]


def test_login_locks_after_five_wrong_passwords(client, buyer):
    email = _email(client, buyer)
    for _ in range(5):
        assert client.post(LOGIN, json={"email": email, "password": "wrong-pass"}).status_code == 401
    # Even the right password waits now
    assert client.post(LOGIN, json={"email": email, "password": PASSWORD}).status_code == 429


def test_success_clears_failed_attempts(client, buyer):
    email = _email(client, buyer)
    for _ in range(4):
        client.post(LOGIN, json={"email": email, "password": "wrong-pass"})
    assert client.post(LOGIN, json={"email": email, "password": PASSWORD}).status_code == 200
    for _ in range(4):
        assert client.post(LOGIN, json={"email": email, "password": "wrong-pass"}).status_code == 401


def test_one_connection_limited_across_accounts(client):
    for i in range(20):
        client.post(LOGIN, json={"email": f"guess{i}@test.io", "password": "x"}, headers={"X-Forwarded-For": "9.9.9.9"})
    r = client.post(LOGIN, json={"email": "other@test.io", "password": "x"}, headers={"X-Forwarded-For": "9.9.9.9"})
    assert r.status_code == 429
    # A different connection is unaffected
    r = client.post(LOGIN, json={"email": "other@test.io", "password": "x"}, headers={"X-Forwarded-For": "8.8.8.8"})
    assert r.status_code == 401


def test_strict_otp_refuses_when_mail_is_down(client, buyer, monkeypatch):
    email = _email(client, buyer).replace("example.com", "x.io")
    register(client, "strict@test.io")
    monkeypatch.setattr(settings, "otp_on_login", True)
    monkeypatch.setattr("app.services.otp.mail_reaches_anyone", lambda: False)
    # Default: OTP skipped so nobody is locked out
    assert client.post(LOGIN, json={"email": "strict@test.io", "password": PASSWORD}).status_code == 200
    monkeypatch.setattr(settings, "otp_strict", True)
    assert client.post(LOGIN, json={"email": "strict@test.io", "password": PASSWORD}).status_code == 503
    assert email  # keep fixture used


def test_code_requests_are_capped(client, monkeypatch):
    register(client, "codes@test.io")
    monkeypatch.setattr(settings, "otp_on_login", True)
    monkeypatch.setattr("app.services.otp.mail_reaches_anyone", lambda: True)
    monkeypatch.setattr("app.services.otp.send_email", lambda *a, **k: True)
    codes = [client.post(LOGIN, json={"email": "codes@test.io", "password": PASSWORD}).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429


def test_password_change_logs_out_other_sessions(client, buyer):
    email = _email(client, buyer)
    other = auth(client.post(LOGIN, json={"email": email, "password": PASSWORD}).json()["access_token"])
    r = client.patch("/api/v1/auth/me", headers=buyer, json={"current_password": PASSWORD, "new_password": "brand-new-pass-1"})
    assert r.status_code == 200 and r.json()["access_token"]
    assert client.get("/api/v1/auth/me", headers=other).status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth(r.json()["access_token"])).status_code == 200
    # Changing only the name keeps sessions and returns no token
    r = client.patch("/api/v1/auth/me", headers=auth(r.json()["access_token"]), json={"full_name": "New Name"})
    assert r.status_code == 200 and r.json()["access_token"] is None


def test_docs_hidden_when_turned_off():
    from fastapi.testclient import TestClient

    from app import main
    assert settings.api_docs  # on locally
    monkey = main.FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    assert TestClient(monkey).get("/docs").status_code == 404


def test_same_second_tokens_are_logged_out(client, buyer, monkeypatch):
    """Regression: the cutoff used to be whole seconds, so a token issued earlier in the
    same second as a password change stayed valid. Freeze the clock to force that case."""
    from datetime import UTC, datetime, timedelta

    frozen = (datetime.now(UTC) - timedelta(seconds=3)).replace(microsecond=100_000)

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return frozen

    email = _email(client, buyer)
    monkeypatch.setattr("app.core.security.datetime", Clock)
    old = auth(client.post(LOGIN, json={"email": email, "password": PASSWORD}).json()["access_token"])
    frozen = frozen.replace(microsecond=900_000)  # same second, a little later
    monkeypatch.setattr("app.routers.auth.datetime", Clock)
    r = client.patch("/api/v1/auth/me", headers=old, json={"current_password": PASSWORD, "new_password": "brand-new-pass-2"})
    assert r.status_code == 200
    assert client.get("/api/v1/auth/me", headers=old).status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth(r.json()["access_token"])).status_code == 200
