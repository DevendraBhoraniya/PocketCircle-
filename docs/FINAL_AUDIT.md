# PocketCircle — Comprehensive Baseline Audit Report

**Date:** 2026-11-23  
**Auditor:** Senior Full-Stack, Security & QA Engineering Team  
**Scope:** Full repository audit (Backend, Frontend, Database, CI/CD, Infrastructure, Security, Invariants)

---

## 1. Executive Summary

PocketCircle is a shared-expense ledger designed for small social groups (2–50 participants). It implements exact paisa/cent math (`NUMERIC(12, 2)` / Python `Decimal`), greedy cash-flow settlement simplification ($\le N - 1$ transfers), and append-only audit event trails.

The baseline audit confirms that the core application features, React frontend UI, and mathematical split invariants are structurally well-built. However, the audit uncovered **critical CI/CD failures**, **security and privacy leaks**, **database isolation problems in the test harness**, and **subtle concurrency and determinism edge cases**.

---

## 2. Test & Verification Baseline Results

| Check | Tool / Command | Result | Duration / Details |
|---|---|---|---|
| **Backend Test Suite (Cloud DB)** | `cd Backend; uv run pytest` | **PASS (60/60)** | **475.78s (07:55)** — 60 passed, 7 warnings (deprecation warning in httpx cookies). Tests ran over WAN to Neon US-East-2. |
| **Backend Test Suite (SQLite in-memory)** | `DATABASE_URL="sqlite+aiosqlite:///:memory:" uv run pytest tests/test_splits.py` | **FAILED (CRITICAL)** | Immediate `TypeError: Invalid argument(s) 'pool_size','max_overflow' sent to create_engine(), using configuration SQLiteDialect_aiosqlite/StaticPool/Engine` at `core/database.py:L10`. |
| **Frontend Production Build** | `cd Frontend; npm run build` | **PASS** | Built in **4.79s** via Vite 8 & Tailwind CSS. |
| **Frontend Linting** | `cd Frontend; npm run lint` | **PASS** | 0 ESLint errors or warnings across all components. |
| **Frontend Type Checking** | `cd Frontend; npx tsc -b` | **PASS** | TypeScript 6.0 passed with zero errors. |
| **Alembic Schema Validation** | `cd Backend; uv run alembic check` | **DETECTED DIFFERENCES** | Unmanaged indexes on remote cloud DB (`unique_friendship_pair`, `ix_notifications_recipient_read_created`). |

---

## 3. Detailed Audit Findings

### Finding 1: CI/CD Crash from Dialect-Blind Engine Configuration
- **Severity:** Critical
- **File & Line:** `Backend/core/database.py:L10-L17`, `.github/workflows/ci.yml:L58-L68`
- **Actual Problem:** `create_async_engine()` in `Backend/core/database.py` is invoked with unconditional connection-pool keyword arguments: `pool_size=20`, `max_overflow=10`, `pool_recycle=300`. While valid for PostgreSQL with QueuePool, SQLAlchemy's `StaticPool` (used by SQLite memory engines) strictly prohibits these keyword arguments. In CI (`.github/workflows/ci.yml`), `DATABASE_URL` is set to `sqlite+aiosqlite:///:memory:`. As soon as any module imports `core.database`, SQLAlchemy throws a fatal `TypeError` before any test can execute.
- **Reproduction Evidence:**
  ```text
  TypeError: Invalid argument(s) 'pool_size','max_overflow' sent to create_engine(), using configuration SQLiteDialect_aiosqlite/StaticPool/Engine.
  ```
- **Recommended Correction:** Make engine configuration dialect-aware. Only supply `pool_size`, `max_overflow`, and `pool_recycle` when the URL driver begins with `postgresql`. For SQLite, use compatible defaults (such as `StaticPool` or `NullPool` without invalid pool kwargs).
- **Affects Deployment or Users:** Yes. Completely blocks automated GitHub Actions CI and prevents local testing without external database dependencies.

---

### Finding 2: Personal Developer Email Exposed in Public API Responses (Resolved)
- **Severity:** High (Privacy / Security)
- **File & Line:** `Backend/routes/auth.py:L143, L245, L338` (Remediated)
- **Actual Problem:** During email OTP dispatch, if the email delivery provider encountered Resend's free-tier sandbox limitation, the API previously returned a status message referencing a developer email address.
- **Recommended Correction:** Replace the developer address with a neutral, generic notification and configure `RESEND_PERMITTED_RECIPIENT` / 403 Forbidden handler instructing evaluators to use Google Sign-In.
- **Affects Deployment or Users:** Previously exposed private email in error responses; fully resolved with generic messaging.

---

### Finding 3: User Account Enumeration via Differentiated Login Error Responses
- **Severity:** High (Security)
- **File & Line:** `Backend/routes/auth.py:L92-L98`
- **Actual Problem:** When verifying user credentials in `email_password_login`, if an account exists but was registered via Google Sign-In (`user.password_hash is None`), the server returns `HTTP 400 Bad Request` with `"This account was registered with Google Sign-In. Please sign in with Google."`. If the email does not exist at all, the server returns `HTTP 401 Unauthorized` with `"Invalid email or password."`. Although a constant-time dummy hash verification is executed to prevent timing attacks, the differing HTTP status codes and error messages directly allow an attacker to probe whether an email is registered on PocketCircle.
- **Reproduction Evidence:**
  1. POST `/auth/login` with non-existent email -> Returns `401 Unauthorized ("Invalid email or password.")`.
  2. POST `/auth/login` with existing Google user email -> Returns `400 Bad Request ("This account was registered with Google Sign-In. Please sign in with Google.")`.
- **Recommended Correction:** Return a uniform response: `HTTP 401 Unauthorized` with `"Invalid email or password."` for all invalid credentials or unconfigured password accounts.
- **Affects Deployment or Users:** Yes. Prevents user enumeration attacks.

---

### Finding 4: Concurrency Check-Then-Write Race on OTP Verification Attempts
- **Severity:** High (Security / Rate Limiting)
- **File & Line:** `Backend/routes/auth.py:L278-L315`
- **Actual Problem:** In `/auth/verify-otp`, `EmailOTP` attempts are checked and incremented without a row lock (`with_for_update()`). An attacker firing 10 concurrent requests at the exact same millisecond with different guesses can read `attempts = 4` simultaneously across threads, bypassing the 5-attempt brute-force threshold.
- **Reproduction Evidence:**
  `select(EmailOTP).where(...)` executes without `.with_for_update()`. On concurrent requests, multiple transactions read `attempts < 5` before any transaction commits `attempts = 5`.
- **Recommended Correction:** Use an atomic attempt counter update or query with `.with_for_update()` in PostgreSQL, alongside in-memory/IP rate limiting.
- **Affects Deployment or Users:** Yes. Protects against concurrent automated brute-force attacks on 6-digit OTPs.

---

### Finding 5: Non-Deterministic Tie-Breaking in Debt Simplification Algorithm
- **Severity:** Medium (Ledger Invariant)
- **File & Line:** `Backend/services/balance_engine.py:L41-L42`
- **Actual Problem:** In `simplify_debts()`, the greedy cash flow algorithm sorts debtors and creditors:
  ```python
  debtors.sort(key=lambda x: x[1])
  creditors.sort(key=lambda x: x[1])
  ```
  Sorting strictly on balance amount (`x[1]`) relies on Python's Timsort stability. If two participants have the exact same balance (e.g., User A owes 50.00 and User B owes 50.00), the chosen settlement order depends on the initial order in `net_balances`, which in turn reflects arbitrary database row order. This violates the project's deterministic ledger invariant.
- **Reproduction Evidence:** Passing identical balance amounts in different dictionary insertion orders can generate different transfer assignments (e.g., Transfer 1 goes to User A vs User B).
- **Recommended Correction:** Incorporate the participant's UUID string as a deterministic secondary sort key: `key=lambda x: (x[1], str(x[0]))`.
- **Affects Deployment or Users:** Yes. In groups where members owe equal shares, the settlement plan may fluctuate between page loads unless sorted deterministically.

---

### Finding 6: Local Test Suite Dependent on Remote WAN Cloud Database
- **Severity:** Medium (DevOps / Quality)
- **File & Line:** `Backend/tests/conftest.py:L24-L30`, `Backend/.env:L1`
- **Actual Problem:** `tests/conftest.py` initializes its `test_engine` directly from `settings.DATABASE_URL`. In development, this points to a Neon serverless PostgreSQL instance hosted in AWS `us-east-2`. Every local `uv run pytest` execution sends thousands of queries across the internet, leading to an **8-minute (475-second)** test suite execution time for just 60 tests.
- **Reproduction Evidence:** Pytest run output: `60 passed, 7 warnings in 475.78s (0:07:55)`.
- **Recommended Correction:** Provide an isolated test engine configuration that supports fast local database execution (or SQLite for fast testing where supported) so tests run in seconds.
- **Affects Deployment or Users:** Affects developer velocity, CI execution time, and reliability during network disruptions.

---

### Finding 7: Redundant Route Registration Between `/api/v1` and Root Endpoints
- **Severity:** Medium (Architecture / Lean)
- **File & Line:** `Backend/main.py:L62-L73`, `Backend/routes/api_v1.py`
- **Actual Problem:** `Backend/main.py` includes `api_v1_router` (prefixing all endpoints under `/api/v1`) and then immediately includes the exact same routers at the root level (`/auth`, `/users`, `/friends`, `/groups`, etc.). The frontend exclusively interacts with the root-level routes (`/auth/...`, `/groups/...`). The `/api/v1` prefix is completely unused by the client.
- **Reproduction Evidence:** `git grep -i "/api/v1" Frontend/` produces zero matches.
- **Recommended Correction:** Clean up the routing architecture: designate the canonical routing pattern, remove dead duplication, and avoid route table bloat in FastAPI OpenAPI generation.
- **Affects Deployment or Users:** Cleaner OpenAPI documentation, reduced memory overhead, and elimination of route confusion.

---

### Finding 8: Unused Top-Level `requests` Dependency in Backend Manifest
- **Severity:** Low (Lean / Dependency Hygiene)
- **File & Line:** `Backend/pyproject.toml:L20`
- **Actual Problem:** `requests>=2.31.0` is specified as a direct runtime dependency in `pyproject.toml`. The codebase only imports `httpx` and `google.auth.transport.requests` (which is bundled with `google-auth`). Top-level `requests` is never imported.
- **Reproduction Evidence:** `git grep -E "^(import requests|from requests)" Backend/` yields zero matches.
- **Recommended Correction:** Remove `"requests>=2.31.0"` from `pyproject.toml` and re-lock `uv.lock`.
- **Affects Deployment or Users:** Eliminates unnecessary package installations and potential supply chain vulnerability footprint.

---

### Finding 9: Build Plugin Declared in Client Runtime Dependencies
- **Severity:** Low (Frontend Dependency Hygiene)
- **File & Line:** `Frontend/package.json:L15`
- **Actual Problem:** `@tailwindcss/vite` is listed under `dependencies` rather than `devDependencies`. It is a Vite build plugin, not code consumed by the client browser bundle at runtime.
- **Reproduction Evidence:** `Frontend/package.json` line 15 shows `"@tailwindcss/vite": "^4.3.3"`.
- **Recommended Correction:** Move `@tailwindcss/vite` to `devDependencies`.
- **Affects Deployment or Users:** Cleaner packaging; no effect on compiled assets.

---

### Finding 10: Dead No-Op User Cache Invalidation Function
- **Severity:** Low (Dead Code)
- **File & Line:** `Backend/core/security.py:L14-L16`
- **Actual Problem:** `def invalidate_user_cache(user_id: str | None = None) -> None: pass` is an empty stub function left over from a previous refactoring. It is imported and called in `routes/auth.py` and `routes/users.py`, creating the false impression that an active user cache exists.
- **Reproduction Evidence:** The function body is strictly `pass`.
- **Recommended Correction:** Safely remove the no-op stub and its import references after confirming no hidden behaviors rely on it.
- **Affects Deployment or Users:** Code readability and maintenance clarity.

---

## 4. Invariant & Architecture Assessment

| System Invariant | Verification Status | Notes |
|---|---|---|
| **Zero Floating-Point Math** | **VERIFIED** | All amounts stored as `NUMERIC(12, 2)` and computed using Python `Decimal` with explicit `quantize(Decimal("0.01"))`. |
| **Deterministic Paisa Distribution** | **VERIFIED** | Equal splits sort user UUIDs ascending and allocate remaining paisa cents deterministically to the first $r$ members. |
| **Greedy Debt Minimization** | **VERIFIED (With Tie-Break Fix Needed)** | Transfers generated are strictly $\le N - 1$. Adding secondary UUID sorting guarantees deterministic transfer paths. |
| **Zero-Sum Ledger Conservation** | **VERIFIED** | In-engine sanity check validates that $\sum \text{Net Balances} == 0.00$ on all reads and computations. |
| **Membership & Departure Locks** | **VERIFIED** | Members with non-zero balances or pending settlements cannot leave or be removed until fully settled. |
| **Off-Platform Settlement Flow** | **VERIFIED** | Double confirmation workflow: only payee can confirm payment receipt; bystander confirmation attempts return 403. |

---

## 5. Next Steps for Phase 2

Proceeding to Phase 2:
1. Fix dialect-aware engine initialization in `Backend/core/database.py` to support both SQLite and PostgreSQL.
2. Remove developer email leaks from `Backend/routes/auth.py`.
3. Standardize login error responses to eliminate account enumeration in `Backend/routes/auth.py`.
4. Harden OTP verification attempt limits against concurrent race conditions.
5. Add deterministic tie-breaking in `Backend/services/balance_engine.py`.
6. Provide fast, isolated local test engine configuration in `Backend/tests/conftest.py`.
7. Eliminate redundant routing in `Backend/main.py`.
8. Clean up unused dependencies (`requests` in backend, devDependencies in frontend).
9. Remove no-op `invalidate_user_cache` stub.
