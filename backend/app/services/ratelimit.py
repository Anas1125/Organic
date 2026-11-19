"""Simple database-backed rate limits (serverless instances share nothing in memory)."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import RateEvent


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() or request.headers.get("x-real-ip") or
            (request.client.host if request.client else "unknown"))[:64]


def count(db: Session, key: str, minutes: int) -> int:
    since = datetime.now(UTC) - timedelta(minutes=minutes)
    return db.scalar(select(func.count(RateEvent.id)).where(RateEvent.key == key, RateEvent.created_at > since)) or 0


def hit(db: Session, *keys: str) -> None:
    for k in keys:
        db.add(RateEvent(key=k[:200]))
    db.commit()


def clear(db: Session, key: str) -> None:
    db.execute(delete(RateEvent).where(RateEvent.key == key))
    db.commit()


def guard(db: Session, key: str, limit: int, minutes: int, message: str) -> None:
    if count(db, key, minutes) >= limit:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, message)


def prune(db: Session) -> None:
    """Drop events older than a day (called by the daily automation)."""
    db.execute(delete(RateEvent).where(RateEvent.created_at < datetime.now(UTC) - timedelta(days=1)))
    db.commit()
