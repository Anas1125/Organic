"""Product video, extra photos and key points — shared by the seller and admin routes."""

import re

from fastapi import HTTPException, UploadFile, status

from app import schemas as s
from app.models import Product, ProductImage
from app.services.storage import get_storage, media_url, save_upload

MAX_IMAGES = 6
MAX_KEY_POINTS = 8

_YOUTUBE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|embed/|live/)"
    r"|youtu\.be/)([A-Za-z0-9_-]{11})"
)
_VIMEO = re.compile(r"^https?://(?:www\.|player\.)?vimeo\.com/(?:video/)?(\d+)")
_FILE = re.compile(r"^https://[^\s]+\.(mp4|webm)(\?[^\s]*)?$", re.IGNORECASE)


def is_link(video: str | None) -> bool:
    return bool(video) and video.startswith(("http://", "https://"))


def parse_video_link(url: str) -> s.VideoOut:
    """Turn a pasted link into something the gallery can play, or reject it."""
    url = url.strip()
    if m := _YOUTUBE.match(url):
        return s.VideoOut(
            url=url, kind="youtube", embed_url=f"https://www.youtube-nocookie.com/embed/{m[1]}",
            thumbnail=f"https://i.ytimg.com/vi/{m[1]}/hqdefault.jpg",
        )
    if m := _VIMEO.match(url):
        return s.VideoOut(url=url, kind="vimeo", embed_url=f"https://player.vimeo.com/video/{m[1]}")
    if _FILE.match(url):
        return s.VideoOut(url=url, kind="file")
    raise HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "Use a YouTube or Vimeo link, or a direct https link to an .mp4 or .webm file",
    )


def video_out(p: Product) -> s.VideoOut | None:
    if not p.video:
        return None
    if is_link(p.video):
        try:
            return parse_video_link(p.video)
        except HTTPException:
            return None
    return s.VideoOut(url=media_url(p.video), kind="file")


def _drop_uploaded(p: Product) -> str | None:
    """Forget the current video; return its storage key if it was an upload."""
    old = p.video if p.video and not is_link(p.video) else None
    p.video = None
    return old


def set_video_link(p: Product, url: str) -> str | None:
    parse_video_link(url)  # validates
    old = _drop_uploaded(p)
    p.video = url.strip()
    return old


async def upload_video(p: Product, file: UploadFile) -> str | None:
    key = await save_upload(file, f"products/{p.id}", kind="video")
    old = _drop_uploaded(p)
    p.video = key
    return old


def remove_video(p: Product) -> str | None:
    return _drop_uploaded(p)


def delete_files(*keys: str | None) -> None:
    """Call after the database commit, so a failed commit never loses a file."""
    for key in keys:
        if key:
            get_storage().delete(key)


async def add_images(p: Product, files: list[UploadFile]) -> None:
    if len(p.images) + len(files) > MAX_IMAGES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"A product can have at most {MAX_IMAGES} images"
        )
    next_order = max((i.sort_order for i in p.images), default=-1) + 1
    for offset, f in enumerate(files):
        key = await save_upload(f, f"products/{p.id}", kind="image")
        p.images.append(ProductImage(path=key, sort_order=next_order + offset))


def remove_image(p: Product, image_id: int) -> str:
    img = next((i for i in p.images if i.id == image_id), None)
    if not img:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image not found")
    p.images.remove(img)
    return img.path


def clean_key_points(points: list[str] | None) -> list[str]:
    out = [" ".join(pt.split()) for pt in (points or []) if pt and pt.strip()]
    if len(out) > MAX_KEY_POINTS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Up to {MAX_KEY_POINTS} key points"
        )
    if any(len(pt) > 160 for pt in out):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Each key point must be 160 characters or fewer"
        )
    return out
