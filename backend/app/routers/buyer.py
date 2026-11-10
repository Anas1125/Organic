from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import schemas as s
from app.core.deps import require_buyer
from app.db import get_db
from app.models import CartItem, Order, Product, User
from app.models.enums import OrderStatus
from app.services import orders as order_service
from app.services.orders import ORDER_LOAD
from app.services.pricing import check_quantity, unit_price_for
from app.services.queries import PRODUCT_LOAD, visible_products
from app.services.serializers import order_out, product_out

router = APIRouter(tags=["Buyer"])


# ---------- Cart ----------


def _cart(db: Session, buyer: User) -> s.CartOut:
    items = db.scalars(
        select(CartItem)
        .where(CartItem.buyer_id == buyer.id)
        .options(selectinload(CartItem.product).options(*PRODUCT_LOAD))
        .order_by(CartItem.created_at)
    ).all()
    visible = set(
        db.scalars(
            visible_products()
            .where(Product.id.in_([i.product_id for i in items]))
            .with_only_columns(Product.id)
        )
    )

    groups: dict[int, s.CartSellerGroup] = {}
    can_checkout = bool(items)
    for ci in items:
        p = ci.product
        price = unit_price_for(p, ci.quantity)
        line = (price * ci.quantity).quantize(Decimal("0.01"))
        problem = None
        if p.id not in visible:
            problem = "No longer available"
        elif ci.quantity > p.stock:
            problem = f"Only {p.stock} {p.unit} in stock"
        elif ci.quantity < p.min_order_qty:
            problem = f"Minimum order is {p.min_order_qty} {p.unit}"
        if problem:
            can_checkout = False
        group = groups.setdefault(
            p.seller_id,
            s.CartSellerGroup(
                seller=s.SellerPublic.model_validate(p.seller), items=[], subtotal=Decimal(0)
            ),
        )
        group.items.append(
            s.CartItemOut(
                id=ci.id,
                product=product_out(p),
                quantity=ci.quantity,
                unit_price=price,
                line_total=line,
                savings=((Decimal(p.price) - price) * ci.quantity).quantize(Decimal("0.01")),
                problem=problem,
            )
        )
        group.subtotal += line

    subtotal = sum((g.subtotal for g in groups.values()), Decimal(0))
    return s.CartOut(
        groups=list(groups.values()),
        item_count=len(items),
        subtotal=subtotal,
        total=subtotal,
        can_checkout=can_checkout,
    )


@router.get("/cart", response_model=s.CartOut)
def get_cart(buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    return _cart(db, buyer)


@router.post("/cart/items", response_model=s.CartOut)
def add_to_cart(
    body: s.CartAdd, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)
):
    p = db.scalar(visible_products().where(Product.id == body.product_id))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    item = db.scalar(select(CartItem).filter_by(buyer_id=buyer.id, product_id=p.id))
    new_qty = body.quantity + (item.quantity if item else 0)
    check_quantity(p, new_qty)
    if item:
        item.quantity = new_qty
    else:
        db.add(CartItem(buyer_id=buyer.id, product_id=p.id, quantity=new_qty))
    db.commit()
    return _cart(db, buyer)


def _own_item(db: Session, buyer: User, item_id: int) -> CartItem:
    item = db.get(CartItem, item_id)
    if not item or item.buyer_id != buyer.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cart item not found")
    return item


@router.patch("/cart/items/{item_id}", response_model=s.CartOut)
def set_quantity(
    item_id: int,
    body: s.CartQty,
    buyer: User = Depends(require_buyer),
    db: Session = Depends(get_db),
):
    item = _own_item(db, buyer, item_id)
    check_quantity(item.product, body.quantity)
    item.quantity = body.quantity
    db.commit()
    return _cart(db, buyer)


@router.delete("/cart/items/{item_id}", response_model=s.CartOut)
def remove_item(item_id: int, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    db.delete(_own_item(db, buyer, item_id))
    db.commit()
    return _cart(db, buyer)


# ---------- Orders ----------


@router.post("/orders/checkout", response_model=list[s.OrderOut], status_code=201)
def checkout(
    body: s.CheckoutIn, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)
):
    created = order_service.checkout(db, buyer, body)
    ids = [o.id for o in created]
    rows = db.scalars(select(Order).where(Order.id.in_(ids)).options(*ORDER_LOAD))
    return [order_out(o) for o in rows]


@router.get("/orders", response_model=list[s.OrderOut])
def my_orders(buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Order)
        .where(Order.buyer_id == buyer.id)
        .options(*ORDER_LOAD)
        .order_by(Order.created_at.desc())
    )
    return [order_out(o) for o in rows]


def _own_order(db: Session, buyer: User, order_id: int, lock: bool = False) -> Order:
    stmt = select(Order).where(Order.id == order_id, Order.buyer_id == buyer.id).options(*ORDER_LOAD)
    if lock:
        stmt = stmt.with_for_update(of=Order)
    o = db.scalar(stmt)
    if not o:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    return o


@router.get("/orders/{order_id}", response_model=s.OrderOut)
def my_order(order_id: int, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)):
    return order_out(_own_order(db, buyer, order_id))


@router.post("/orders/{order_id}/cancel", response_model=s.OrderOut)
def cancel_order(
    order_id: int, buyer: User = Depends(require_buyer), db: Session = Depends(get_db)
):
    o = _own_order(db, buyer, order_id, lock=True)
    if o.status not in (OrderStatus.PENDING, OrderStatus.CONFIRMED):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This order is already being prepared and can't be cancelled"
        )
    return order_out(order_service.change_status(db, o, OrderStatus.CANCELLED, as_admin=True))
