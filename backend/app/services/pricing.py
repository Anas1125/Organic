from decimal import Decimal

from fastapi import HTTPException, status

from app.models import Product


def unit_price_for(product: Product, quantity: int) -> Decimal:
    """Price per unit for this quantity: the matching bulk tier, else the base price."""
    for tier in product.price_tiers:
        if quantity >= tier.min_qty and (tier.max_qty is None or quantity <= tier.max_qty):
            return Decimal(tier.unit_price)
    return Decimal(product.price)


def validate_tiers(tiers: list[dict]) -> None:
    """Tiers must not overlap. Each is {min_qty, max_qty|None, unit_price}."""
    ordered = sorted(tiers, key=lambda t: t["min_qty"])
    for i, tier in enumerate(ordered):
        if tier["max_qty"] is not None and tier["max_qty"] < tier["min_qty"]:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f"Tier starting at {tier['min_qty']}: max must be ≥ min",
            )
        if i + 1 < len(ordered):
            nxt = ordered[i + 1]
            if tier["max_qty"] is None or tier["max_qty"] >= nxt["min_qty"]:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "Bulk price tiers overlap. Each range must end before the next begins.",
                )


def check_quantity(product: Product, quantity: int) -> None:
    if quantity < product.min_order_qty:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Minimum order for {product.name} is {product.min_order_qty} {product.unit}",
        )
    if quantity > product.stock:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Only {product.stock} {product.unit} of {product.name} available",
        )
