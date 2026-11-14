from datetime import date

from app import schemas as s
from app.models import GIRecord, Order, OrganicCertification, Product, User
from app.services.product_media import video_out
from app.services.storage import media_url


def user_out(user: User) -> s.UserOut:
    out = s.UserOut.model_validate(user)
    if user.seller_profile:
        out.seller_id = user.seller_profile.id
        out.seller_status = user.seller_profile.status
    return out


def product_out(p: Product, *, for_seller: bool = False) -> s.ProductOut:
    data = dict(
        id=p.id,
        name=p.name,
        description=p.description,
        category=s.CategoryOut.model_validate(p.category),
        seller=s.SellerPublic.model_validate(p.seller),
        price=p.price,
        unit=p.unit,
        stock=p.stock,
        min_order_qty=p.min_order_qty,
        origin=p.origin,
        images=[s.ImageOut(id=i.id, url=media_url(i.path)) for i in p.images],
        video=video_out(p),
        key_points=p.key_points or [],
        price_tiers=[s.TierOut.model_validate(t) for t in p.price_tiers],
        is_organic_verified=p.is_organic_verified,
        is_gi_verified=p.is_gi_verified,
        created_at=p.created_at,
    )
    # Badge details are shown to buyers only once an admin has verified them.
    if p.is_organic_verified:
        c = p.organic_certification
        data["organic"] = s.OrganicBadge(
            certification_type=c.certification_type,
            certification_number=c.certification_number,
            issuing_authority=c.issuing_authority,
            expiry_date=c.expiry_date,
        )
    if p.is_gi_verified:
        g = p.gi_record
        data["gi"] = s.GIBadge(
            gi_product_name=g.gi_product_name,
            registration_number=g.registration_number,
            geographical_region=g.geographical_region,
            record_type=g.record_type,
        )
    if for_seller:
        return s.SellerProductOut(
            **data,
            status=p.status,
            rejection_reason=p.rejection_reason,
            is_active=p.is_active,
            organic_certification_id=p.organic_certification_id,
            gi_record_id=p.gi_record_id,
            updated_at=p.updated_at,
        )
    return s.ProductOut(**data)


def cert_out(c: OrganicCertification) -> s.OrganicCertOut:
    return s.OrganicCertOut.model_validate(
        {
            **{k: getattr(c, k) for k in s.OrganicCertOut.model_fields if hasattr(c, k)},
            "has_document": bool(c.document_path),
            "seller_name": c.seller.business_name if c.seller else None,
            "is_expired": bool(c.expiry_date and c.expiry_date < date.today()),
        }
    )


def gi_out(g: GIRecord) -> s.GIRecordOut:
    return s.GIRecordOut.model_validate(
        {
            **{k: getattr(g, k) for k in s.GIRecordOut.model_fields if hasattr(g, k)},
            "has_document": bool(g.document_path),
            "seller_name": g.seller.business_name if g.seller else None,
            "reviewed_by_name": g.reviewed_by.full_name if g.reviewed_by else None,
            "can_show_badge": g.is_valid,
        }
    )


def order_out(o: Order) -> s.OrderOut:
    out = s.OrderOut.model_validate(o)
    out.buyer_name = o.buyer.full_name
    out.buyer_email = o.buyer.email
    for item_out, item in zip(out.items, o.items):
        if item.product and item.product.images:
            first = min(item.product.images, key=lambda im: im.sort_order)
            item_out.image = media_url(first.path)
    return out
