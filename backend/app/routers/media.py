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


# Vercel caps a response at about 4.5 MB, so videos are sent in pieces of at most this size.
# Browsers ask for the next piece by themselves while the video plays.
MAX_PIECE = 3 * 1024 * 1024


@router.get("/{folder}/{name:path}")
def media(folder: str, name: str, request: Request):
    if folder not in PUBLIC_FOLDERS or not SAFE_NAME.match(name):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    key = f"{folder}/{name}"
    ext = name.rsplit(".", 1)[1]
    media_type = TYPES[ext]  # explicit: older Pythons lack .webp
    headers = {
        # File names are random and never reused, so browsers and CDNs can keep them.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
    }
    storage = get_storage()
    if ext not in ("mp4", "webm"):
        return Response(storage.read(key), media_type=media_type, headers=headers)

    size = storage.size(key)
    rng = re.match(r"bytes=(\d*)-(\d*)$", request.headers.get("range", ""))
    if rng and (rng[1] or rng[2]):
        if rng[1]:
            start, end = int(rng[1]), int(rng[2]) if rng[2] else size - 1
        else:  # suffix range: last N bytes
            start, end = max(size - int(rng[2]), 0), size - 1
    elif size <= MAX_PIECE:
        return Response(storage.read(key), media_type=media_type, headers=headers)
    else:
        start, end = 0, size - 1
    end = min(end, size - 1, start + MAX_PIECE - 1)
    if start > end:
        return Response(status_code=416, headers={"Content-Range": f"bytes */{size}"})
    headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    data = storage.read_range(key, start, end - start + 1)
    return Response(data, status_code=206, media_type=media_type, headers=headers)
