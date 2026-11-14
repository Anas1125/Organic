"""Seller dashboard API. Every query is scoped to the logged-in seller's own data."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas as s
from app.core.deps import get_approved_seller, get_current_seller
from app.db import get_db
from app.models import (
    BulkPriceTier,
    Category,
    GIRecord,
    Order,
    OrderItem,
    OrganicCertification,
    Product,
    ProductImage,
    SellerProfile,
)
from app.models.enums import GIRecordType, GIVerification, OrderStatus, ReviewStatus
from app.services.orders import ORDER_LOAD, change_status
from app.services.pricing import validate_tiers
from app.services.queries import PRODUCT_LOAD
from app.services.serializers import cert_out, gi_out, order_out, product_out
from app.services import product_media as media
from app.services.storage import get_storage, save_upload

router = APIRouter(prefix="/seller", tags=["Seller"])

MAX_IMAGES = media.MAX_IMAGES
# Changing these on an approved product sends it back for admin review.
REVIEWED_FIELDS = {
    "name",
    "description",
    "category_id",
    "unit",
    "origin",
    "organic_certification_id",
    "gi_record_id",
}
NOT_NULL_FIELDS = {"name", "description", "category_id", "price", "unit", "stock", "min_order_qty", "is_active"}


# ---------- Profile ----------


@router.get("/profile", response_model=s.SellerProfileOut)
def get_profile(seller: SellerProfile = Depends(get_current_seller)):
    return seller


@router.put("/profile", response_model=s.SellerProfileOut)
def update_profile(
    body: s.SellerProfileIn,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    for k, v in body.model_dump().items():
        setattr(seller, k, v)
    # A rejected seller who fixes their details goes back into the review queue.
    if seller.status == ReviewStatus.REJECTED:
        seller.status = ReviewStatus.PENDING
        seller.rejection_reason = None
    db.commit()
    db.refresh(seller)
    return seller


# ---------- Products ----------


def _own_product(db: Session, seller: SellerProfile, product_id: int) -> Product:
    p = db.scalar(
        select(Product)
        .where(Product.id == product_id, Product.seller_id == seller.id)
        .options(*PRODUCT_LOAD)
    )
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return p


def _check_links(db: Session, seller: SellerProfile, cat_id, cert_id, gi_id) -> None:
    if cat_id is not None:
        cat = db.get(Category, cat_id)
        if not cat or not cat.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid category")
    if cert_id is not None:
        cert = db.get(OrganicCertification, cert_id)
        if not cert or cert.seller_id != seller.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "Organic certificate not found"
            )
    if gi_id is not None:
        gi = db.get(GIRecord, gi_id)
        if not gi or gi.seller_id != seller.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "GI record not found")


@router.get("/products", response_model=list[s.SellerProductOut])
def my_products(
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None, max_length=100),
):
    stmt = select(Product).where(Product.seller_id == seller.id).options(*PRODUCT_LOAD)
    if status_filter:
        stmt = stmt.where(Product.status == status_filter)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    rows = db.scalars(stmt.order_by(Product.updated_at.desc())).all()
    return [product_out(p, for_seller=True) for p in rows]


@router.get("/products/{product_id}", response_model=s.SellerProductOut)
def my_product(
    product_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    return product_out(_own_product(db, seller, product_id), for_seller=True)


@router.post("/products", response_model=s.SellerProductOut, status_code=201)
def create_product(
    body: s.ProductIn,
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    _check_links(db, seller, body.category_id, body.organic_certification_id, body.gi_record_id)
    tiers = [t.model_dump() for t in body.price_tiers]
    validate_tiers(tiers)
    p = Product(
        seller_id=seller.id,
        status=ReviewStatus.PENDING,
        **body.model_dump(exclude={"price_tiers", "key_points"}),
        key_points=media.clean_key_points(body.key_points),
    )
    p.price_tiers = [BulkPriceTier(**t) for t in tiers]
    db.add(p)
    db.commit()
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.patch("/products/{product_id}", response_model=s.SellerProductOut)
def update_product(
    product_id: int,
    body: s.ProductUpdate,
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    changes = body.model_dump(exclude_unset=True)
    _check_links(
        db,
        seller,
        changes.get("category_id"),
        changes.get("organic_certification_id"),
        changes.get("gi_record_id"),
    )

    if "key_points" in changes:
        p.key_points = media.clean_key_points(changes.pop("key_points"))

    if "price_tiers" in changes:
        tiers = changes.pop("price_tiers") or []
        validate_tiers(tiers)
        p.price_tiers = [BulkPriceTier(**t) for t in tiers]

    needs_review = any(k in REVIEWED_FIELDS and getattr(p, k) != v for k, v in changes.items())
    for k, v in changes.items():
        if v is None and k in NOT_NULL_FIELDS:
            continue  # only the optional links / origin can be cleared
        setattr(p, k, v)
    if needs_review and p.status != ReviewStatus.PENDING:
        p.status = ReviewStatus.PENDING
        p.rejection_reason = None
    if p.status == ReviewStatus.REJECTED and changes:
        p.status = ReviewStatus.PENDING
        p.rejection_reason = None
    db.commit()
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    keys = [img.path for img in p.images] + [media.remove_video(p)]
    db.delete(p)  # order history keeps its own copy of the product name and price
    db.commit()
    media.delete_files(*keys)


@router.post("/products/{product_id}/images", response_model=s.SellerProductOut, status_code=201)
async def upload_images(
    product_id: int,
    files: list[UploadFile] = File(...),
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    await media.add_images(p, files)
    db.commit()
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.delete("/products/{product_id}/images/{image_id}", response_model=s.SellerProductOut)
def delete_image(
    product_id: int,
    image_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    key = media.remove_image(p, image_id)
    db.commit()
    media.delete_files(key)
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.put("/products/{product_id}/video", response_model=s.SellerProductOut)
def set_video_link(
    product_id: int,
    body: s.VideoLinkIn,
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    old = media.set_video_link(p, body.url)
    db.commit()
    media.delete_files(old)
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.post("/products/{product_id}/video/upload", response_model=s.SellerProductOut)
async def upload_video(
    product_id: int,
    file: UploadFile = File(...),
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    old = await media.upload_video(p, file)
    db.commit()
    media.delete_files(old)
    return product_out(_own_product(db, seller, p.id), for_seller=True)


@router.post("/products/{product_id}/video/chunk", response_model=s.ChunkUploadOut)
async def upload_video_chunk(
    product_id: int,
    upload_id: str = Form(...),
    index: int = Form(...),
    total: int = Form(...),
    content_type: str = Form(...),
    chunk: UploadFile = File(...),
    seller: SellerProfile = Depends(get_approved_seller),
    db: Session = Depends(get_db),
):
    """Videos up to 20 MB, sent in 3 MB pieces (Vercel limits each request to 4.5 MB)."""
    p = _own_product(db, seller, product_id)
    done, old = await media.upload_video_chunk(p, upload_id, index, total, content_type, chunk)
    if not done:
        return s.ChunkUploadOut(done=False)
    db.commit()
    media.delete_files(old)
    return s.ChunkUploadOut(done=True, product=product_out(_own_product(db, seller, p.id), for_seller=True))


@router.delete("/products/{product_id}/video", response_model=s.SellerProductOut)
def delete_video(
    product_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    p = _own_product(db, seller, product_id)
    old = media.remove_video(p)
    db.commit()
    media.delete_files(old)
    return product_out(_own_product(db, seller, p.id), for_seller=True)


# ---------- Orders ----------


@router.get("/orders", response_model=list[s.OrderOut])
def my_orders(
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(None, alias="status"),
):
    stmt = select(Order).where(Order.seller_id == seller.id).options(*ORDER_LOAD)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    return [order_out(o) for o in db.scalars(stmt.order_by(Order.created_at.desc()))]


@router.get("/orders/{order_id}", response_model=s.OrderOut)
def my_order(
    order_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    o = db.scalar(
        select(Order).where(Order.id == order_id, Order.seller_id == seller.id).options(*ORDER_LOAD)
    )
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order_out(o)


@router.patch("/orders/{order_id}/status", response_model=s.OrderOut)
def update_order_status(
    order_id: int,
    body: s.OrderStatusIn,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    o = db.scalar(
        select(Order)
        .where(Order.id == order_id, Order.seller_id == seller.id)
        .options(*ORDER_LOAD)
        .with_for_update(of=Order)
    )
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return order_out(change_status(db, o, body.status, as_admin=False))


# ---------- Stats ----------


@router.get("/stats")
def my_stats(seller: SellerProfile = Depends(get_current_seller), db: Session = Depends(get_db)):
    live = Order.status != OrderStatus.CANCELLED
    by_status = dict(
        db.execute(
            select(Order.status, func.count(Order.id))
            .where(Order.seller_id == seller.id)
            .group_by(Order.status)
        ).all()
    )
    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(Order.seller_id == seller.id, live)
    )
    delivered_revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.seller_id == seller.id, Order.status == OrderStatus.DELIVERED
        )
    )
    month = func.date_trunc("month", Order.created_at)
    monthly = db.execute(
        select(month, func.sum(Order.total), func.count(Order.id))
        .where(Order.seller_id == seller.id, live)
        .group_by(month)
        .order_by(month.desc())
        .limit(6)
    ).all()
    top = db.execute(
        select(OrderItem.product_name, func.sum(OrderItem.quantity), func.sum(OrderItem.line_total))
        .join(Order)
        .where(Order.seller_id == seller.id, live)
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(5)
    ).all()
    products_by_status = dict(
        db.execute(
            select(Product.status, func.count(Product.id))
            .where(Product.seller_id == seller.id)
            .group_by(Product.status)
        ).all()
    )
    low_stock = db.scalar(
        select(func.count(Product.id)).where(
            Product.seller_id == seller.id, Product.stock < Product.min_order_qty * 5
        )
    )
    return {
        "orders_by_status": by_status,
        "total_orders": sum(by_status.values()),
        "revenue": Decimal(revenue),
        "delivered_revenue": Decimal(delivered_revenue),
        "monthly": [
            {"month": m.strftime("%b %Y"), "revenue": Decimal(r), "orders": c}
            for m, r, c in reversed(monthly)
        ],
        "top_products": [
            {"name": n, "quantity": int(q), "revenue": Decimal(r)} for n, q, r in top
        ],
        "products_by_status": products_by_status,
        "low_stock": low_stock,
    }


# ---------- Organic certifications ----------


def _parse_date(v: str | None, label: str) -> date | None:
    if not v:
        return None
    try:
        return date.fromisoformat(v)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Invalid {label}") from None


def _required(v: str, label: str, max_len: int) -> str:
    v = (v or "").strip()
    if not v or len(v) > max_len:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"{label} is required (max {max_len} chars)"
        )
    return v


@router.get("/certifications", response_model=list[s.OrganicCertOut])
def my_certs(seller: SellerProfile = Depends(get_current_seller), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(OrganicCertification)
        .where(OrganicCertification.seller_id == seller.id)
        .order_by(OrganicCertification.created_at.desc())
    )
    return [cert_out(c) for c in rows]


@router.post("/certifications", response_model=s.OrganicCertOut, status_code=201)
async def add_cert(
    certification_type: str = Form(...),
    certification_number: str = Form(...),
    issuing_authority: str = Form(...),
    issue_date: str | None = Form(None),
    expiry_date: str | None = Form(None),
    document: UploadFile = File(...),
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    issued = _parse_date(issue_date, "issue date")
    expires = _parse_date(expiry_date, "expiry date")
    if issued and expires and expires < issued:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Expiry date must be after issue date"
        )
    cert = OrganicCertification(
        seller_id=seller.id,
        certification_type=_required(certification_type, "Certification type", 80),
        certification_number=_required(certification_number, "Certification number", 80),
        issuing_authority=_required(issuing_authority, "Issuing authority", 150),
        issue_date=issued,
        expiry_date=expires,
        status=ReviewStatus.PENDING,
    )
    cert.document_path = await save_upload(document, f"documents/organic/{seller.id}", kind="document")
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return cert_out(cert)


@router.delete("/certifications/{cert_id}", status_code=204)
def delete_cert(
    cert_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    cert = db.get(OrganicCertification, cert_id)
    if not cert or cert.seller_id != seller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
    key = cert.document_path
    db.delete(cert)  # linked products lose the organic badge (FK set null)
    db.commit()
    if key:
        get_storage().delete(key)


# ---------- GI records ----------


@router.get("/gi-records", response_model=list[s.GIRecordOut])
def my_gi(seller: SellerProfile = Depends(get_current_seller), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(GIRecord).where(GIRecord.seller_id == seller.id).order_by(GIRecord.created_at.desc())
    )
    return [gi_out(g) for g in rows]


def _clean(v: str | None, max_len: int) -> str | None:
    return (v or "").strip()[:max_len] or None


def _apply_gi_fields(rec: GIRecord, **f) -> None:
    """Validate and set GI fields. The numbers required depend on the record type."""
    if f["record_type"] not in GIRecordType.__members__.values():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid GI record type")
    rec.record_type = f["record_type"]
    rec.gi_product_name = _required(f["gi_product_name"], "GI product name", 150)
    rec.geographical_region = _required(f["geographical_region"], "Geographical region", 150)
    rec.registration_number = _clean(f["registration_number"], 80)
    rec.applicant_association = _clean(f["applicant_association"], 200)
    rec.application_status = _clean(f["application_status"], 60)
    rec.authorised_user_number = (
        _clean(f["authorised_user_number"], 80)
        if rec.record_type == GIRecordType.AUTHORISED_USER
        else None
    )
    if not rec.registration_number:
        label = (
            "GI application number"
            if rec.record_type == GIRecordType.APPLICATION
            else "GI registration number"
        )
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{label} is required")
    if rec.record_type == GIRecordType.AUTHORISED_USER and not rec.authorised_user_number:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Authorised user registration number is required"
        )


@router.post("/gi-records", response_model=s.GIRecordOut, status_code=201)
async def add_gi(
    record_type: str = Form(...),
    gi_product_name: str = Form(...),
    geographical_region: str = Form(...),
    registration_number: str | None = Form(None),
    applicant_association: str | None = Form(None),
    application_status: str | None = Form(None),
    authorised_user_number: str | None = Form(None),
    document: UploadFile | None = File(None),
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    rec = GIRecord(seller_id=seller.id, verification_status=GIVerification.PENDING)
    _apply_gi_fields(
        rec,
        record_type=record_type,
        gi_product_name=gi_product_name,
        geographical_region=geographical_region,
        registration_number=registration_number,
        applicant_association=applicant_association,
        application_status=application_status,
        authorised_user_number=authorised_user_number,
    )
    if document and document.filename:
        rec.document_path = await save_upload(document, f"documents/gi/{seller.id}", kind="document")
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return gi_out(rec)


@router.put("/gi-records/{record_id}", response_model=s.GIRecordOut)
async def update_gi(
    record_id: int,
    record_type: str = Form(...),
    gi_product_name: str = Form(...),
    geographical_region: str = Form(...),
    registration_number: str | None = Form(None),
    applicant_association: str | None = Form(None),
    application_status: str | None = Form(None),
    authorised_user_number: str | None = Form(None),
    seller_notes: str | None = Form(None),
    document: UploadFile | None = File(None),
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    """Edit a GI record (e.g. after the admin asked for more information).

    Any change sends the record back to 'pending' so a verified badge can never
    survive an unreviewed edit.
    """
    rec = db.get(GIRecord, record_id)
    if not rec or rec.seller_id != seller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "GI record not found")
    _apply_gi_fields(
        rec,
        record_type=record_type,
        gi_product_name=gi_product_name,
        geographical_region=geographical_region,
        registration_number=registration_number,
        applicant_association=applicant_association,
        application_status=application_status,
        authorised_user_number=authorised_user_number,
    )
    rec.seller_notes = _clean(seller_notes, 500)
    old_key = None
    if document and document.filename:
        old_key = rec.document_path
        rec.document_path = await save_upload(document, f"documents/gi/{seller.id}", kind="document")
    rec.verification_status = GIVerification.PENDING
    db.commit()
    db.refresh(rec)
    if old_key:
        get_storage().delete(old_key)
    return gi_out(rec)


@router.delete("/gi-records/{record_id}", status_code=204)
def delete_gi(
    record_id: int,
    seller: SellerProfile = Depends(get_current_seller),
    db: Session = Depends(get_db),
):
    rec = db.get(GIRecord, record_id)
    if not rec or rec.seller_id != seller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "GI record not found")
    key = rec.document_path
    db.delete(rec)
    db.commit()
    if key:
        get_storage().delete(key)
