from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import ON_SERVERLESS, settings

# prepare_threshold=None: Neon's pooled (PgBouncer) URLs don't keep server-side
# prepared statements between transactions.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=2 if ON_SERVERLESS else 5,
    connect_args={"prepare_threshold": None} if settings.database_url.startswith("postgresql") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
