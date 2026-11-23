# ==========================================
# Stage 1: Build React/Vite Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package manifests
COPY Frontend/package.json Frontend/package-lock.json ./

# Clean reproducible install of dependencies
RUN npm ci

# Copy frontend source code
COPY Frontend/ ./

# Build optimized production assets (relative API URL for single-container deployment)
ENV VITE_API_URL=""
RUN npm run build

# ==========================================
# Stage 2: Build virtual environment with uv
# ==========================================
FROM python:3.12-slim AS backend-builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install build dependencies for C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv from official binary image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy backend dependency manifests
COPY Backend/pyproject.toml Backend/uv.lock Backend/README.md ./

# Install production dependencies only using the exact frozen lockfile
RUN uv sync --frozen --no-dev --no-install-project

# ==========================================
# Stage 3: Minimal Single-Container Runtime
# ==========================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    STATIC_DIR="/app/static" \
    PORT=8000

WORKDIR /app

# Install runtime dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and group
RUN groupadd -r -g 10001 appgroup && \
    useradd -r -u 10001 -g appgroup -d /app -s /sbin/nologin appuser

# Copy virtual environment from backend-builder
COPY --from=backend-builder --chown=appuser:appgroup /app/.venv /app/.venv

# Copy compiled frontend static assets from frontend-builder
COPY --from=frontend-builder --chown=appuser:appgroup /app/frontend/dist /app/static

# Copy backend application source code
COPY --chown=appuser:appgroup Backend/ /app

# Switch to non-root user
USER appuser

# Expose default port
EXPOSE 8000

# Reliable health check against /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start Uvicorn listening on 0.0.0.0 and the PORT provided by Render
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
