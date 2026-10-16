from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
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
from routes import auth, friends, users
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
