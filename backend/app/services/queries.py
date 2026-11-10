from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models import Category, Product, SellerProfile, User
from app.models.enums import ReviewStatus

PRODUCT_LOAD = (
    selectinload(Product.images),
    selectinload(Product.price_tiers),
    selectinload(Product.category),
    selectinload(Product.seller),
    selectinload(Product.organic_certification),
    selectinload(Product.gi_record),
)


def visible_products():
    """Products a buyer may see: approved, active, from an approved and active seller."""
    return (
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .join(User, SellerProfile.user_id == User.id)
        .join(Category, Product.category_id == Category.id)
        .where(
            Product.status == ReviewStatus.APPROVED,
            Product.is_active.is_(True),
            SellerProfile.status == ReviewStatus.APPROVED,
            User.is_active.is_(True),
            Category.is_active.is_(True),
        )
    )
