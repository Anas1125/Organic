"""Scheduled jobs. Vercel Cron calls this once a day (see vercel.json)."""

import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import get_db
from app.services import automation

router = APIRouter(prefix="/internal", include_in_schema=False)


@router.get("/run-automation")
def run_automation(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    expected = f"Bearer {settings.cron_secret}" if settings.cron_secret else None
    if not expected or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not allowed")
    return automation.run(db)
