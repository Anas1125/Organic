"""Public images (product photos, site logo). Works with local and database storage.

Certificate documents are never served here — only through /api/v1/documents.
"""

import re

from fastapi import APIRouter, HTTPException, Response, status

from app.services.storage import get_storage

router = APIRouter(include_in_schema=False)

PUBLIC_FOLDERS = {"products", "site"}
TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
# e.g. "abc…123.webp" or "13/abc…123.webp" (product photos sit in a per-product folder)
SAFE_NAME = re.compile(r"^(\d+/)?[a-f0-9]{32}\.(jpg|png|webp)$")


@router.get("/{folder}/{name:path}")
def media(folder: str, name: str):
    if folder not in PUBLIC_FOLDERS or not SAFE_NAME.match(name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    data = get_storage().read(f"{folder}/{name}")
    return Response(
        data,
        media_type=TYPES[name.rsplit(".", 1)[1]],  # explicit: older Pythons lack .webp
        # File names are random and never reused, so browsers and CDNs can keep them.
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
