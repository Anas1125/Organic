import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.enums import UNITS


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    detail: str


# ---------- Auth & users ----------


class SellerRegistration(BaseModel):
    business_name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    pincode: str | None = Field(default=None, pattern=r"^\d{6}$")


def _phone(v: str) -> str:
    """Check a mobile number and store it in one format.
    Indian numbers: 10 digits starting 6–9 (with or without +91 / 0) -> "+91 98765 43210".
    Other countries: + and 8–15 digits."""
    raw = re.sub(r"[\s\-().]", "", v or "")
    digits = raw.lstrip("+")
    if not digits.isdigit():
        raise ValueError("Enter a valid mobile number (digits only)")
    if raw.startswith("+") and not raw.startswith("+91"):
        if 8 <= len(digits) <= 15:
            return raw
        raise ValueError("Enter a valid mobile number with country code")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit mobile number")
    return f"+91 {digits[:5]} {digits[5:]}"


# A mobile number, checked and tidied (see _phone).
Phone = Annotated[str, AfterValidator(_phone)]


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    phone: Phone  # required: the team calls buyers and sellers about enquiries
    role: Literal["buyer", "seller"]
    buyer_type: Literal["individual", "wholesale"] = "individual"
    seller: SellerRegistration | None = None


class LoginIn(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=128)
    remember: bool = False
    device_token: str | None = Field(default=None, max_length=200)


class ForgotPasswordIn(BaseModel):
    email: str = Field(max_length=255)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    phone: str | None
    role: str
    buyer_type: str
    is_active: bool
    is_owner: bool = False
    created_at: datetime
    seller_id: int | None = None
    seller_status: str | None = None


class MeUpdateOut(UserOut):
    access_token: str | None = None  # new login for this device after a password change


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AuthOut(BaseModel):
    """Either a login (access_token + user) or a request to enter the emailed code."""

    access_token: str | None = None
    token_type: str = "bearer"
    user: UserOut | None = None
    otp_required: bool = False
    challenge: str | None = None  # pass back with the code
    email_hint: str | None = None  # e.g. "ar•••@gmail.com"
    device_token: str | None = None  # "Remember me": skips the code on this browser next time


class OtpVerifyIn(BaseModel):
    challenge: str = Field(max_length=1000)
    code: str = Field(pattern=r"^\d{6}$")
    remember: bool = False


class OtpResendIn(BaseModel):
    challenge: str = Field(max_length=1000)


class UserUpdate(BaseModel):
    email: EmailStr | None = None  # needs current_password
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: Phone | None = None  # can be changed, not removed
    buyer_type: Literal["individual", "wholesale"] | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class PasswordSet(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AdminCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


# ---------- Sellers ----------


class SellerProfileIn(SellerRegistration):
    phone: Phone  # required: the team calls sellers to agree each enquiry


class SellerProfileOut(ORM):
    id: int
    user_id: int
    business_name: str
    description: str | None
    address: str | None
    city: str | None
    state: str | None
    pincode: str | None
    phone: str | None
    status: str
    rejection_reason: str | None
    created_at: datetime


class SellerPublic(ORM):
    id: int
    business_name: str
    description: str | None
    city: str | None
    state: str | None
    created_at: datetime


class AdminSellerOut(SellerProfileOut):
    owner_name: str
    owner_email: str
    product_count: int = 0


# ---------- Categories ----------


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True


class CategoryOut(ORM):
    id: int
    name: str
    slug: str
    description: str | None
    is_active: bool
    product_count: int = 0
    image: str | None = None  # a photo of one of its products, for category tiles


# ---------- Products ----------


class TierIn(BaseModel):
    min_qty: int = Field(ge=1)
    max_qty: int | None = Field(default=None, ge=1)
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class TierOut(ORM):
    id: int
    min_qty: int
    max_qty: int | None
    unit_price: Decimal


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str = Field(default="", max_length=5000)
    category_id: int
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    unit: str
    stock: int = Field(ge=0, le=10_000_000)
    min_order_qty: int = Field(default=1, ge=1)
    origin: str | None = Field(default=None, max_length=150)
    is_active: bool = True
    organic_certification_id: int | None = None
    gi_record_id: int | None = None
    price_tiers: list[TierIn] = Field(default_factory=list, max_length=10)
    key_points: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("unit")
    @classmethod
    def valid_unit(cls, v: str) -> str:
        if v not in UNITS:
            raise ValueError(f"Unit must be one of: {', '.join(UNITS)}")
        return v


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    category_id: int | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    unit: str | None = None
    stock: int | None = Field(default=None, ge=0, le=10_000_000)
    min_order_qty: int | None = Field(default=None, ge=1)
    origin: str | None = Field(default=None, max_length=150)
    is_active: bool | None = None
    organic_certification_id: int | None = None
    gi_record_id: int | None = None
    price_tiers: list[TierIn] | None = Field(default=None, max_length=10)
    key_points: list[str] | None = Field(default=None, max_length=8)

    @field_validator("unit")
    @classmethod
    def valid_unit(cls, v: str | None) -> str | None:
        if v is not None and v not in UNITS:
            raise ValueError(f"Unit must be one of: {', '.join(UNITS)}")
        return v


class ImageOut(BaseModel):
    id: int
    url: str


class VideoOut(BaseModel):
    url: str
    kind: Literal["youtube", "vimeo", "file"]
    embed_url: str | None = None  # for YouTube / Vimeo players
    thumbnail: str | None = None


class VideoLinkIn(BaseModel):
    url: str = Field(min_length=10, max_length=500)


class KeyPointsIn(BaseModel):
    key_points: list[str] = Field(default_factory=list, max_length=8)


class OrganicBadge(BaseModel):
    certification_type: str
    certification_number: str
    issuing_authority: str
    expiry_date: date | None


class GIBadge(BaseModel):
    gi_product_name: str
    registration_number: str | None
    geographical_region: str
    record_type: str


class ProductOut(BaseModel):
    id: int
    name: str
    description: str
    category: CategoryOut
    seller: SellerPublic
    price: Decimal
    unit: str
    stock: int
    min_order_qty: int
    origin: str | None
    images: list[ImageOut]
    video: VideoOut | None = None
    key_points: list[str] = []
    price_tiers: list[TierOut]
    is_organic_verified: bool
    is_gi_verified: bool
    organic: OrganicBadge | None = None
    gi: GIBadge | None = None
    created_at: datetime


class SellerProductOut(ProductOut):
    status: str
    rejection_reason: str | None
    is_active: bool
    organic_certification_id: int | None
    gi_record_id: int | None
    updated_at: datetime


class ChunkUploadOut(BaseModel):
    done: bool
    product: SellerProductOut | None = None


class SellerStorefront(BaseModel):
    seller: SellerPublic
    products: list[ProductOut]
    verified_organic: int
    verified_gi: int


class StatusChange(BaseModel):
    status: str
    reason: str | None = Field(default=None, max_length=500)


# ---------- Certifications & GI ----------


class OrganicCertOut(ORM):
    id: int
    seller_id: int
    certification_type: str
    certification_number: str
    issuing_authority: str
    issue_date: date | None
    expiry_date: date | None
    has_document: bool
    status: str
    admin_notes: str | None
    reviewed_at: datetime | None
    created_at: datetime
    seller_name: str | None = None
    is_expired: bool = False


class GIRecordOut(ORM):
    id: int
    seller_id: int
    record_type: str
    gi_product_name: str
    registration_number: str | None
    geographical_region: str
    applicant_association: str | None
    application_status: str | None
    authorised_user_number: str | None
    has_document: bool
    verification_status: str
    admin_notes: str | None
    seller_notes: str | None
    reviewed_at: datetime | None
    reviewed_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
    seller_name: str | None = None
    can_show_badge: bool = False


class ReviewIn(BaseModel):
    status: str
    admin_notes: str | None = Field(default=None, max_length=500)


# ---------- Cart & orders ----------


class CartAdd(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=1_000_000)


class CartQty(BaseModel):
    quantity: int = Field(ge=1, le=1_000_000)


class CartItemOut(BaseModel):
    id: int
    product: ProductOut
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    savings: Decimal
    problem: str | None = None


class CartSellerGroup(BaseModel):
    seller: SellerPublic
    items: list[CartItemOut]
    subtotal: Decimal


class CartOut(BaseModel):
    groups: list[CartSellerGroup]
    item_count: int
    subtotal: Decimal
    total: Decimal
    can_checkout: bool


class CheckoutIn(BaseModel):
    shipping_name: str = Field(min_length=2, max_length=120)
    shipping_phone: str = Field(pattern=r"^[0-9+\- ]{7,20}$")
    shipping_address: str = Field(min_length=5, max_length=255)
    shipping_city: str = Field(min_length=2, max_length=80)
    shipping_state: str = Field(min_length=2, max_length=80)
    shipping_pincode: str = Field(pattern=r"^\d{6}$")
    notes: str | None = Field(default=None, max_length=500)
    payment_method: Literal["cod", "online"] = "cod"


class AddressIn(BaseModel):
    label: str | None = Field(default=None, max_length=40)
    shipping_name: str = Field(min_length=2, max_length=120)
    shipping_phone: str = Field(pattern=r"^[0-9+\- ]{7,20}$")
    shipping_address: str = Field(min_length=5, max_length=255)
    shipping_city: str = Field(min_length=2, max_length=80)
    shipping_state: str = Field(min_length=2, max_length=80)
    shipping_pincode: str = Field(pattern=r"^\d{6}$")
    is_default: bool = False


class AddressOut(ORM):
    id: int
    label: str | None
    shipping_name: str
    shipping_phone: str
    shipping_address: str
    shipping_city: str
    shipping_state: str
    shipping_pincode: str
    is_default: bool


class PaymentVerifyIn(BaseModel):
    razorpay_order_id: str = Field(max_length=40)
    razorpay_payment_id: str = Field(max_length=40)
    razorpay_signature: str = Field(max_length=128)


class PaymentFailedIn(BaseModel):
    razorpay_order_id: str = Field(max_length=40)
    reason: str | None = Field(default=None, max_length=300)


class PaymentStartOut(BaseModel):
    key_id: str
    razorpay_order_id: str
    amount: int  # paise
    currency: str
    checkout_ref: str
    order_numbers: list[str]
    name: str
    email: str
    contact: str
    expires_at: str


class OrderItemOut(ORM):
    id: int
    product_id: int | None
    product_name: str
    unit: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal
    image: str | None = None  # product's first photo, if the product still exists


class OrderOut(ORM):
    id: int
    order_number: str
    checkout_ref: str
    status: str
    payment_method: str
    payment_status: str
    refund_id: str | None = None
    refunded_at: datetime | None = None
    refund_error: str | None = None
    courier: str | None = None
    tracking_number: str | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None
    auto_delivery_on: datetime | None = None  # when a shipped order will be marked delivered
    subtotal: Decimal
    total: Decimal
    shipping_name: str
    shipping_phone: str
    shipping_address: str
    shipping_city: str
    shipping_state: str
    shipping_pincode: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut]
    seller: SellerPublic
    buyer_name: str | None = None
    buyer_email: str | None = None
    commission_rate: Decimal | None = None
    approved_at: datetime | None = None
    accepted_at: datetime | None = None
    decline_reason: str | None = None
    seller_response: str | None = None
    answer_by: datetime | None = None  # offer auto-cancels if the seller hasn't answered by then
    # Pay on delivery to the marketplace
    pay_to_marketplace: bool = False
    cod_reference: str | None = None
    cod_claimed_at: datetime | None = None
    pay_upi: str | None = None
    pay_payee: str | None = None
    # Admin only: who to call about an enquiry.
    buyer_phone: str | None = None
    buyer_type: str | None = None
    seller_owner: str | None = None
    seller_email: str | None = None
    seller_phone: str | None = None


class CodPaidIn(BaseModel):
    reference: str = Field(min_length=4, max_length=100)  # UPI transaction / UTR number


class ApproveIn(BaseModel):
    commission_percent: Decimal = Field(ge=0, le=50, decimal_places=2)


class DeclineIn(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class OrderStatusIn(BaseModel):
    status: str
    payment_status: Literal["pending", "paid", "refunded"] | None = None  # cash on delivery only
    courier: str | None = Field(default=None, max_length=60)
    tracking_number: str | None = Field(default=None, max_length=80)


class BulkStatusIn(BaseModel):
    order_ids: list[int] = Field(min_length=1, max_length=500)
    status: str
    courier: str | None = Field(default=None, max_length=60)
    # Optional tracking number per order id (as a string key, from JSON).
    tracking: dict[str, str] = Field(default_factory=dict)


class BulkStatusOut(BaseModel):
    updated: list["OrderOut"]
    failed: list[dict]


# ---------- Contact ----------


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=200)
    message: str = Field(min_length=10, max_length=5000)


class ContactOut(ORM):
    id: int
    name: str
    email: str
    subject: str
    message: str
    created_at: datetime
