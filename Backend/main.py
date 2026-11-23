import os
from fastapi import FastAPI, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.exceptions import register_exception_handlers
from core.middleware import (
    OriginCSRFDefenseMiddleware,
    RequestIDAndLoggingMiddleware,
    SecurityHeadersMiddleware,
)
from core.startup import lifespan
from routes import auth, balances, expenses, friends, groups, notifications, settlements, users
from routes.api_v1 import api_v1_router

app = FastAPI(
    title="PocketCircle API",
    version="1.0.0",
    lifespan=lifespan,
)

# Exception handlers
register_exception_handlers(app)

# Custom Middlewares (LIFO order: outermost added last)
app.add_middleware(OriginCSRFDefenseMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIDAndLoggingMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
    max_age=86400,
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "PocketCircle API"}


@app.get("/ready", tags=["Health"])
async def readiness_check(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as exc:
        return {
            "status": "not_ready",
            "database": "disconnected",
            "error": str(exc),
        }


# Versioned API routes
app.include_router(api_v1_router)

# Root-level router includes (maintained for backward compatibility with frontend clients)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(friends.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(balances.router)
app.include_router(settlements.router)
app.include_router(notifications.router)

# Static and SPA client-side routing
STATIC_DIR = os.getenv("STATIC_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))

if os.path.isdir(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.middleware("http")
async def spa_fallback_middleware(request: Request, call_next):
    index_file = os.path.join(STATIC_DIR, "index.html")
    if not os.path.isfile(index_file):
        return await call_next(request)

    path = request.url.path

    # Static assets handled by StaticFiles mount
    if path.startswith("/assets/"):
        return await call_next(request)

    # API endpoints, Swagger, OpenAPI, health checks bypass SPA routing
    bypass_prefixes = (
        "/api/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/ready",
    )
    if any(path.startswith(prefix) for prefix in bypass_prefixes) or path in ("/health", "/ready"):
        return await call_next(request)

    accept = request.headers.get("accept", "")
    is_html_request = "text/html" in accept

    # 1. Direct root visit or browser navigation to HTML (e.g. /groups, /friends, /dashboard)
    if request.method == "GET" and (path == "/" or is_html_request):
        clean_rel = path.lstrip("/")
        if clean_rel:
            candidate = os.path.normpath(os.path.join(STATIC_DIR, clean_rel))
            if candidate.startswith(os.path.abspath(STATIC_DIR)) and os.path.isfile(candidate):
                return FileResponse(candidate)
        return FileResponse(index_file, media_type="text/html")

    # 2. Check if a non-HTML GET request matches a static asset file (e.g. /favicon.ico, /robots.txt)
    if request.method == "GET":
        clean_rel = path.lstrip("/")
        if clean_rel:
            candidate = os.path.normpath(os.path.join(STATIC_DIR, clean_rel))
            if candidate.startswith(os.path.abspath(STATIC_DIR)) and os.path.isfile(candidate):
                return FileResponse(candidate)

    # 3. Call next middleware / route handler
    response = await call_next(request)

    # 4. Unknown routes returning 404: if it's a browser navigation (Accept: text/html) and not an /api/ path, serve index.html
    if response.status_code == 404 and request.method == "GET" and is_html_request:
        if not path.startswith("/api/"):
            return FileResponse(index_file, media_type="text/html")

    return response


