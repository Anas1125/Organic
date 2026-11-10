from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import (
    GI_BADGE_TYPES,
    BuyerType,
    GIVerification,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ReviewStatus,
)


def utcnow() -> datetime:
    return datetime.now(UTC)


Money = Numeric(12, 2)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(10), index=True)
    buyer_type: Mapped[str] = mapped_column(String(12), default=BuyerType.INDIVIDUAL)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # The top admin: the only account that can add or remove other admins.
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    seller_profile: Mapped["SellerProfile | None"] = relationship(
        back_populates="user", uselist=False
    )


class SellerProfile(TimestampMixin, Base):
    __tablename__ = "seller_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    business_name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str | None] = mapped_column(String(80))
    pincode: Mapped[str | None] = mapped_column(String(10))
    phone: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(10), default=ReviewStatus.PENDING, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500))

    user: Mapped[User] = relationship(back_populates="seller_profile")
    products: Mapped[list["Product"]] = relationship(back_populates="seller")


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    slug: Mapped[str] = mapped_column(String(90), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class OrganicCertification(TimestampMixin, Base):
    __tablename__ = "organic_certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="CASCADE"), index=True
    )
    certification_type: Mapped[str] = mapped_column(String(80))
    certification_number: Mapped[str] = mapped_column(String(80))
    issuing_authority: Mapped[str] = mapped_column(String(150))
    issue_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    document_path: Mapped[str | None] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(10), default=ReviewStatus.PENDING, index=True)
    admin_notes: Mapped[str | None] = mapped_column(String(500))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    seller: Mapped[SellerProfile] = relationship()

    @property
    def is_valid(self) -> bool:
        if self.status != ReviewStatus.APPROVED:
            return False
        return self.expiry_date is None or self.expiry_date >= date.today()


class GIRecord(TimestampMixin, Base):
    __tablename__ = "gi_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="CASCADE"), index=True
    )
    record_type: Mapped[str] = mapped_column(String(20))
    gi_product_name: Mapped[str] = mapped_column(String(150))
    registration_number: Mapped[str | None] = mapped_column(String(80))
    geographical_region: Mapped[str] = mapped_column(String(150))
    applicant_association: Mapped[str | None] = mapped_column(String(200))
    application_status: Mapped[str | None] = mapped_column(String(60))
    # Authorised users hold their own number, separate from the GI registration number.
    authorised_user_number: Mapped[str | None] = mapped_column(String(80))
    document_path: Mapped[str | None] = mapped_column(String(300))
    verification_status: Mapped[str] = mapped_column(
        String(20), default=GIVerification.PENDING, index=True
    )
    admin_notes: Mapped[str | None] = mapped_column(String(500))
    seller_notes: Mapped[str | None] = mapped_column(String(500))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    seller: Mapped[SellerProfile] = relationship()
    reviewed_by: Mapped["User | None"] = relationship()

    @property
    def is_valid(self) -> bool:
        """True when this record may show the GI badge on products."""
        return (
            self.verification_status == GIVerification.VERIFIED
            and self.record_type in GI_BADGE_TYPES
        )


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(
        ForeignKey("seller_profiles.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[Decimal] = mapped_column(Money)
    unit: Mapped[str] = mapped_column(String(12))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_order_qty: Mapped[int] = mapped_column(Integer, default=1)
    origin: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(10), default=ReviewStatus.PENDING, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    organic_certification_id: Mapped[int | None] = mapped_column(
        ForeignKey("organic_certifications.id", ondelete="SET NULL")
    )
    gi_record_id: Mapped[int | None] = mapped_column(
        ForeignKey("gi_records.id", ondelete="SET NULL")
    )

    seller: Mapped[SellerProfile] = relationship(back_populates="products")
    category: Mapped[Category] = relationship()
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order"
    )
    price_tiers: Mapped[list["BulkPriceTier"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="BulkPriceTier.min_qty"
    )
    organic_certification: Mapped[OrganicCertification | None] = relationship()
    gi_record: Mapped[GIRecord | None] = relationship()

    @property
    def is_organic_verified(self) -> bool:
        return bool(self.organic_certification and self.organic_certification.is_valid)

    @property
    def is_gi_verified(self) -> bool:
        return bool(self.gi_record and self.gi_record.is_valid)


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(String(300))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="images")


class BulkPriceTier(Base):
    __tablename__ = "bulk_price_tiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    min_qty: Mapped[int] = mapped_column(Integer)
    max_qty: Mapped[int | None] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Money)

    product: Mapped[Product] = relationship(back_populates="price_tiers")


class CartItem(TimestampMixin, Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("buyer_id", "product_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer)

    product: Mapped[Product] = relationship()


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    checkout_ref: Mapped[str] = mapped_column(String(40), index=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("seller_profiles.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default=OrderStatus.PENDING, index=True)
    payment_method: Mapped[str] = mapped_column(String(10), default=PaymentMethod.COD)
    payment_status: Mapped[str] = mapped_column(String(10), default=PaymentStatus.PENDING)
    subtotal: Mapped[Decimal] = mapped_column(Money)
    total: Mapped[Decimal] = mapped_column(Money)
    shipping_name: Mapped[str] = mapped_column(String(120))
    shipping_phone: Mapped[str] = mapped_column(String(20))
    shipping_address: Mapped[str] = mapped_column(String(255))
    shipping_city: Mapped[str] = mapped_column(String(80))
    shipping_state: Mapped[str] = mapped_column(String(80))
    shipping_pincode: Mapped[str] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(String(500))

    buyer: Mapped[User] = relationship()
    seller: Mapped[SellerProfile] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"))
    product_name: Mapped[str] = mapped_column(String(150))
    unit: Mapped[str] = mapped_column(String(12))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Money)
    line_total: Mapped[Decimal] = mapped_column(Money)

    order: Mapped[Order] = relationship(back_populates="items")
    # Only used to show the product's photo; the order keeps its own name and prices.
    product: Mapped["Product | None"] = relationship()


class SiteSettings(Base):
    """Single row (id=1) of brand settings editable from the admin CMS."""

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    site_name: Mapped[str] = mapped_column(String(60), default="Terralens")
    tagline: Mapped[str | None] = mapped_column(String(300))
    logo_path: Mapped[str | None] = mapped_column(String(300))
    # Contact details shown on the Contact page and in the footer (all optional).
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(30))
    contact_hours: Mapped[str | None] = mapped_column(String(120))
    locations: Mapped[list[str] | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StoredFile(Base):
    """Uploaded file contents, for hosts without a lasting disk (STORAGE_BACKEND=database)."""

    __tablename__ = "stored_files"

    key: Mapped[str] = mapped_column(String(300), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
