"""Order automation that needs no courier account.

- Orders waiting for confirmation are confirmed (if AUTO_CONFIRM_ORDERS).
- Shipped orders are marked delivered AUTO_DELIVER_DAYS after shipping, unless the buyer
  already confirmed it. Cash-on-delivery orders become paid at the same time.
- Unpaid online checkouts past the payment window are cancelled (see payments.expire_stale).

run() is called whenever order lists are opened and once a day by Vercel Cron, so nothing
depends on someone being at a computer. Every step is safe to repeat.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Order
from app.models.enums import OrderStatus
from app.services import payments, ratelimit
from app.services.orders import ORDER_LOAD, change_status

logger = logging.getLogger("terralens")
BATCH = 200  # per run, so one request never does too much


def run(db: Session) -> dict:
    payments.expire_stale(db)
    ratelimit.prune(db)
    done = {"confirmed": 0, "delivered": 0}

    if settings.auto_confirm_orders:
        for o in db.scalars(
            select(Order).where(Order.status == OrderStatus.PENDING).options(*ORDER_LOAD).limit(BATCH)
        ):
            change_status(db, o, OrderStatus.CONFIRMED, as_admin=True)
            done["confirmed"] += 1

    if settings.auto_deliver_days > 0:
        cutoff = datetime.now(UTC) - timedelta(days=settings.auto_deliver_days)
        for o in db.scalars(
            select(Order)
            .where(Order.status == OrderStatus.SHIPPED, Order.shipped_at < cutoff)
            .options(*ORDER_LOAD)
            .limit(BATCH)
        ):
            change_status(db, o, OrderStatus.DELIVERED, as_admin=True)
            done["delivered"] += 1

    if done["confirmed"] or done["delivered"]:
        logger.info("Order automation: %s", done)
    return done
