from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import schemas as s
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db import get_db
from app.models import SellerProfile, User
from app.models.enums import Role
from app.services.serializers import user_out

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=s.TokenOut, status_code=201)
def register(body: s.RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
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
    db.add(user)
    db.flush()
    if body.role == Role.SELLER:
        db.add(SellerProfile(user_id=user.id, phone=body.phone, **body.seller.model_dump()))
    db.commit()
    db.refresh(user)
    return s.TokenOut(access_token=create_access_token(user.id, user.role), user=user_out(user))


@router.post("/login", response_model=s.TokenOut)
def login(body: s.LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    return s.TokenOut(access_token=create_access_token(user.id, user.role), user=user_out(user))


@router.get("/me", response_model=s.UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.patch("/me", response_model=s.UserOut)
def update_me(
    body: s.UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if body.new_password:
        if not body.current_password or not verify_password(
            body.current_password, user.password_hash
        ):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
        user.password_hash = hash_password(body.new_password)
    for field in ("full_name", "phone"):
        value = getattr(body, field)
        if value is not None:
            setattr(user, field, value)
    if body.buyer_type and user.role == Role.BUYER:
        user.buyer_type = body.buyer_type
    db.commit()
    db.refresh(user)
    return user_out(user)
