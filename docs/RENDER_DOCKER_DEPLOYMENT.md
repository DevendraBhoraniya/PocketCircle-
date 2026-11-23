# PocketCircle: Single-Container Full-Stack Render Deployment Guide

## 1. Architectural Overview

PocketCircle is deployed as a **single-container full-stack web service** on the Render Free Tier ($0/month), backed by an external persistent **Neon PostgreSQL** serverless database.

```
                              ┌──────────────────────────────────────────────┐
                              │           Render Web Service (Free Tier)     │
                              │           https://<app>.onrender.com         │
                              │                                              │
                              │ ┌──────────────────────────────────────────┐ │
                              │ │         Unified Docker Container         │ │
                              │ │         (python:3.12-slim runtime)       │ │
                              │ │                                          │ │
                              │ │  Uvicorn (0.0.0.0:$PORT)                 │ │
                              │ │  ├── Static Assets (/assets/*)           │ │
[User Browser] ───────────────┼─┼─>├── SPA Fallback (index.html at /)      │ │
                              │ │  ├── API Routes (/api/v1/*, /auth/*)     │ │
                              │ │  └── Healthcheck (/health)               │ │
                              │ └───────────────────┬──────────────────────┘ │
                              └─────────────────────┼────────────────────────┘
                                                    │ asyncpg (SSL)
                                                    ▼
                              ┌──────────────────────────────────────────────┐
                              │          Neon Serverless PostgreSQL          │
                              │             Persistent Database              │
                              └──────────────────────────────────────────────┘
```

### Key Architectural Advantages
1. **$0/month Zero-Cost Footprint**: Consolidates frontend static assets and backend API into **exactly one** Render Web Service, staying 100% within Render's free tier allowances (750 free instance hours/month).
2. **Same-Origin Simplicity**: Eliminates cross-origin CORS overhead and complex multi-domain cookie policies (`Cookie SameSite=lax`, `Path=/`, `HttpOnly`, `Secure`). All frontend requests use relative paths (`/api/...`, `/auth/...`).
3. **Smart Header Routing**: FastAPI differentiates between browser page refreshes (`Accept: text/html`) and client API calls (`Accept: application/json`) for dual-role paths like `/groups` and `/friends`.
4. **Lightweight & Memory-Safe**: Production Docker image is only **246 MB** with a runtime memory footprint of **~72.5 MiB** (well below Render's 512 MiB limit).

---

## 2. Multi-Stage Dockerfile Architecture

The root [`Dockerfile`](file:///f:/Projects/pocket_circle/Dockerfile) builds both the frontend and backend in isolated multi-stage build environments, yielding a minimal runtime image free of Node.js or development dependencies:

- **Stage 1 (`frontend-builder`, `node:20-alpine`)**:
  - Reproducible `npm ci` install from `Frontend/package-lock.json`.
  - Sets `VITE_API_URL=""` for same-origin relative API requests.
  - Compiles TypeScript and builds minified assets (`npm run build`) into `Frontend/dist`.
- **Stage 2 (`backend-builder`, `python:3.12-slim`)**:
  - Installs Astral's `uv` from official binary image.
  - Installs compilation dependencies (`gcc`, `libpq-dev`).
  - Installs production dependencies via frozen lockfile (`uv sync --frozen --no-dev`).
- **Stage 3 (`runtime`, `python:3.12-slim`)**:
  - Installs minimal runtime dependency `curl` for container healthcheck.
  - Creates dedicated unprivileged non-root user `appuser:appgroup` (UID `10001`).
  - Copies `.venv` from `backend-builder` and `Frontend/dist` to `/app/static`.
  - Binds to `0.0.0.0:${PORT:-8000}`.
  - Healthcheck monitors `http://localhost:${PORT:-8000}/health`.

---

## 3. Local Verification Results

The container was built and thoroughly verified locally:

| Test Case | Command | Expected Result | Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Image Size** | `docker images pocketcircle:unified` | Lightweight image | **246 MB** | PASS |
| **Health Check** | `GET /health` | `{"status": "ok", "service": "PocketCircle API"}` | `HTTP 200 OK`, JSON match | PASS |
| **Root Homepage** | `GET /` | `text/html` index.html | `HTTP 200 OK`, Title "PocketCircle" | PASS |
| **SPA Route Refresh** | `GET /dashboard` (`Accept: text/html`) | `text/html` index.html fallback | `HTTP 200 OK`, `index.html` | PASS |
| **Dual-Role Route (Browser)** | `GET /groups` (`Accept: text/html`) | `text/html` index.html | `HTTP 200 OK`, `index.html` | PASS |
| **Dual-Role Route (API)** | `GET /groups` (`Accept: application/json`) | API execution (401 without cookie) | `HTTP 401 Unauthorized` JSON | PASS |
| **Unknown API 404** | `GET /api/v1/nonexistent` | Standard JSON 404 envelope | `HTTP 404 Not Found` JSON (not HTML) | PASS |
| **Static Assets** | `GET /assets/*.css`, `GET /favicon.svg` | Correct MIME type | `HTTP 200 OK`, `text/css`, `image/svg+xml` | PASS |
| **Security User** | `docker exec <id> id` | Non-root UID 10001 | `uid=10001(appuser) gid=10001(appgroup)` | PASS |
| **Memory Footprint** | `docker stats --no-stream` | `< 512 MiB` | **72.52 MiB** (~14% of Render limit) | PASS |

---

## 4. Render Setup Instructions

### Option A: Automatic Blueprint Deployment (Recommended)
1. Push repository changes to GitHub.
2. In the Render Dashboard, click **New +** -> **Blueprint**.
3. Select the `pocketcircle` repository.
4. Render detects [`render.yaml`](file:///f:/Projects/pocket_circle/render.yaml) with the single `pocketcircle` Web Service.
5. Provide the required secrets in the Render dashboard:
   - `DATABASE_URL` (Neon PostgreSQL asyncpg URL)
   - `RESEND_API_KEY` (Resend email API key)
   - `GOOGLE_CLIENT_ID` (Google OAuth 2.0 Web Client ID)
6. Click **Apply**.

### Option B: Manual Web Service Creation
1. Click **New +** -> **Web Service**.
2. Select your repository.
3. Configure the service:
   - **Name**: `pocketcircle`
   - **Language**: `Docker`
   - **Branch**: `master` (or your main branch)
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Context**: `.`
   - **Instance Type**: `Free`
   - **Health Check Path**: `/health`
4. Add the Environment Variables (see Section 5 below).
5. Click **Create Web Service**.

---

## 5. Required Environment Variables

| Variable | Required | Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | Yes | `production` | Enables strict security validations, HTTPS cookies, and HSTS. |
| `DATABASE_URL` | Yes | `postgresql+asyncpg://<user>:<password>@<neon-host>/<db>?ssl=require` | Persistent connection to Neon serverless PostgreSQL. |
| `JWT_SECRET` | Yes | Cryptographic random 32+ char string | Automatically generated by Render (`generateValue: true`). |
| `JWT_ALGORITHM` | Yes | `HS256` | JWT signing algorithm. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token lifespan. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `30` | Refresh token session lifespan. |
| `COOKIE_SECURE` | Yes | `True` | Forces HTTPS-only cookies in production. |
| `COOKIE_SAMESITE` | Yes | `lax` | Cross-site request protection. |
| `EMAIL_PROVIDER` | Yes | `resend` | Supported HTTPS email delivery API for OTPs. |
| `RESEND_API_KEY` | Yes | `re_...` | API key from [Resend](https://resend.com). |
| `RESEND_FROM_EMAIL` | Yes | `PocketCircle <onboarding@resend.dev>` | Verified sender address. |
| `GOOGLE_CLIENT_ID` | Yes | `<id>.apps.googleusercontent.com` | Google OAuth 2.0 Web Client ID. |

---

## 6. Neon PostgreSQL Database Configuration

1. Create a free project at [Neon](https://neon.tech).
2. Create a database named `pocketcircle`.
3. In the Neon Dashboard, copy the connection string.
4. Replace `postgresql://` with `postgresql+asyncpg://`:
   ```
   postgresql+asyncpg://<username>:<password>@<endpoint>.neon.tech/pocketcircle?ssl=require
   ```
5. Set this string as the `DATABASE_URL` environment variable in Render.

### Running Alembic Migrations
To run initial database migrations against Neon:
```bash
# Run locally using your development virtualenv pointing to Neon:
DATABASE_URL="postgresql+asyncpg://<user>:<pass>@<endpoint>.neon.tech/pocketcircle?ssl=require" uv run alembic upgrade head
```
Or execute a one-off shell in Render dashboard:
```bash
alembic upgrade head
```

---

## 7. Render Free-Tier Characteristics & Mitigations

1. **Preventing Free Server Sleep (100% Automated)**:
   - Render spins down free web services after **15 minutes of inbound HTTP inactivity**.
   - *Automated Built-in Solution*: PocketCircle includes a GitHub Actions keep-alive workflow ([`.github/workflows/keep-alive.yml`](file:///.github/workflows/keep-alive.yml)) that automatically sends an HTTPS `GET /health` request every **14 minutes**, resetting Render's inactivity timer so your service **never sleeps**.
   - *Setup*:
     1. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
     2. Click **New repository secret**.
     3. Name: `RENDER_APP_URL`
     4. Value: `https://your-service-name.onrender.com`
   - *Alternative Free Pingers*: You can also register `https://your-service-name.onrender.com/health` on [Cron-Job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com), or [BetterStack](https://betterstack.com) to ping every 5–10 minutes.
2. **Ephemeral File Storage**:
   - Any files written to the container filesystem are destroyed upon restart.
   - *Mitigation*: PocketCircle never stores application state or ledger transactions in the container filesystem; all users, sessions, circles, and ledger balances reside securely in the external Neon PostgreSQL database.
3. **512 MB RAM Ceiling**:
   - Exceeding 512 MB results in container termination (OOM kill).
   - *Mitigation*: PocketCircle's SQLAlchemy database engine pool is conservatively configured (`pool_size=5`, `max_overflow=5`, `pool_recycle=300`), keeping total runtime memory at **~72.5 MiB**.
