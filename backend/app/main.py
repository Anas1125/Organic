import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import admin, auth, buyer, catalog, documents, seller, site

logger = logging.getLogger("terralens")

if settings.auto_migrate:
    try:
        from app.bootstrap import migrate_and_seed

        migrate_and_seed()
    except Exception:  # keep serving; the error shows in the host's logs
        logger.exception("Startup migration failed")

app = FastAPI(
    title="Terralens Marketplace API",
    version="1.0.0",
    description="Multi-vendor marketplace for organic and traditional food products. "
    "Authenticate with `POST /api/v1/auth/login`, then click **Authorize** and paste the token.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API = "/api/v1"
for r in (
    auth.router,
    catalog.router,
    buyer.router,
    seller.router,
    documents.router,
    admin.router,
    site.router,
):
    app.include_router(r, prefix=API)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}


# Public product images in local development. Documents live under uploads/documents
# and are NOT served here — only through the authenticated /documents endpoints.
if settings.storage_backend == "local":
    from pathlib import Path
    from urllib.parse import urlsplit

    # PUBLIC_MEDIA_URL may be a full URL (when the frontend is on another domain).
    media_path = urlsplit(settings.public_media_url).path.rstrip("/")
    for folder in ("products", "site"):  # public image folders only
        public_dir = Path(settings.upload_dir) / folder
        public_dir.mkdir(parents=True, exist_ok=True)
        app.mount(
            f"{media_path}/{folder}",
            StaticFiles(directory=public_dir),
            name=f"media-{folder}",
        )
