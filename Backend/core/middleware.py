import time
import uuid
from collections import OrderedDict
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

        # Enforce HSTS in production or over HTTPS
        if settings.ENVIRONMENT == "production" or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy (allows font/style CDNs, Google Sign-In, and client API connections)
        if "Content-Security-Policy" not in response.headers:
            allowed_origins = " ".join(settings.allowed_origins_list)
            response.headers["Content-Security-Policy"] = (
                f"default-src 'self'; "
                f"script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client; "
                f"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; "
                f"font-src 'self' https://fonts.gstatic.com data:; "
                f"img-src 'self' data: https:; "
                f"frame-src 'self' https://accounts.google.com/gsi/; "
                f"connect-src 'self' https://accounts.google.com/gsi/ {allowed_origins};"
            )
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
                candidate_normalized = candidate_origin.strip().rstrip("/").lower()
                allowed_normalized = {o.strip().rstrip("/").lower() for o in allowed}
                if candidate_normalized in allowed_normalized:
                    is_valid = True
                elif settings.ENVIRONMENT == "development":
                    parsed = urlparse(candidate_normalized)
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

    Bounded and self-cleaning:
    - Enforces a hard maximum number of tracked IP keys (`max_tracked_ips`) using an LRU eviction strategy.
    - Evicts expired IP buckets on every request where active timestamps drop to zero.
    - Periodically scrubs stale entries whose last access exceeds `window_seconds`.

    Multi-Worker / Scaling Note:
    - In single-worker deployments (such as default Uvicorn in Docker), this in-memory limiter is exact and zero-overhead.
    - In multi-worker (`--workers N`) or multi-instance deployments across horizontal replicas, in-memory state is
      partitioned across worker processes. For distributed enforcement across multiple workers/instances without state drift,
      a shared cache store (such as Redis with a sliding window script) should be used.
    """
    def __init__(
        self,
        max_requests: int = 30,
        window_seconds: int = 60,
        max_tracked_ips: int = 10000,
        cleanup_interval: int = 300,
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.max_tracked_ips = max_tracked_ips
        self.cleanup_interval = cleanup_interval
        self._last_cleanup = time.time()
        self.requests: OrderedDict[str, list[float]] = OrderedDict()

    def _cleanup_stale_entries(self, now: float) -> None:
        """Evict IP buckets that have no active requests in the current window."""
        stale_ips = [
            ip for ip, timestamps in self.requests.items()
            if not timestamps or (now - timestamps[-1] >= self.window_seconds)
        ]
        for ip in stale_ips:
            self.requests.pop(ip, None)
        self._last_cleanup = now

    def is_rate_limited(self, client_ip: str) -> bool:
        now = time.time()

        # Periodic cleanup of expired IP keys across the entire table
        if now - self._last_cleanup > self.cleanup_interval:
            self._cleanup_stale_entries(now)

        # LRU access: move to end
        if client_ip in self.requests:
            self.requests.move_to_end(client_ip)
            timestamps = self.requests[client_ip]
        else:
            # Enforce hard capacity bound before inserting a new key
            if len(self.requests) >= self.max_tracked_ips:
                # Evict oldest entry (LRU)
                self.requests.popitem(last=False)
            timestamps = []

        # Filter out timestamps outside the sliding window
        timestamps = [ts for ts in timestamps if now - ts < self.window_seconds]

        if len(timestamps) >= self.max_requests:
            self.requests[client_ip] = timestamps
            return True

        if not timestamps:
            # If empty after filtering, remove key to avoid storing idle IPs
            self.requests.pop(client_ip, None)

        timestamps.append(now)
        self.requests[client_ip] = timestamps
        return False


auth_rate_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60)
