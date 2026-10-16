import time
import uuid
from typing import Callable
from urllib.parse import urlparse

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import settings
from core.logging import logger


class RequestIDAndLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        response.headers["X-Request-ID"] = request_id

        # Log request summary
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"-> {response.status_code} ({duration_ms:.2f}ms)"
        )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


class OriginCSRFDefenseMiddleware(BaseHTTPMiddleware):
    """
    CSRF defense for cookie-authenticated sessions.
    Verifies that state-changing requests (POST, PUT, PATCH, DELETE)
    originate from an allowed client origin.
    """
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method not in self.SAFE_METHODS:
            origin = request.headers.get("origin")
            referer = request.headers.get("referer")

            candidate_origin = origin
            if not candidate_origin and referer:
                parsed = urlparse(referer)
                candidate_origin = f"{parsed.scheme}://{parsed.netloc}"

            allowed = settings.allowed_origins_list

            # In development, also accept localhost/127.0.0.1 variants
            is_valid = False
            if candidate_origin:
                if candidate_origin in allowed:
                    is_valid = True
                elif settings.ENVIRONMENT == "development":
                    parsed = urlparse(candidate_origin)
                    if parsed.hostname in {"localhost", "127.0.0.1"}:
                        is_valid = True
            else:
                # If neither Origin nor Referer is provided (e.g. backend-to-backend or curl),
                # allow only if not using browser cookie auth
                if not request.cookies.get("access_token") and not request.cookies.get("refresh_token"):
                    is_valid = True

            if not is_valid:
                logger.warning(
                    f"Blocked state-changing request from unauthorized origin: {candidate_origin}"
                )
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": {
                            "code": "CSRF_ORIGIN_REJECTED",
                            "message": "Cross-origin request rejected.",
                        },
                        "detail": "Cross-origin request rejected.",
                    },
                )

        return await call_next(request)


class InMemoryRateLimiter:
    """
    In-memory rate limiter per IP address for sensitive endpoints.
    """
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}

    def is_rate_limited(self, client_ip: str) -> bool:
        now = time.time()
        timestamps = self.requests.get(client_ip, [])
        # filter out expired
        timestamps = [ts for ts in timestamps if now - ts < self.window_seconds]
        if len(timestamps) >= self.max_requests:
            self.requests[client_ip] = timestamps
            return True

        timestamps.append(now)
        self.requests[client_ip] = timestamps
        return False


auth_rate_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60)
