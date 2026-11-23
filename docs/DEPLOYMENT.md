# PocketCircle Production Deployment Guide (Render & Neon)

This guide provides the official deployment specification for hosting PocketCircle on **Render** (Frontend Static Site + Backend Docker Web Service) paired with **Neon PostgreSQL**.

---

## 1. Architecture Topology

```
[ User Web Browser ]
        │
        ├─────────────────────────────────────────────────┐
        ▼                                                 ▼
[ Render Static Site ]                          [ Render Web Service ]
- Runtime: Static Site                          - Runtime: Docker (Multi-stage)
- Path: Frontend/dist                           - Port: $PORT (0.0.0.0)
- SPA Rewrite: /* -> /index.html               - Non-Root: appuser (UID 10001)
        │                                                 │
        └───────────── HTTPS REST API Calls ──────────────┤
                                                          ▼
                                             [ Neon Serverless Postgres ]
                                             - Managed PostgreSQL (SSL required)
                                             - Driver: asyncpg (SQLAlchemy 2.0)
```

---

## 2. Environment Variables Matrix

### A. Backend Web Service (`pocketcircle-backend`)
| Variable | Required | Sensitivity | Description & Example |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | **Yes** | **Secret** | Neon PostgreSQL async connection string: `postgresql+asyncpg://<user>:<password>@<host>/<database>?ssl=require` |
| `ENVIRONMENT` | **Yes** | Public | Set to `production` (enforces HSTS and strict security validation). |
| `JWT_SECRET` | **Yes** | **Secret** | 256-bit cryptographically secure string (min 32 chars): generate via `openssl rand -hex 32`. |
| `JWT_ALGORITHM` | No | Public | Default `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Public | Default `30`. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Public | Default `30`. |
| `COOKIE_SECURE` | **Yes** | Public | Set to `True` (forces `Secure` flag on HTTPS cookies). |
| `COOKIE_SAMESITE` | **Yes** | Public | Set to `lax`. |
| `ALLOWED_ORIGINS` | **Yes** | Public | Comma-separated Render frontend origin: e.g. `https://pocketcircle-ui.onrender.com`. |
| `EMAIL_PROVIDER` | **Yes** | Public | Set to `resend` (or `smtp`). In production, `console` is blocked by startup validator. |
| `RESEND_API_KEY` | **Yes** | **Secret** | Your API key from [Resend](https://resend.com): `re_...`. |
| `RESEND_FROM_EMAIL` | **Yes** | Public | Sender address: e.g. `PocketCircle <onboarding@resend.dev>` or verified domain address. |
| `GOOGLE_CLIENT_ID` | **Yes** | Public | Google OAuth Web Client ID: `...apps.googleusercontent.com`. |

### B. Frontend Static Site (`pocketcircle-frontend`)
| Variable | Required | Sensitivity | Description & Example |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | **Yes** | Public | Full URL of your deployed Render backend: `https://pocketcircle-backend.onrender.com`. |
| `VITE_GOOGLE_CLIENT_ID` | **Yes** | Public | Must match the backend `GOOGLE_CLIENT_ID`. |

---

## 3. Deployment Instructions

### Option 1: 1-Click Infrastructure as Code via Blueprint (`render.yaml`)
PocketCircle includes a root `render.yaml` specification that automates provisioning:

1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), navigate to **Blueprints** and click **New Blueprint Instance**.
3. Select your `pocketcircle` repository.
4. Render detects `render.yaml` and prepares:
   - `pocketcircle-backend` (Docker Web Service)
   - `pocketcircle-frontend` (Static Site with SPA rewrite rule `/*` -> `/index.html`)
5. In the prompts, supply the unsynced secret variables:
   - `DATABASE_URL` (your Neon asyncpg string)
   - `RESEND_API_KEY`
   - `GOOGLE_CLIENT_ID`
6. Click **Apply**. Both services will build and link automatically.

---

### Option 2: Manual Render Dashboard Setup

#### Step 1: Provision Database on Neon
1. Create a free PostgreSQL database at [Neon.tech](https://neon.tech).
2. Copy the connection string and convert the driver prefix:
   - Change `postgresql://` to `postgresql+asyncpg://`.
   - Ensure `?ssl=require` remains at the end.
3. Run schema migrations from your local development machine:
   ```bash
   cd Backend
   $env:DATABASE_URL="postgresql+asyncpg://<user>:<password>@<host>/<database>?ssl=require"
   uv run alembic upgrade head
   ```

#### Step 2: Deploy Backend Docker Web Service
1. In Render Dashboard, click **New > Web Service**.
2. Connect your GitHub repository.
3. Configure settings:
   - **Name:** `pocketcircle-backend`
   - **Region:** Oregon (US West) or your closest region
   - **Language:** `Docker`
   - **Docker Context Directory:** `./Backend`
   - **Dockerfile Path:** `./Backend/Dockerfile`
   - **Instance Type:** `Free`
   - **Health Check Path:** `/health`
4. Add Environment Variables (from Matrix in Section 2A).
5. Click **Create Web Service**.

#### Step 3: Deploy Frontend Static Site
1. In Render Dashboard, click **New > Static Site**.
2. Connect the same GitHub repository.
3. Configure settings:
   - **Name:** `pocketcircle-frontend`
   - **Root Directory:** `Frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Configure SPA Rewrite Rule (**Critical for React Router**):
   - In the service page, go to **Redirects / Rewrites**.
   - Add rule:
     - **Type:** `Rewrite`
     - **Source:** `/*`
     - **Destination:** `/index.html`
5. Under **Environment**, add:
   - `VITE_API_URL`: Your backend URL (e.g. `https://pocketcircle-backend.onrender.com`).
   - `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
6. Click **Create Static Site**.

---

## 4. Post-Deployment Verification Checklist

Once both services show **Live**:

1. **Backend Health Probe:**
   ```bash
   curl -i https://<your-backend-slug>.onrender.com/health
   # Expected: HTTP 200 {"status":"ok","service":"PocketCircle API"}
   ```
2. **Database Readiness Probe:**
   ```bash
   curl -i https://<your-backend-slug>.onrender.com/ready
   # Expected: HTTP 200 {"status":"ready","database":"connected"}
   ```
3. **Frontend-to-Backend CORS Check:**
   - Open your Render frontend URL in Chrome/Firefox.
   - Inspect network tab: verify `GET /auth/me` returns HTTP 401 unauthenticated with `x-request-id` header and no CORS errors.
4. **SPA Deep Link Navigation:**
   - Navigate to `/login` or reload `/dashboard`.
   - Verify page renders without HTTP 404.
5. **Cookie Security:**
   - Log in and inspect Application > Cookies:
   - Verify `access_token` and `refresh_token` have `HttpOnly=True`, `Secure=True`, and `SameSite=Lax`.

---

## 5. Free-Tier Limitations & Operational Realities

Deploying on free cloud tiers requires understanding specific behavioral constraints:

1. **Inactivity Cold Starts (Render Free Web Services):**
   - Free Web Services automatically spin down after **15 minutes** of zero incoming traffic.
   - The next incoming request will trigger a cold start taking **50 to 90 seconds** while the container starts.
   - *Mitigation:* The frontend displays accessible loading skeletons so users know data is fetching.
2. **Ephemeral Filesystem (Docker Containers):**
   - Free web services do not have persistent disks. Any local file created in the container is deleted when the container restarts or spins down.
   - All state in PocketCircle resides exclusively in external Neon PostgreSQL.
3. **Database Inactivity Auto-Suspend (Neon Free Tier):**
   - Neon serverless Postgres suspends compute after **5 minutes** of inactivity.
   - Waking up the Neon database takes ~1–2 seconds upon the next query.
4. **Monthly Bandwidth & Quota Limits:**
   - Render Free Tier allocates **750 free instance hours per month** across all free web services.
   - Static Sites on Render are served from a global CDN and do not consume instance hours.
