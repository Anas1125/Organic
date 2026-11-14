"""Public images (product photos, site logo). Works with local and database storage.

Certificate documents are never served here — only through /api/v1/documents.
"""

import re

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.services.storage import get_storage

router = APIRouter(include_in_schema=False)

PUBLIC_FOLDERS = {"products", "site"}
TYPES = {
    "jpg": "image/jpeg", "png": "image/png", "webp": "image/webp",
    "mp4": "video/mp4", "webm": "video/webm",
}
# e.g. "abc…123.webp" or "13/abc…123.webp" (product photos sit in a per-product folder)
SAFE_NAME = re.compile(r"^(\d+/)?[a-f0-9]{32}\.(jpg|png|webp|mp4|webm)$")


@router.get("/{folder}/{name:path}")
def media(folder: str, name: str, request: Request):
    if folder not in PUBLIC_FOLDERS or not SAFE_NAME.match(name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    data = get_storage().read(f"{folder}/{name}")
    headers = {
        # File names are random and never reused, so browsers and CDNs can keep them.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
    }
    media_type = TYPES[name.rsplit(".", 1)[1]]  # explicit: older Pythons lack .webp

    # Video players (Safari especially) ask for byte ranges.
    rng = re.match(r"bytes=(\d*)-(\d*)$", request.headers.get("range", ""))
    if rng and (rng[1] or rng[2]):
        size = len(data)
        if rng[1]:
            start, end = int(rng[1]), int(rng[2]) if rng[2] else size - 1
        else:  # suffix range: last N bytes
            start, end = max(size - int(rng[2]), 0), size - 1
        end = min(end, size - 1)
        if start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
        return Response(data[start : end + 1], status_code=206, media_type=media_type, headers=headers)
    return Response(data, media_type=media_type, headers=headers)
