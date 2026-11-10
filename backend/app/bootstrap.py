"""Bring the database up to date on startup (used on serverless hosts like Vercel,
where there is no shell to run `alembic upgrade head` and `python -m app.seed`).

Turned on with AUTO_MIGRATE=true. A Postgres advisory lock makes sure only one
instance migrates at a time; the others wait and then find nothing to do.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.db import SessionLocal, engine

logger = logging.getLogger("terralens")
LOCK_ID = 727_001  # any fixed number, shared by all instances
BACKEND_DIR = Path(__file__).resolve().parent.parent


def migrate_and_seed() -> None:
    from app.seed import seed_base  # imported late: it pulls in every model

    with engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            cfg = Config(str(BACKEND_DIR / "alembic.ini"))
            cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
            command.upgrade(cfg, "head")
            with SessionLocal() as db:
                seed_base(db)  # categories + first admin; safe to repeat
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
            conn.commit()
