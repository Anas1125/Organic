import secrets
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import schemas as s
from app.models import CartItem, Order, OrderItem, Product, User
from app.models.enums import OrderStatus, PaymentMethod, PaymentStatus
from app.services.pricing import check_quantity, unit_price_for
from app.services.queries import visible_products

# Which statuses a seller may move an order to from each status.
SELLER_FLOW: dict[str, set[str]] = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.PACKED, OrderStatus.CANCELLED},
    OrderStatus.PACKED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED: {OrderStatus.DELIVERED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}

ORDER_LOAD = (
    selectinload(Order.items),
    selectinload(Order.seller),
    selectinload(Order.buyer),
)


def _new_order_number() -> str:
    return f"TL-{datetime.now(UTC):%y%m%d}-{secrets.token_hex(3).upper()}"


def checkout(db: Session, buyer: User, body: s.CheckoutIn) -> list[Order]:
    """Turn the buyer's cart into one order per seller. All-or-nothing."""
    cart = db.scalars(select(CartItem).where(CartItem.buyer_id == buyer.id)).all()
    if not cart:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your cart is empty")

    # Lock product rows so two buyers can't buy the same last units at once.
    product_ids = sorted(ci.product_id for ci in cart)
    products = {
        p.id: p
        for p in db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .options(selectinload(Product.price_tiers), selectinload(Product.seller))
            .with_for_update(of=Product)
        )
    }

    visible_ids = set(
        db.scalars(
            visible_products().where(Product.id.in_(product_ids)).with_only_columns(Product.id)
        )
    )

    by_seller: dict[int, list[tuple[Product, int]]] = {}
    for ci in cart:
        p = products.get(ci.product_id)
        if not p or p.id not in visible_ids:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "An item in your cart is no longer available. Please remove it and try again.",
            )
        check_quantity(p, ci.quantity)
        by_seller.setdefault(p.seller_id, []).append((p, ci.quantity))

    ref = secrets.token_hex(8)
    orders: list[Order] = []
    for seller_id, lines in by_seller.items():
        order = Order(
            order_number=_new_order_number(),
            checkout_ref=ref,
            buyer_id=buyer.id,
            seller_id=seller_id,
            payment_method=PaymentMethod.COD,
            payment_status=PaymentStatus.PENDING,
            subtotal=Decimal(0),
            total=Decimal(0),
            **body.model_dump(exclude={"payment_method"}),
        )
        subtotal = Decimal(0)
        for p, qty in lines:
            price = unit_price_for(p, qty)
            line_total = (price * qty).quantize(Decimal("0.01"))
            subtotal += line_total
            order.items.append(
                OrderItem(
                    product_id=p.id,
                    product_name=p.name,
                    unit=p.unit,
                    quantity=qty,
                    unit_price=price,
                    line_total=line_total,
                )
            )
            p.stock -= qty
        order.subtotal = subtotal
        order.total = subtotal  # delivery charges / tax can be added here later
        db.add(order)
        orders.append(order)

    for ci in cart:
        db.delete(ci)
    db.commit()
    return orders


def _restock(db: Session, order: Order) -> None:
    ids = [i.product_id for i in order.items if i.product_id]
    products = {
        p.id: p
        for p in db.scalars(select(Product).where(Product.id.in_(ids)).with_for_update())
    }
    for item in order.items:
        if item.product_id in products:
            products[item.product_id].stock += item.quantity


def change_status(db: Session, order: Order, new_status: str, *, as_admin: bool) -> Order:
    if new_status not in OrderStatus.__members__.values():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown order status")
    if new_status == order.status:
        return order
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cancelled orders cannot be changed")
    if not as_admin and new_status not in SELLER_FLOW[order.status]:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Cannot move an order from '{order.status}' to '{new_status}'",
        )
    if new_status == OrderStatus.CANCELLED:
        _restock(db, order)
        if order.payment_status == PaymentStatus.PAID:
            order.payment_status = PaymentStatus.REFUNDED
    if new_status == OrderStatus.DELIVERED and order.payment_method == PaymentMethod.COD:
        order.payment_status = PaymentStatus.PAID
    order.status = new_status
    db.commit()
    db.refresh(order)
    return order
