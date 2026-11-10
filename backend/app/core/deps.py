from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db import get_db
from app.models import SellerProfile, User
from app.models.enums import ReviewStatus, Role

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    if not creds:
        raise unauthorized
    payload = decode_access_token(creds.credentials)
    if not payload:
        raise unauthorized
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise unauthorized
    return user


def require_role(*roles: Role) -> Callable[..., User]:
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have access to this area")
        return user

    return checker


require_admin = require_role(Role.ADMIN)
require_buyer = require_role(Role.BUYER)


def get_current_seller(
    user: User = Depends(require_role(Role.SELLER)), db: Session = Depends(get_db)
) -> SellerProfile:
    profile = db.query(SellerProfile).filter_by(user_id=user.id).first()
    if not profile:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Seller profile not found")
    return profile


def get_approved_seller(seller: SellerProfile = Depends(get_current_seller)) -> SellerProfile:
    if seller.status != ReviewStatus.APPROVED:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your seller account is awaiting admin approval",
        )
    return seller
