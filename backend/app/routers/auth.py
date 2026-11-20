import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas as s
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models import PasswordReset, SellerProfile, User
from app.services import otp, ratelimit
from app.services.mailer import esc, send_email
from app.models.enums import Role
from app.services.serializers import user_out

router = APIRouter(prefix="/auth", tags=["Auth"])


def _taken_message(existing: User, wanted: str, email: str) -> str:
    """Explain what to do when the email is taken. Buyer and seller accounts are separate,
    so someone who shops and sells needs a second email (a Gmail "+" alias works)."""
    kinds = {Role.BUYER: "buyer", Role.SELLER: "seller", Role.ADMIN: "admin"}
    have = kinds.get(existing.role, "an")
    if existing.role == wanted:
        return f"You already have a {have} account with this email. Please log in instead, or use Forgot password."
    local, _, domain = email.partition("@")
    alias = f"{local}+{kinds.get(wanted, 'new')}@{domain}"
    tip = f" Tip: {alias} still arrives in your Gmail inbox." if domain in ("gmail.com", "googlemail.com") else ""
    return (
        f"This email already has a {have} account. Buyer and seller accounts are separate, "
        f"so please use a different email to sign up as a {kinds.get(wanted, 'new')}.{tip}"
    )


@router.post("/register", response_model=s.AuthOut, status_code=201)
def register(body: s.RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    existing = db.query(User).filter_by(email=email).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, _taken_message(existing, body.role, email))
    if body.role == Role.SELLER and not body.seller:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Business details are required for sellers"
        )

    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        phone=body.phone,
        role=body.role,
        buyer_type=body.buyer_type if body.role == Role.BUYER else "individual",
    )
    user.email_verified = not otp.needed(user, "signup")
    db.add(user)
    db.flush()
    if body.role == Role.SELLER:
        db.add(SellerProfile(user_id=user.id, phone=body.phone, **body.seller.model_dump()))
    db.commit()
    db.refresh(user)
    if not user.email_verified:  # confirm the email before the first login
        return s.AuthOut(**otp.start(db, user, "signup"))
    return s.AuthOut(access_token=create_access_token(user.id, user.role), user=user_out(user))


LOGIN_WINDOW = 15  # minutes
WAIT_MSG = "Too many failed attempts. Please wait 15 minutes and try again, or reset your password."


@router.post("/login", response_model=s.AuthOut)
def login(body: s.LoginIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    email_key, ip_key = f"login-email:{email}", f"login-ip:{ratelimit.client_ip(request)}"
    ratelimit.guard(db, email_key, 5, LOGIN_WINDOW, WAIT_MSG)  # per account
    ratelimit.guard(db, ip_key, 20, LOGIN_WINDOW, WAIT_MSG)  # per connection
    user = db.query(User).filter_by(email=email).first()
    if not user or not verify_password(body.password, user.password_hash):
        ratelimit.hit(db, email_key, ip_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    ratelimit.clear(db, email_key)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    # New device (or an email never confirmed): ask for the emailed code first.
    if not user.email_verified and otp.needed(user, "signup"):
        return s.AuthOut(**otp.start(db, user, "signup"))
    if otp.needed(user, "login") and not otp.trusted(db, user, body.device_token):
        return s.AuthOut(**otp.start(db, user, "login"))
    token = create_access_token(user.id, user.role, remember=body.remember)
    return s.AuthOut(access_token=token, user=user_out(user))


@router.post("/verify-otp", response_model=s.AuthOut)
def verify_otp(body: s.OtpVerifyIn, db: Session = Depends(get_db)):
    user = otp.verify(db, body.challenge, body.code)
    return s.AuthOut(
        access_token=create_access_token(user.id, user.role, remember=body.remember),
        user=user_out(user),
        device_token=otp.trust(db, user) if body.remember else None,
    )


@router.post("/resend-otp", response_model=s.AuthOut)
def resend_otp(body: s.OtpResendIn, db: Session = Depends(get_db)):
    return s.AuthOut(**otp.resend(db, body.challenge))


@router.get("/me", response_model=s.UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=s.MeUpdateOut)
def update_me(
    body: s.UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    new_email = body.email.lower() if body.email else None
    if new_email == user.email:
        new_email = None
    if body.new_password or new_email:
        # Changing login details always needs the current password.
        if not body.current_password or not verify_password(
            body.current_password, user.password_hash
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    if new_email:
        if db.query(User).filter_by(email=new_email).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
        user.email = new_email
    if body.new_password:
        user.password_hash = hash_password(body.new_password)
        # Log out every other session; this device gets a fresh login below.
        user.sessions_valid_after = datetime.now(UTC)
    for field in ("full_name", "phone"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)
    if body.buyer_type and user.role == Role.BUYER:
        user.buyer_type = body.buyer_type
    db.commit()
    db.refresh(user)
    out = s.MeUpdateOut(**user_out(user).model_dump())
    if body.new_password:
        out.access_token = create_access_token(user.id, user.role)
    return out


RESET_SENT = s.Message(
    detail="If an account exists for that email, we've sent a link to reset the password."
)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/forgot-password", response_model=s.Message)
def forgot_password(body: s.ForgotPasswordIn, db: Session = Depends(get_db)):
    """Always gives the same answer, so nobody can use it to find out who has an account."""
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not user.is_active:
        return RESET_SENT
    now = datetime.now(UTC)
    recent = db.scalar(
        select(PasswordReset).where(
            PasswordReset.user_id == user.id, PasswordReset.created_at > now - timedelta(minutes=1)
        )
    )
    if recent:  # one email a minute at most
        return RESET_SENT
    token = secrets.token_urlsafe(32)
    db.add(PasswordReset(
        user_id=user.id,
        token_hash=_hash(token),
        expires_at=now + timedelta(minutes=settings.password_reset_minutes),
    ))
    db.commit()
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    send_email(
        user.email,
        "Reset your Terralens password",
        "Reset your password",
        [
            f"Hi {esc(user.full_name)},",
            "We received a request to reset the password for your Terralens account. "
            f"The link below works once and expires in {settings.password_reset_minutes} minutes.",
            "If you didn't ask for this, you can ignore this email — your password won't change.",
        ],
        ("Choose a new password", link),
    )
    return RESET_SENT


@router.post("/reset-password", response_model=s.Message)
def reset_password(body: s.ResetPasswordIn, db: Session = Depends(get_db)):
    now = datetime.now(UTC)
    reset = db.scalar(
        select(PasswordReset).where(PasswordReset.token_hash == _hash(body.token)).with_for_update()
    )
    if not reset or reset.used_at or reset.expires_at < now:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Please request a new one."
        )
    user = db.get(User, reset.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account can't be reset")
    user.password_hash = hash_password(body.password)
    user.sessions_valid_after = now  # log out everywhere
    # Use up this link and any other open ones.
    for r in db.scalars(select(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))):
        r.used_at = now
    db.commit()
    send_email(
        user.email,
        "Your Terralens password was changed",
        "Password changed",
        [f"Hi {esc(user.full_name)},", "Your password was just changed. If this wasn't you, contact us right away."],
    )
    return s.Message(detail="Password updated. You can now log in.")
