import re
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app import schemas as s
from app.core.deps import require_admin, require_owner
from app.core.security import hash_password
from app.db import get_db
from app.models import (
    Category,
    ContactMessage,
    GIRecord,
    Order,
    OrganicCertification,
    Product,
    SellerProfile,
    User,
)
from app.models.enums import GIVerification, OrderStatus, ReviewStatus, Role
from app.services import product_media as media
from app.services.orders import ORDER_LOAD, change_status
from app.services.queries import PRODUCT_LOAD
from app.services.serializers import cert_out, gi_out, order_out, product_out, user_out

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin)])

REVIEW_CHOICES = {ReviewStatus.APPROVED, ReviewStatus.REJECTED, ReviewStatus.PENDING}


def _need_reason(body: s.StatusChange) -> None:
    if body.status not in REVIEW_CHOICES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid status")
    if body.status == ReviewStatus.REJECTED and not (body.reason or "").strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Please give a reason for rejecting"
        )


# ---------- Overview ----------


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(*where))

    live = Order.status != OrderStatus.CANCELLED
    return {
        "buyers": count(User, User.role == Role.BUYER),
        "sellers": count(SellerProfile),
        "pending_sellers": count(SellerProfile, SellerProfile.status == ReviewStatus.PENDING),
        "products": count(Product),
        "live_products": count(Product, Product.status == ReviewStatus.APPROVED),
        "pending_products": count(Product, Product.status == ReviewStatus.PENDING),
        "pending_certifications": count(
            OrganicCertification, OrganicCertification.status == ReviewStatus.PENDING
        ),
        "pending_gi": count(GIRecord, GIRecord.verification_status == GIVerification.PENDING),
        "orders": count(Order),
        "open_orders": count(
            Order, Order.status.in_([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PACKED])
        ),
        "gmv": Decimal(db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(live))),
        "messages": count(ContactMessage),
        "recent_orders": [
            order_out(o)
            for o in db.scalars(
                select(Order).options(*ORDER_LOAD).order_by(Order.created_at.desc()).limit(5)
            )
        ],
    }


# ---------- Users ----------


class UserActive(BaseModel):
    is_active: bool


@router.get("/users", response_model=list[s.UserOut])
def users(
    db: Session = Depends(get_db),
    role: str | None = None,
    q: str | None = Query(None, max_length=100),
):
    stmt = select(User).options(selectinload(User.seller_profile))
    if role:
        stmt = stmt.where(User.role == role)
    if q:
        stmt = stmt.where(or_(User.email.ilike(f"%{q}%"), User.full_name.ilike(f"%{q}%")))
    return [user_out(u) for u in db.scalars(stmt.order_by(User.created_at.desc()).limit(500))]


@router.patch("/users/{user_id}", response_model=s.UserOut)
def set_user_active(
    user_id: int,
    body: UserActive,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate yourself")
    if user.is_owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The main admin account cannot be deactivated")
    if user.role == Role.ADMIN and not admin.is_owner:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the main admin account can manage admins"
        )
    user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user_out(user)


# ---------- Admin accounts (main admin only) ----------


@router.get("/admins", response_model=list[s.UserOut], dependencies=[Depends(require_owner)])
def list_admins(db: Session = Depends(get_db)):
    stmt = select(User).where(User.role == Role.ADMIN).order_by(User.is_owner.desc(), User.created_at)
    return [user_out(u) for u in db.scalars(stmt)]


@router.post(
    "/admins", response_model=s.UserOut, status_code=201, dependencies=[Depends(require_owner)]
)
def create_admin(body: s.AdminCreate, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        full_name=body.full_name.strip(),
        role=Role.ADMIN,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.delete("/admins/{user_id}", status_code=204, dependencies=[Depends(require_owner)])
def remove_admin(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.role != Role.ADMIN:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Admin not found")
    if user.is_owner:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The main admin account cannot be removed")
    db.delete(user)  # GI reviews they made keep their result; reviewed_by becomes empty
    db.commit()


# ---------- Sellers ----------


@router.get("/sellers", response_model=list[s.AdminSellerOut])
def sellers(db: Session = Depends(get_db), status_filter: str | None = Query(None, alias="status")):
    counts = dict(
        db.execute(select(Product.seller_id, func.count(Product.id)).group_by(Product.seller_id)).all()
    )
    stmt = select(SellerProfile).options(selectinload(SellerProfile.user))
    if status_filter:
        stmt = stmt.where(SellerProfile.status == status_filter)
    return [
        s.AdminSellerOut(
            **s.SellerProfileOut.model_validate(sp).model_dump(),
            owner_name=sp.user.full_name,
            owner_email=sp.user.email,
            product_count=counts.get(sp.id, 0),
        )
        for sp in db.scalars(stmt.order_by(SellerProfile.created_at.desc()))
    ]


@router.patch("/sellers/{seller_id}/status", response_model=s.SellerProfileOut)
def review_seller(seller_id: int, body: s.StatusChange, db: Session = Depends(get_db)):
    _need_reason(body)
    sp = db.get(SellerProfile, seller_id)
    if not sp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seller not found")
    sp.status = body.status
    sp.rejection_reason = body.reason if body.status == ReviewStatus.REJECTED else None
    db.commit()
    db.refresh(sp)
    return sp


# ---------- Products ----------


@router.get("/products", response_model=list[s.SellerProductOut])
def products(
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, max_length=100),
):
    stmt = select(Product).options(*PRODUCT_LOAD)
    if status_filter:
        stmt = stmt.where(Product.status == status_filter)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    rows = db.scalars(stmt.order_by(Product.updated_at.desc()).limit(500))
    return [product_out(p, for_seller=True) for p in rows]


@router.patch("/products/{product_id}/status", response_model=s.SellerProductOut)
def review_product(product_id: int, body: s.StatusChange, db: Session = Depends(get_db)):
    _need_reason(body)
    p = db.scalar(select(Product).where(Product.id == product_id).options(*PRODUCT_LOAD))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    p.status = body.status
    p.rejection_reason = body.reason if body.status == ReviewStatus.REJECTED else None
    db.commit()
    db.refresh(p)
    return product_out(p, for_seller=True)


def _product(db: Session, product_id: int) -> Product:
    p = db.scalar(select(Product).where(Product.id == product_id).options(*PRODUCT_LOAD))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return p


def _fresh(db: Session, product_id: int):
    db.expire_all()
    return product_out(_product(db, product_id), for_seller=True)


@router.patch("/products/{product_id}", response_model=s.SellerProductOut)
def edit_product_details(product_id: int, body: s.KeyPointsIn, db: Session = Depends(get_db)):
    """Admins can curate key points on any product (no re-review needed)."""
    p = _product(db, product_id)
    p.key_points = media.clean_key_points(body.key_points)
    db.commit()
    return _fresh(db, product_id)


@router.post("/products/{product_id}/images", response_model=s.SellerProductOut, status_code=201)
async def admin_add_images(
    product_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db)
):
    p = _product(db, product_id)
    await media.add_images(p, files)
    db.commit()
    return _fresh(db, product_id)


@router.delete("/products/{product_id}/images/{image_id}", response_model=s.SellerProductOut)
def admin_remove_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    p = _product(db, product_id)
    key = media.remove_image(p, image_id)
    db.commit()
    media.delete_files(key)
    return _fresh(db, product_id)


@router.put("/products/{product_id}/video", response_model=s.SellerProductOut)
def admin_set_video_link(product_id: int, body: s.VideoLinkIn, db: Session = Depends(get_db)):
    p = _product(db, product_id)
    old = media.set_video_link(p, body.url)
    db.commit()
    media.delete_files(old)
    return _fresh(db, product_id)


@router.post("/products/{product_id}/video/upload", response_model=s.SellerProductOut)
async def admin_upload_video(
    product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    p = _product(db, product_id)
    old = await media.upload_video(p, file)
    db.commit()
    media.delete_files(old)
    return _fresh(db, product_id)


@router.delete("/products/{product_id}/video", response_model=s.SellerProductOut)
def admin_remove_video(product_id: int, db: Session = Depends(get_db)):
    p = _product(db, product_id)
    old = media.remove_video(p)
    db.commit()
    media.delete_files(old)
    return _fresh(db, product_id)


# ---------- Categories ----------


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


@router.get("/categories", response_model=list[s.CategoryOut])
def categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(select(Product.category_id, func.count(Product.id)).group_by(Product.category_id)).all()
    )
    return [
        s.CategoryOut.model_validate(c).model_copy(update={"product_count": counts.get(c.id, 0)})
        for c in db.scalars(select(Category).order_by(Category.name))
    ]


def _unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    clash = db.scalar(
        select(Category).where(
            or_(func.lower(Category.name) == name.lower(), Category.slug == _slug(name)),
            Category.id != (exclude_id or 0),
        )
    )
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "A category with this name already exists")


@router.post("/categories", response_model=s.CategoryOut, status_code=201)
def create_category(body: s.CategoryIn, db: Session = Depends(get_db)):
    name = body.name.strip()
    _unique_name(db, name)
    cat = Category(
        name=name, slug=_slug(name), description=body.description, is_active=body.is_active
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{cat_id}", response_model=s.CategoryOut)
def update_category(cat_id: int, body: s.CategoryIn, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    name = body.name.strip()
    _unique_name(db, name, cat.id)
    cat.name, cat.slug = name, _slug(name)
    cat.description, cat.is_active = body.description, body.is_active
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, cat_id)
    if not cat:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Category not found")
    if db.scalar(select(func.count(Product.id)).where(Product.category_id == cat_id)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This category still has products. Move them or hide the category instead.",
        )
    db.delete(cat)
    db.commit()


# ---------- Organic certifications ----------


@router.get("/certifications", response_model=list[s.OrganicCertOut])
def certifications(
    db: Session = Depends(get_db), status_filter: str | None = Query(None, alias="status")
):
    stmt = select(OrganicCertification).options(selectinload(OrganicCertification.seller))
    if status_filter:
        stmt = stmt.where(OrganicCertification.status == status_filter)
    return [cert_out(c) for c in db.scalars(stmt.order_by(OrganicCertification.created_at.desc()))]


@router.patch("/certifications/{cert_id}", response_model=s.OrganicCertOut)
def review_certification(cert_id: int, body: s.ReviewIn, db: Session = Depends(get_db)):
    if body.status not in REVIEW_CHOICES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid status")
    cert = db.get(OrganicCertification, cert_id)
    if not cert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
    cert.status = body.status
    cert.admin_notes = body.admin_notes
    cert.reviewed_at = datetime.now(UTC)
    db.commit()
    db.refresh(cert)
    return cert_out(cert)


# ---------- GI records ----------


@router.get("/gi-records", response_model=list[s.GIRecordOut])
def gi_records(
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    record_type: str | None = None,
):
    stmt = select(GIRecord).options(
        selectinload(GIRecord.seller), selectinload(GIRecord.reviewed_by)
    )
    if status_filter:
        stmt = stmt.where(GIRecord.verification_status == status_filter)
    if record_type:
        stmt = stmt.where(GIRecord.record_type == record_type)
    return [gi_out(g) for g in db.scalars(stmt.order_by(GIRecord.created_at.desc()))]


class GIReviewIn(BaseModel):
    verification_status: str
    application_status: str | None = None
    admin_notes: str | None = None


@router.patch("/gi-records/{record_id}", response_model=s.GIRecordOut)
def review_gi(
    record_id: int,
    body: GIReviewIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    decision = body.verification_status
    if decision not in GIVerification.__members__.values():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid status")
    notes = (body.admin_notes or "").strip()[:500] or None
    if decision in (GIVerification.REJECTED, GIVerification.INFO_REQUESTED) and not notes:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Please add a note telling the seller what is wrong or what is needed",
        )
    rec = db.get(GIRecord, record_id)
    if not rec:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "GI record not found")
    if decision == GIVerification.VERIFIED and not rec.document_path:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A supporting document is required before this record can be verified. "
            "Request more information from the seller instead.",
        )
    rec.verification_status = decision
    if body.application_status is not None:
        rec.application_status = body.application_status.strip()[:60] or None
    rec.admin_notes = notes
    rec.reviewed_at = datetime.now(UTC)
    rec.reviewed_by_id = admin.id
    db.commit()
    db.refresh(rec)
    return gi_out(rec)


# ---------- Orders ----------


@router.get("/orders", response_model=list[s.OrderOut])
def orders(
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, max_length=50),
):
    stmt = select(Order).options(*ORDER_LOAD)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if q:
        stmt = stmt.where(Order.order_number.ilike(f"%{q}%"))
    return [order_out(o) for o in db.scalars(stmt.order_by(Order.created_at.desc()).limit(500))]


@router.patch("/orders/{order_id}/status", response_model=s.OrderOut)
def set_order_status(order_id: int, body: s.OrderStatusIn, db: Session = Depends(get_db)):
    o = db.scalar(
        select(Order).where(Order.id == order_id).options(*ORDER_LOAD).with_for_update(of=Order)
    )
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    o = change_status(db, o, body.status, as_admin=True)
    if body.payment_status and body.payment_status != o.payment_status:
        o.payment_status = body.payment_status
        db.commit()
        db.refresh(o)
    return order_out(o)


# ---------- Contact messages ----------


@router.get("/messages", response_model=list[s.ContactOut])
def messages(db: Session = Depends(get_db)):
    return db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(200))
