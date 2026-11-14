"""Public, no-login endpoints: categories, products, seller storefronts, contact form."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app import schemas as s
from app.db import get_db
from app.models import (
    Category,
    ContactMessage,
    GIRecord,
    OrganicCertification,
    Product,
    SellerProfile,
)
from app.models.enums import GI_BADGE_TYPES, GIVerification, ReviewStatus
from app.services.queries import PRODUCT_LOAD, visible_products
from app.services.serializers import product_out
from app.services.storage import media_url

router = APIRouter(tags=["Catalogue"])

@router.get("/categories", response_model=list[s.CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    counts = dict(
        db.execute(
            visible_products()
            .with_only_columns(Product.category_id, func.count(Product.id))
            .group_by(Product.category_id)
        ).all()
    )
    cats = db.scalars(select(Category).where(Category.is_active.is_(True)).order_by(Category.name))
    return [
        s.CategoryOut.model_validate(c).model_copy(update={"product_count": counts.get(c.id, 0)})
        for c in cats
    ]


@router.get("/products", response_model=s.Page[s.ProductOut])
def list_products(
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=100),
    category: str | None = Query(None, description="Category slug"),
    seller_id: int | None = None,
    organic: bool = False,
    gi: bool = False,
    bulk: bool = Query(False, description="Only products with bulk pricing"),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    district: str | None = Query(None, max_length=60, description="GI district, e.g. Thanjavur"),
    sort: Literal["newest", "price_asc", "price_desc", "name"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
):
    stmt = visible_products()
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name.ilike(like),
                Product.description.ilike(like),
                Product.origin.ilike(like),
                SellerProfile.business_name.ilike(like),
            )
        )
    if category:
        stmt = stmt.where(Category.slug == category)
    if seller_id:
        stmt = stmt.where(Product.seller_id == seller_id)
    if organic:
        stmt = stmt.join(
            OrganicCertification, Product.organic_certification_id == OrganicCertification.id
        ).where(
            OrganicCertification.status == ReviewStatus.APPROVED,
            or_(
                OrganicCertification.expiry_date.is_(None),
                OrganicCertification.expiry_date >= func.current_date(),
            ),
        )
    if gi:
        stmt = stmt.join(GIRecord, Product.gi_record_id == GIRecord.id).where(
            GIRecord.verification_status == GIVerification.VERIFIED,
            GIRecord.record_type.in_(GI_BADGE_TYPES),
        )
    if district:
        stmt = stmt.where(
            Product.gi_record.has(GIRecord.geographical_region.ilike(f"{district.strip()} district%"))
        )
    if bulk:
        stmt = stmt.where(Product.price_tiers.any())
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)

    total = db.scalar(stmt.with_only_columns(func.count(Product.id)).order_by(None))
    order = {
        "newest": Product.created_at.desc(),
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "name": Product.name.asc(),
    }[sort]
    rows = db.scalars(
        stmt.options(*PRODUCT_LOAD)
        .order_by(order, Product.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return s.Page(
        items=[product_out(p) for p in rows], total=total, page=page, page_size=page_size
    )


@router.get("/products/districts")
def districts(db: Session = Depends(get_db)):
    """Districts that have listed GI products, with how many products each has."""
    rows = db.execute(
        visible_products()
        .join(GIRecord, Product.gi_record_id == GIRecord.id)
        .with_only_columns(GIRecord.geographical_region, func.count(Product.id))
        .group_by(GIRecord.geographical_region)
        .order_by(None)
    ).all()
    counts: dict[str, int] = {}
    for region, n in rows:
        name, sep, _ = region.partition(" district")
        if sep:  # only regions written as "<name> district, <state>"
            counts[name.strip()] = counts.get(name.strip(), 0) + n
    return [{"name": k, "product_count": v} for k, v in sorted(counts.items())]


@router.get("/products/suggest")
def suggest(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(6, ge=1, le=10),
    db: Session = Depends(get_db),
):
    """Lightweight type-ahead results for the search box."""
    term = q.strip()
    if not term:
        return {"products": [], "categories": []}
    like = f"%{term}%"
    # Names that start with the typed text first, then names containing it,
    # then matches on origin or seller name.
    rank = case(
        (Product.name.ilike(f"{term}%"), 0),
        (Product.name.ilike(like), 1),
        else_=2,
    )
    rows = db.scalars(
        visible_products()
        .where(
            or_(
                Product.name.ilike(like),
                Product.origin.ilike(like),
                SellerProfile.business_name.ilike(like),
            )
        )
        .options(*PRODUCT_LOAD)
        .order_by(rank, Product.name)
        .limit(limit)
    ).all()
    cats = db.scalars(
        select(Category)
        .where(Category.is_active.is_(True), Category.name.ilike(like))
        .order_by(Category.name)
        .limit(3)
    ).all()
    return {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "price": p.price,
                "unit": p.unit,
                "image": media_url(p.images[0].path) if p.images else None,
                "category_slug": p.category.slug,
                "seller": p.seller.business_name,
                "is_organic_verified": p.is_organic_verified,
                "is_gi_verified": p.is_gi_verified,
            }
            for p in rows
        ],
        "categories": [{"name": c.name, "slug": c.slug} for c in cats],
    }


@router.get("/products/{product_id}", response_model=s.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.scalar(visible_products().where(Product.id == product_id).options(*PRODUCT_LOAD))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return product_out(p)


@router.get("/sellers/{seller_id}", response_model=s.SellerStorefront)
def get_seller(seller_id: int, db: Session = Depends(get_db)):
    seller = db.get(SellerProfile, seller_id)
    if not seller or seller.status != ReviewStatus.APPROVED or not seller.user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seller not found")
    products = db.scalars(
        visible_products()
        .where(Product.seller_id == seller_id)
        .options(*PRODUCT_LOAD)
        .order_by(Product.created_at.desc())
    ).all()
    return s.SellerStorefront(
        seller=s.SellerPublic.model_validate(seller),
        products=[product_out(p) for p in products],
        verified_organic=sum(p.is_organic_verified for p in products),
        verified_gi=sum(p.is_gi_verified for p in products),
    )


@router.post("/contact", response_model=s.Message, status_code=201)
def contact(body: s.ContactIn, db: Session = Depends(get_db)):
    db.add(ContactMessage(**body.model_dump()))
    db.commit()
    return s.Message(detail="Thanks! We'll get back to you soon.")
