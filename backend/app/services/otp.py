"""Email one-time codes for sign-up and login, plus "remember this device".

A *challenge* is a short-lived signed token naming the user and purpose; the browser
sends it back with the 6-digit code. Codes are stored hashed, expire after 10 minutes
and allow 5 tries. OTP is only enforced when email can reach any address (Gmail SMTP or a verified domain), and never for
demo addresses (OTP_EXEMPT_DOMAINS) whose inboxes don't exist.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import OtpCode, TrustedDevice, User
from app.services.mailer import esc, mail_reaches_anyone, send_email

CODE_MINUTES = 10
MAX_TRIES = 5
RESEND_SECONDS = 45
TRUST_DAYS = 30


def _h(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _exempt(user: User) -> bool:
    domains = {d.strip().lower() for d in settings.otp_exempt_domains.split(",") if d.strip()}
    return user.email.rsplit("@", 1)[-1].lower() in domains


def needed(user: User, purpose: str) -> bool:
    on = settings.otp_on_signup if purpose == "signup" else settings.otp_on_login
    if not on or _exempt(user):
        return False
    if mail_reaches_anyone():
        return True
    # Codes can't be delivered. Default: skip OTP so nobody is locked out.
    # OTP_STRICT: refuse instead, so OTP can never be silently bypassed.
    if settings.otp_strict:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Email verification isn't available right now. Please try again later.",
        )
    return False


def hint(email: str) -> str:
    name, _, domain = email.partition("@")
    return f"{name[:2]}{'•' * max(len(name) - 2, 3)}@{domain}"


def _challenge(user: User, purpose: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": str(user.id), "purpose": purpose, "typ": "otp", "iat": now, "exp": now + timedelta(minutes=15)},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )


def _read(challenge: str) -> tuple[int, str]:
    try:
        p = jwt.decode(challenge, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This code has expired. Please start again.")
    if p.get("typ") != "otp":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification request")
    return int(p["sub"]), p["purpose"]


def _send(db: Session, user: User, purpose: str) -> None:
    # Stop anyone using login / "Resend" to flood an inbox.
    since = lambda minutes: datetime.now(UTC) - timedelta(minutes=minutes)  # noqa: E731
    recent = lambda minutes: db.scalar(  # noqa: E731
        select(func.count(OtpCode.id)).where(OtpCode.user_id == user.id, OtpCode.created_at > since(minutes))
    )
    if recent(15) >= 5 or recent(24 * 60) >= 20:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many codes requested. Please try again later.")
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(OtpCode(
        user_id=user.id, purpose=purpose, code_hash=_h(f"{user.id}:{code}"),
        expires_at=datetime.now(UTC) + timedelta(minutes=CODE_MINUTES),
    ))
    db.commit()
    what = "finish creating your account" if purpose == "signup" else "log in"
    ok = send_email(
        user.email, f"{code} is your Terralens code", "Your verification code",
        [f"Hi {esc(user.full_name)},",
         f"Use this code to {what}:",
         f'<span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#1E4D3B">{code}</span>',
         f"It expires in {CODE_MINUTES} minutes. If you didn't try to {what}, you can ignore this email — "
         "but consider changing your password."],
    )
    if not ok:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "We couldn't send the code to your email. Please try again shortly.")


def start(db: Session, user: User, purpose: str) -> dict:
    """Email a code and return what the browser needs to show the code screen."""
    _send(db, user, purpose)
    return {"otp_required": True, "challenge": _challenge(user, purpose), "email_hint": hint(user.email)}


def resend(db: Session, challenge: str) -> dict:
    user_id, purpose = _read(challenge)
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account not found")
    last = db.scalar(
        select(OtpCode).where(OtpCode.user_id == user.id, OtpCode.purpose == purpose).order_by(OtpCode.id.desc())
    )
    if last and last.created_at > datetime.now(UTC) - timedelta(seconds=RESEND_SECONDS):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, f"Please wait {RESEND_SECONDS} seconds before asking for a new code")
    _send(db, user, purpose)
    return {"otp_required": True, "challenge": _challenge(user, purpose), "email_hint": hint(user.email)}


def verify(db: Session, challenge: str, code: str) -> User:
    user_id, purpose = _read(challenge)
    row = db.scalar(
        select(OtpCode)
        .where(OtpCode.user_id == user_id, OtpCode.purpose == purpose, OtpCode.used_at.is_(None))
        .order_by(OtpCode.id.desc())
        .with_for_update()
    )
    now = datetime.now(UTC)
    if not row or row.expires_at < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This code has expired. Ask for a new one.")
    if row.attempts >= MAX_TRIES:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many wrong tries. Ask for a new code.")
    if not secrets.compare_digest(row.code_hash, _h(f"{user_id}:{code}")):
        row.attempts += 1
        db.commit()
        left = MAX_TRIES - row.attempts
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That code isn't right. {left} {'try' if left == 1 else 'tries'} left." if left else "Too many wrong tries. Ask for a new code.")
    row.used_at = now
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account not found")
    user.email_verified = True
    db.commit()
    return user


def trusted(db: Session, user: User, device_token: str | None) -> bool:
    if not device_token:
        return False
    d = db.scalar(select(TrustedDevice).where(TrustedDevice.token_hash == _h(device_token)))
    return bool(d and d.user_id == user.id and d.expires_at > datetime.now(UTC))


def trust(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(TrustedDevice(user_id=user.id, token_hash=_h(token), expires_at=datetime.now(UTC) + timedelta(days=TRUST_DAYS)))
    db.commit()
    return token
