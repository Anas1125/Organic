import os
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Vercel (and similar serverless hosts) only allow writing under /tmp.
ON_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str
    test_database_url: str | None = None

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    cors_origins: str = "http://localhost:5173"

    # local = disk (development), database = Postgres (free, works on Vercel), s3 = any S3 bucket
    storage_backend: str = "database" if ON_SERVERLESS else "local"
    upload_dir: str = "/tmp/uploads" if ON_SERVERLESS else "uploads"
    public_media_url: str = "/media"
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_public_base_url: str | None = None

    # Run migrations + base seed when the app starts (for hosts without a shell).
    auto_migrate: bool = False
    # With AUTO_MIGRATE, also add the demo sellers and products (with photos).
    seed_demo: bool = False

    max_image_mb: int = 4  # Vercel rejects request bodies over 4.5 MB
    image_max_side: int = 1600  # uploaded images are resized to fit and saved as WebP
    max_document_mb: int = 10
    max_video_mb: int = 20  # sent in small pieces; longer videos go on YouTube / Vimeo
    upload_chunk_mb: int = 3  # each piece must fit in Vercel's 4.5 MB request limit

    seed_admin_email: str | None = None
    seed_admin_password: str | None = None

    @field_validator("database_url", "test_database_url")
    @classmethod
    def use_psycopg3(cls, v: str | None) -> str | None:
        """Hosts like Neon give postgres:// or postgresql:// URLs; we ship the psycopg 3 driver."""
        if v:
            for prefix in ("postgres://", "postgresql://"):
                if v.startswith(prefix):
                    return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
