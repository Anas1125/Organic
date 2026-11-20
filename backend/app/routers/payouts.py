"""Seller payouts: bank/UPI details, what each seller is owed, and settling up."""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_seller, require_admin
from app.db import get_db
from app.models import Order, Payout, SellerProfile, User
from app.models.enums import ReviewStatus
from app.routers.site import get_settings_row
from app.services import payouts as svc

router = APIRouter(tags=["Payouts"])


# ---------- schemas ----------

class PayoutDetails(BaseModel):
    payout_upi: str | None = None
    bank_account_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None


class PayoutDetailsIn(PayoutDetails):
    payout_upi: str | None = Field(default=None, max_length=100, pattern=r"^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$")
    bank_account_name: str | None = Field(default=None, max_length=120)
    bank_account_number: str | None = Field(default=None, pattern=r"^\d{9,18}$")
    bank_ifsc: str | None = Field(default=None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")

    @field_validator("*", mode="before")
    @classmethod
    def _blank(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v

    @field_validator("bank_ifsc", mode="before")
    @classmethod
    def _upper(cls, v):
        return v.strip().upper() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _complete(self):
        bank = [self.bank_account_name, self.bank_account_number, self.bank_ifsc]
        if any(bank) and not all(bank):
            raise ValueError("For a bank account, fill in the account holder name, account number and IFSC")
        return self


class LineOut(BaseModel):
    order_id: int
    order_number: str
    kind: str
    payment_method: str
    delivered_at: datetime | None
    total: Decimal
    commission_rate: Decimal
    commission: Decimal
    amount: Decimal


class PayoutOut(BaseModel):
    id: int
    seller_id: int
    business_name: str
    amount: Decimal
    reference: str | None
    note: str | None
    created_at: datetime
    order_count: int


class SellerPayoutsOut(BaseModel):
    details: PayoutDetails
    commission_percent: Decimal
    balance: Decimal
    lines: list[LineOut]
    history: list[PayoutOut]


class SellerDueOut(BaseModel):
    seller_id: int
    business_name: str
    email: str
    phone: str | None
    details: PayoutDetails
    balance: Decimal
    order_count: int


class AdminPayoutsOut(BaseModel):
    commission_percent: Decimal
    sellers: list[SellerDueOut]
    history: list[PayoutOut]


class SettleIn(BaseModel):
    amount: Decimal  # the amount the admin saw, to catch orders that arrived meanwhile
    reference: str | None = Field(default=None, max_length=100)
    note: str | None = Field(default=None, max_length=300)


class CommissionIn(BaseModel):
    commission_percent: Decimal = Field(ge=0, le=50, decimal_places=2)


# ---------- helpers ----------

def _details(sp: SellerProfile) -> PayoutDetails:
    return PayoutDetails(
        payout_upi=sp.payout_upi, bank_account_name=sp.bank_account_name,
        bank_account_number=sp.bank_account_number, bank_ifsc=sp.bank_ifsc,
    )


def _lines_out(lines: list[svc.Line]) -> list[LineOut]:
    return [
        LineOut(
            order_id=ln.order.id, order_number=ln.order.order_number, kind=ln.kind,
            payment_method=ln.order.payment_method, delivered_at=ln.order.delivered_at, total=ln.order.total,
            commission_rate=ln.order.commission_rate, commission=ln.commission, amount=ln.amount,
        )
        for ln in lines
    ]


def _history(db: Session, seller_id: int | None = None, limit: int = 50) -> list[PayoutOut]:
    counts = (
        select(func.count(Order.id))
        .where((Order.payout_id == Payout.id) | (Order.reversal_payout_id == Payout.id))
        .scalar_subquery()
    )
    stmt = (
        select(Payout, counts)
        .options(selectinload(Payout.seller))
        .order_by(Payout.created_at.desc())
        .limit(limit)
    )
    if seller_id is not None:
        stmt = stmt.where(Payout.seller_id == seller_id)
    return [
        PayoutOut(
            id=p.id, seller_id=p.seller_id, business_name=p.seller.business_name, amount=p.amount,
            reference=p.reference, note=p.note, created_at=p.created_at, order_count=n,
        )
        for p, n in db.execute(stmt)
    ]


# ---------- seller ----------

@router.get("/seller/payouts", response_model=SellerPayoutsOut)
def my_payouts(seller: SellerProfile = Depends(get_current_seller), db: Session = Depends(get_db)):
    lines = svc.open_lines(db, seller.id)
    return SellerPayoutsOut(
        details=_details(seller),
        commission_percent=get_settings_row(db).commission_percent,
        balance=svc.balance(lines),
        lines=_lines_out(lines),
        history=_history(db, seller.id),
    )


@router.put("/seller/payout-details", response_model=PayoutDetails)
def save_payout_details(
    body: PayoutDetailsIn, seller: SellerProfile = Depends(get_current_seller), db: Session = Depends(get_db)
):
    for k, v in body.model_dump().items():
        setattr(seller, k, v)
    db.commit()
    return _details(seller)


# ---------- admin ----------

@router.get("/admin/payouts", response_model=AdminPayoutsOut, dependencies=[Depends(require_admin)])
def all_payouts(db: Session = Depends(get_db)):
    by_seller: dict[int, list[svc.Line]] = {}
    for ln in svc.open_lines(db):
        by_seller.setdefault(ln.order.seller_id, []).append(ln)
    sellers = db.scalars(
        select(SellerProfile)
        .where((SellerProfile.status == ReviewStatus.APPROVED) | SellerProfile.id.in_(by_seller))
        .options(selectinload(SellerProfile.user))
        .order_by(SellerProfile.business_name)
    )
    rows = [
        SellerDueOut(
            seller_id=sp.id, business_name=sp.business_name, email=sp.user.email, phone=sp.phone,
            details=_details(sp), balance=svc.balance(by_seller.get(sp.id, [])),
            order_count=len(by_seller.get(sp.id, [])),
        )
        for sp in sellers
    ]
    # Sellers with money to settle first, biggest first.
    rows.sort(key=lambda r: (r.order_count == 0, -abs(r.balance)))
    return AdminPayoutsOut(commission_percent=get_settings_row(db).commission_percent, sellers=rows, history=_history(db))


@router.get("/admin/payouts/{seller_id}", response_model=SellerPayoutsOut, dependencies=[Depends(require_admin)])
def seller_payouts(seller_id: int, db: Session = Depends(get_db)):
    sp = db.get(SellerProfile, seller_id)
    if not sp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seller not found")
    lines = svc.open_lines(db, seller_id)
    return SellerPayoutsOut(
        details=_details(sp), commission_percent=get_settings_row(db).commission_percent,
        balance=svc.balance(lines), lines=_lines_out(lines), history=_history(db, seller_id),
    )


@router.post("/admin/payouts/{seller_id}", response_model=PayoutOut, status_code=201)
def settle(seller_id: int, body: SettleIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = svc.settle(db, seller_id, body.amount, (body.reference or "").strip() or None, (body.note or "").strip() or None, admin)
    return next(h for h in _history(db, seller_id, limit=5) if h.id == p.id)


@router.get("/admin/payouts-commission", response_model=CommissionIn, dependencies=[Depends(require_admin)])
def get_commission(db: Session = Depends(get_db)):
    return CommissionIn(commission_percent=get_settings_row(db).commission_percent)


@router.put("/admin/payouts-commission", response_model=CommissionIn, dependencies=[Depends(require_admin)])
def set_commission(body: CommissionIn, db: Session = Depends(get_db)):
    row = get_settings_row(db)
    row.commission_percent = body.commission_percent
    db.commit()
    return CommissionIn(commission_percent=row.commission_percent)
