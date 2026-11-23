# PocketCircle — Security Architecture & Threat Model Review

This document provides a comprehensive security review and architectural risk assessment for **PocketCircle**, a multi-party expense-sharing platform. It details threat models, authorization barriers, cryptographic safeguards, financial ledger invariants, and vulnerability remediation history.

---

## 1. Threat Model & Trust Boundaries

```
[ Unauthenticated Internet ]
           │
           ▼
[ Cloudflare / Reverse Proxy ]
           │
     HTTPS / TLS 1.3
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ FastAPl Application Perimeter                               │
│                                                             │
│  [RequestIDAndLoggingMiddleware]                            │
│  [SecurityHeadersMiddleware] (HSTS, CSP, X-Frame, Nosniff)   │
│  [OriginCSRFDefenseMiddleware] (Blocks Cross-Origin POST)   │
│  [RateLimiterMiddleware] (Sliding window IP-based limiter)   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Authentication Layer                                  │  │
│  │ - Google OAuth Token Verifier (Async Worker Thread)   │  │
│  │ - PBKDF2 Password Verifier (Dummy hash timing guard)  │  │
│  │ - Atomic OTP Attempt Guard (Max 5 attempts)           │  │
│  │ - Signed HTTP-Only SameSite JWT Session Cookies       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Authorization & IDOR Control                          │  │
│  │ - Group Membership Verification                       │  │
│  │ - Role-Based Circle Governance (Owner / Admin / Member)│ │
│  │ - Payee-Only Settlement Confirmation Gate             │  │
│  │ - Unsettled Debt Departure Lockout                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Financial Invariant Engine                            │  │
│  │ - Strict Decimal Minor-Unit Arithmetic (0.01)         │  │
│  │ - Deterministic Remainder Paisa Distribution          │  │
│  │ - Net Zero-Sum Conservation Validator                 │  │
│  │ - Greedy Minimum Cash Flow Simplifier                 │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            PostgreSQL (with SSL & Row-Level Locking)
```

### Assets at Risk
1. **Financial Ledger Integrity:** Manipulation of expense splits, unpaid settlements, or balance records.
2. **User Identity & Sessions:** Session hijacking, brute-forcing OTPs, enumeration of user emails/identities.
3. **Group Confidentiality:** Unauthorized viewing or modifying private circle expenses and membership.

---

## 2. Authentication & Credential Security

### A. Timing-Safe & Enumeration-Resistant Login
- **Threat:** Malicious actors attempt email enumeration by measuring API response times or error message differences between registered, unregistered, and Google OAuth-only accounts.
- **Remediation:**
  - Login endpoint (`POST /auth/login`) yields a uniform HTTP 401 error message: `"Invalid email or password."` across all failure branches.
  - When an unregistered email or an OAuth-only user (without a password hash) is provided, a dummy PBKDF2 verification against a static 310,000-iteration hash is executed. This eliminates side-channel timing discrepancies.

### B. Concurrency-Safe OTP Brute-Force Defense
- **Threat:** Concurrent automated attacks attempt to bypass OTP attempt counters before the counter can increment.
- **Remediation:**
  - Database queries use row-level locking (`SELECT ... FOR UPDATE` on PostgreSQL).
  - Attempt counts are incremented atomically at the database level:
    ```python
    db_otp.attempts = EmailOTP.attempts + 1
    if db_otp.attempts >= 5:
        db_otp.is_used = True
    ```
  - Successful verification executes an atomic conditional update matching `is_used == False` and `attempts < 5`.
  - Constant-time hash verification via `secrets.compare_digest(submitted_hash, db_otp.otp_hash)` prevents timing leaks.
  - OTPs expire strictly after 10 minutes and enforce a 60-second resend cooldown.

### C. Password Storage
- Standardized on OWASP recommendations: **PBKDF2-HMAC-SHA256** with unique 16-byte cryptographically secure random salts and **310,000 iterations**.

### D. Token Rotation & Session Revocation
- **Access Tokens:** Signed via HS256 JWT, stored in secure `HttpOnly`, `SameSite=Lax` cookies with 30-minute expiration.
- **Refresh Tokens:** Cryptographically random 256-bit entropy tokens, hashed via SHA-256 before storage.
- **Rotation:** Refreshing an access token revokes the old refresh token and issues a new one. Single-use enforcement prevents token replay.
- **Global Revocation:** `POST /auth/logout-all` invalidates all active refresh tokens for the authenticated user ID.

---

## 3. Authorization & IDOR Defense Matrix

| Resource / Endpoint | Actor Permitted | Authorization Check | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **GET /groups/{id}** | Member (or viewer if unlisted/public) | `GroupMember` active check or `group.visibility != 'private'` | Returns HTTP 403 if circle is private and actor is not a member |
| **PATCH /groups/{id}** | Owner / Admin | `actor_membership.role in ('owner', 'admin')` | HTTP 403 if role is member |
| **DELETE /groups/{id}** | Owner | `actor_membership.role == 'owner'` | HTTP 403 if non-owner |
| **POST /groups/{id}/expenses** | Active Group Member | `get_active_member(group, actor.id)` | Rejects non-members with HTTP 403; verifies payers/participants belong to group |
| **PATCH /groups/{id}/expenses/{id}**| Expense Creator or Circle Admin/Owner | Creator ID check or membership role | Rejects unauthorized edits with HTTP 403 |
| **POST /groups/{id}/settlements/{id}/confirm** | Payee Only | `settlement.payee_id == actor.id` | Rejects payers or third-parties with HTTP 403 |
| **POST /groups/{id}/leave** | Member with Zero Balance | `assert_member_can_depart()` | Rejects with HTTP 422 if net balance $\ne 0.00$ or pending settlements exist |

---

## 4. Financial Integrity & Calculation Invariants

All monetary values are represented as `Decimal` instances quantized to two decimal places (`0.01`). At no point are floating-point operations permitted in ledger calculations.

### Formal Invariants Enforced in Code
1. **Conservation of Group Spending:**
   $$\sum_{p \in \text{Payers}} p.\text{amount} = \sum_{s \in \text{Participants}} s.\text{amount} = \text{Expense}.\text{total}$$
2. **Zero-Sum Ledger Balance:**
   $$\sum_{u \in \text{Members}} u.\text{net\_balance} = 0.00$$
   *Verified before returning balances; throws HTTP 500 if non-zero.*
3. **Deterministic Paisa Remainder Distribution:**
   When an amount does not divide evenly (e.g., ₹100.00 among 3 members = ₹33.33 each with ₹0.01 remainder), the remainder cents are allocated strictly to participants ordered by their canonical UUID string ascending.
4. **Greedy Debt Simplification Guarantee:**
   The debt simplifier generates at most $N-1$ bilateral transfers for $N$ indebted members without creating or destroying funds.

---

## 5. Network, Application & Infrastructure Defenses

### A. Cross-Site Request Forgery (CSRF)
- `OriginCSRFDefenseMiddleware` intercepts all state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- It verifies that the `Origin` or `Referer` header matches `ALLOWED_ORIGINS`.
- Requests from unauthorized origins are rejected with HTTP 403 `CSRF_ORIGIN_REJECTED`.

### B. Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforced in production)
- Strict `Content-Security-Policy` restricting script, connect, and style sources.

### C. Rate Limiting
- `RateLimiterMiddleware` enforces sliding-window in-memory rate limiting with bounded LRU cleanup (maximum 10,000 tracked IP entries) to prevent memory exhaustion attacks.

### D. Production Environment Validation
- Startup validation (`Backend/core/startup.py`) verifies:
  - `JWT_SECRET` is not default and has at least 32 characters in production.
  - `EMAIL_PROVIDER` is not set to `console` in production.
  - Database connection pool parameters are dialect-optimized.

---

## 6. Audit & Logging Integrity

- All administrative, financial, and membership actions emit immutable audit events to the `audit_events` database table.
- Events record: `actor_id`, `group_id`, `action`, `entity_type`, `entity_id`, structured JSON details, and UTC timestamp.
- Internal exception stack traces are logged via server-side logger and never exposed in API response envelopes.
