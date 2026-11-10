"""File storage: local disk in development, the database (free, no extra service) or any
S3-compatible bucket in production.

Product images are public. Certification / GI documents are private and are only
served through an authenticated endpoint (see routers/documents.py).
"""

import io
import uuid
from pathlib import Path
from typing import Protocol

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
DOCUMENT_TYPES = {**IMAGE_TYPES, "application/pdf": ".pdf"}

# File signatures, so a renamed .exe can't pass as a .pdf
MAGIC = {
    ".jpg": [b"\xff\xd8\xff"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".webp": [b"RIFF"],
    ".pdf": [b"%PDF"],
}


class Storage(Protocol):
    def save(self, key: str, data: bytes, content_type: str) -> None: ...
    def read(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...
    def public_url(self, key: str) -> str: ...


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid file path")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def read(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def public_url(self, key: str) -> str:
        return f"{settings.public_media_url}/{key}"


class S3Storage:
    def __init__(self):
        import boto3  # installed only when S3 is used

        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
        )

    def save(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def read(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def public_url(self, key: str) -> str:
        return f"{settings.s3_public_base_url.rstrip('/')}/{key}"


class DatabaseStorage:
    """Keeps file bytes in the stored_files table. Good for small sites on free hosting."""

    def save(self, key: str, data: bytes, content_type: str) -> None:
        from app.db import SessionLocal
        from app.models import StoredFile

        with SessionLocal() as db:
            db.merge(StoredFile(key=key, content_type=content_type, size=len(data), data=data))
            db.commit()

    def read(self, key: str) -> bytes:
        from app.db import SessionLocal
        from app.models import StoredFile

        with SessionLocal() as db:
            row = db.get(StoredFile, key)
            if not row:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
            return row.data

    def delete(self, key: str) -> None:
        from sqlalchemy import delete

        from app.db import SessionLocal
        from app.models import StoredFile

        with SessionLocal() as db:
            db.execute(delete(StoredFile).where(StoredFile.key == key))
            db.commit()

    def public_url(self, key: str) -> str:
        return f"{settings.public_media_url}/{key}"


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        if settings.storage_backend == "s3":
            _storage = S3Storage()
        elif settings.storage_backend == "database":
            _storage = DatabaseStorage()
        else:
            _storage = LocalStorage(settings.upload_dir)
    return _storage


async def save_upload(file: UploadFile, folder: str, *, kind: str) -> str:
    """Validate and store an upload. kind = 'image' | 'document'. Returns the storage key."""
    allowed = IMAGE_TYPES if kind == "image" else DOCUMENT_TYPES
    max_mb = settings.max_image_mb if kind == "image" else settings.max_document_mb

    ext = allowed.get(file.content_type or "")
    if not ext:
        names = ", ".join(sorted({e.strip(".").upper() for e in allowed.values()}))
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unsupported file type. Allowed: {names}")

    data = await file.read(max_mb * 1024 * 1024 + 1)
    if len(data) > max_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"File is larger than {max_mb} MB")
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is empty")
    if not any(data.startswith(sig) for sig in MAGIC[ext]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File content does not match its type")

    content_type = file.content_type
    if kind == "image":
        data, ext, content_type = optimize_image(data)

    key = f"{folder}/{uuid.uuid4().hex}{ext}"
    get_storage().save(key, data, content_type)
    return key


def optimize_image(data: bytes) -> tuple[bytes, str, str]:
    """Check the image really decodes, shrink it to fit IMAGE_MAX_SIDE and save as WebP.

    Returns (bytes, extension, content type). Keeps transparency (logos)."""
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = 50_000_000  # refuse "decompression bomb" images
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((settings.image_max_side, settings.image_max_side))
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "transparency" in img.info or img.mode in ("LA", "P") else "RGB")
            out = io.BytesIO()
            img.save(out, "WEBP", quality=82, method=4)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This image could not be read")
    return out.getvalue(), ".webp", "image/webp"


def media_url(key: str | None) -> str | None:
    return get_storage().public_url(key) if key else None
