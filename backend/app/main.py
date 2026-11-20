import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import admin, auth, buyer, catalog, documents, internal, media, payments, payouts, seller, site

logger = logging.getLogger("terralens")
class _PrintHandler(logging.Handler):
    """Writes via print(), which Vercel captures (it swaps stdout/stderr after import)."""

    def emit(self, record):
        print(self.format(record), flush=True)


if not logger.handlers:  # show the app's own info/warning messages in the host's logs
    _h = _PrintHandler()
    _h.setFormatter(logging.Formatter("%(levelname)s [terralens] %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)

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
    # Hidden on the live site (API_DOCS=true to show them).
    docs_url="/docs" if settings.api_docs else None,
    redoc_url="/redoc" if settings.api_docs else None,
    openapi_url="/openapi.json" if settings.api_docs else None,
)

class CatchErrors:
    """Turn crashes into a JSON 500 *inside* the CORS layer, so the browser still gets
    the CORS headers and shows the error (FastAPI's own Exception handler runs outside
    CORS, and a header-less 500 looks to the browser like the server never answered)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        started = False

        async def tracked(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracked)
        except Exception:
            logger.exception("Unhandled error on %s %s", scope.get("method"), scope.get("path"))
            if started:  # the response already began; nothing better to send
                raise
            await JSONResponse({"detail": "Something went wrong. Please try again."}, status_code=500)(
                scope, receive, send
            )


# Added first so it sits inside CORSMiddleware (later middleware wraps earlier ones).
app.add_middleware(CatchErrors)
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
    payments.router,
    payouts.router,
    internal.router,
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
