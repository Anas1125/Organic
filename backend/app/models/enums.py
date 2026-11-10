from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    SELLER = "seller"
    BUYER = "buyer"


class BuyerType(StrEnum):
    INDIVIDUAL = "individual"
    WHOLESALE = "wholesale"


class ReviewStatus(StrEnum):
    """Used for sellers, products and organic certifications."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class GIRecordType(StrEnum):
    REGISTERED_PRODUCT = "registered_product"
    APPLICATION = "application"
    AUTHORISED_USER = "authorised_user"


class GIVerification(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    INFO_REQUESTED = "info_requested"  # admin needs more details; seller resubmits


# Only these GI record types can earn the GI badge. A GI *application* is not yet
# a registered GI, so it is recorded and reviewed but never shown as GI-tagged.
GI_BADGE_TYPES = ("registered_product", "authorised_user")


class OrderStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PACKED = "packed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    COD = "cod"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"


UNITS = ["kg", "g", "litre", "ml", "packet", "piece", "dozen", "bundle", "box"]
