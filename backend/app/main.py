import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import admin, auth, buyer, catalog, documents, media, seller, site

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


# Public images (products, logo) for local and database storage. With S3 the
# bucket serves them directly. PUBLIC_MEDIA_URL may be a full URL when the
# frontend is on another domain; only its path matters here.
if settings.storage_backend in ("local", "database"):
    from urllib.parse import urlsplit

    app.include_router(media.router, prefix=urlsplit(settings.public_media_url).path.rstrip("/"))
