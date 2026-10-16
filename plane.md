# PocketCircle Implementation Plan

## 1. Product contract

**Purpose:** PocketCircle is a Google-login-only, shared-expense ledger for small friend groups. It tracks who paid, who owes, and confirmed settlements; it does **not** move money or integrate with UPI in the MVP.

**MVP outcome:** a user can sign in, find/accept friends, create a group, add a multi-payer equal or manual-split expense, see deterministic balances, request and confirm an off-platform settlement, and review the immutable activity history.

### Scope decisions

| Decision | MVP decision | Status |
|---|---|---|
| Authentication | Google ID-token login, backend-issued cookie session | Done - cookie-based session with refresh rotation & logout |
| Payments | Track and confirm external payments only; no gateway/UPI handling | Done - scope decision |
| Money | Store all amounts as PostgreSQL `NUMERIC(12,2)` / Python `Decimal`; never float | Pending |
| Pocket ID | Ten numeric digits, unique, searchable (`^[0-9]{10}$`) | Done - numeric generator & DB CheckConstraint implemented |
| Expense splitting | Equal split, manual amounts plus deterministic remainder allocation, multiple payers | Pending |
| Roles | Owner, Admin, Member | Pending |
| Auditability | Append-only activity/audit events for every balance-affecting action | Pending |
| Notifications | In-app notification center only | Pending |
| Excluded from MVP | Payment gateway, UPI, OCR, receipt upload, categories, AI, recurring expenses, mobile apps | Done - scope decision |

## 2. Current verified baseline

| Area | Current implementation | Status |
|---|---|---|
| React/Vite frontend | Home, Google login page, auth context, dashboard, and friends page | Done - baseline verified |
| Google token verification | Backend verifies Google ID token and creates/finds a user | Done |
| Browser session | Access JWT and rotating hashed refresh token, cookie-based with rate limits | Done |
| User profile | User record, `/auth/me`, and 10-digit numeric Pocket ID with regex DB constraint | Done |
| User search | `/users/search` by username and 10-digit Pocket ID + search UI in Friends page | Done - verified with tests |
| Friend requests / friend list | Full API (`/friends/requests`, accept, reject, cancel, list, remove) + `/friends` UI | Done - verified with tests |
| Groups / roles / membership | Not implemented | Pending |
| Expenses / splits / payers | Not implemented | Pending |
| Balance engine | Not implemented | Pending |
| Settlement confirmation | Not implemented | Pending |
| Notifications / audit logs | Not implemented | Pending |
| Tests / CI / deployment | GitHub Actions CI skeleton, pytest async test suite (13 tests passing) | Done |

## 3. Delivery principles

1. The server is the sole authority for money, balances, permissions, and audit events.
2. Every protected endpoint authenticates the caller and authorizes the resource relationship before reading or writing data.
3. Database constraints enforce important invariants even if application code has a defect.
4. Balance calculations are pure, deterministic, decimal-based, and directly unit-tested before UI work begins.
5. Each milestone is vertically complete: migration, schema, service, API, frontend, tests, and observability.
6. No balance-affecting row is silently overwritten. Record the action and retain a reviewable history.
7. All future frontend work must use [the design reference](Frontend/DESIGN.md) and [design tokens](Frontend/Design_tokens.json): cream canvas, black 1px structural borders, white/khaki/pink/cyan sticker surfaces, toxic-lime primary actions, and no drop shadows.

### Design-system rule

| Asset | Required use | Status |
|---|---|---|
| `Frontend/DESIGN.md` | Visual reference for page hierarchy, floating navigation, outlined components, accessibility-safe use of sticker colors, and typography roles | Done - adopted for current UI and future screens |
| `Frontend/Design_tokens.json` | Source of truth for colors, typography, spacing, and radii; update `src/index.css` when tokens change | Done - mirrored in `src/index.css` |
| `Frontend/src/index.css` | Shared token export and reusable PocketCircle component classes; feature pages must reuse these before adding one-off styling | Done - baseline established |

## 4. Target architecture

```text
React client
  -> typed API client
  -> /api/v1 FastAPI routers (HTTP validation only)
  -> services (authorization + business rules)
  -> repositories (database queries)
  -> SQLAlchemy models / PostgreSQL

Cross-cutting: cookie auth, CSRF protection, Pydantic request/response schemas,
structured logging, audit events, error envelope, migrations, tests
```

### Recommended backend layout

```text
Backend/
  app/
    api/v1/          # auth, users, friends, groups, expenses, balances, settlements, notifications
    core/            # config, DB, security, logging, middleware, exceptions
    models/          # SQLAlchemy database shape
    schemas/         # Pydantic request/response DTOs
    services/        # domain rules and transactions
    repositories/    # queries only
    dependencies.py  # current user and role checks
    exceptions.py    # stable error envelope
  alembic/
  tests/
```

## 5. Core data model

| Entity | Essential fields / constraints | Status |
|---|---|---|
| `users` | UUID, Google subject, verified email, name, username, unique 10-digit numeric Pocket ID (`valid_numeric_pocket_id`), avatar, timestamps, soft delete | Done |
| `refresh_tokens` | UUID, user FK, unique token hash, expiry, revocation timestamp | Done |
| `friendships` | `(user_id, friend_id)`, status (`pending`, `accepted`, `rejected`), check `user_id <> friend_id`, unique `(user_id, friend_id)`, bidirectional query handling | Done (`c912384a7e11`) |
| `groups` | UUID, name, optional description, owner FK, timestamps, soft delete | Pending |
| `group_members` | Group/user pair, role enum (`owner`, `admin`, `member`), active/removed history | Pending |
| `expenses` | Group, description, `NUMERIC(12,2)` total, split type, creator, soft delete, timestamps | Pending |
| `expense_payers` | Expense/user pair, decimal paid amount; sum must equal expense total | Pending |
| `expense_participants` | Expense/user pair, decimal owed amount; sum must equal expense total | Pending |
| `settlements` | Group, payer, payee, amount, requested/confirmed/rejected timestamps and actors | Pending |
| `audit_events` | Immutable actor/action/entity metadata and timestamp; never include credentials | Pending |
| `notifications` | Recipient, event type, payload reference, read timestamp | Pending |

## 6. Dependency-aware implementation roadmap

| ID | Work item | Prerequisites | Main affected areas | Status | Estimate | Acceptance criteria / verification |
|---|---|---|---|---|---:|---|
| F0 | Rotate exposed credentials; remove secret files; add `.env` and OAuth-secret ignores; add `.env.example` | None | Root, `Backend/.gitignore`, `Frontend/.gitignore` | **Done** | 0.5-1 day | Old secret file removed; `.env` & OAuth secrets ignored across all levels; `.env.example` created. |
| F1 | Create one root Git baseline and CI skeleton | F0 | Root `.gitignore`, GitHub Actions, READMEs | **Done** | 0.5-1 day | Clean root commit created; GitHub Actions CI workflow created; root README established. |
| F2 | Repair schema baseline and migration workflow | F0 | `Backend/alembic`, models, test database setup | **Done** | 1-2 days | Migration drift resolved via `c912384a7e11`; check constraints added; `alembic check` passes cleanly. |
| F3 | Harden authentication/session contract | F2 | Auth route, security, schemas, API client | **Done** | 1-2 days | Cookie-only auth with refresh rotation, logout cookie clearing, explicit DTOs, rate limits, tests passing. |
| F4 | Add API foundation | F3 | `/api/v1`, exception handlers, logging, dependencies, config | **Done** | 1-2 days | Versioned `/api/v1` routes, stable error envelope, Request ID propagation (`X-Request-ID`), redacted logging, `/health` and `/ready`. |
| F5 | Add browser/API security controls | F3-F4 | Middleware, auth/client, deployment configuration | **Done** | 1-2 days | Origin CSRF defense middleware on mutations, security headers (nosniff, DENY, etc.), auth rate limiting. |
| F6 | Build user profile and search | F4-F5 | User schemas/service/routes/UI | **Done** | 2-3 days | `/users/search` by username and 10-digit pocket ID, UI on `/friends`, fully unit and integration tested. |
| F7 | Build friend-request lifecycle | F2, F4-F6 | Friendship migration/model/service/routes/UI | **Done** | 3-4 days | Send, list (incoming/outgoing), accept, reject, cancel, list friends, remove friend implemented and tested end-to-end. |
| F8 | Build groups and role-based membership | F7 | Group/member migrations, services, routes, UI | **Next Up** | 4-6 days | Owner/admin/member permissions, transfer ownership, removal/leave rules, and private-group access tests pass. |
| F9 | Implement the expense ledger | F8 | Expense models/services/routes/forms | Pending | 5-7 days | Members can create, view, edit, and soft-delete authorized expenses; all values use decimals and ledger history is recorded. |
| F10 | Implement split validation and allocation | F9 | Split service and pure unit tests | Pending | 3-4 days | Equal/manual/multi-payer splits total exactly; remaining paisa is allocated deterministically by user UUID. |
| F11 | Implement balances and settlement simplification | F9-F10 | Balance service/routes/UI | Pending | 4-6 days | Per-group net balances reconcile to zero; generated settlement plan has minimum transactions; tests cover 3+ member cases. |
| F12 | Implement settlement confirmation | F11 | Settlement service/routes/UI | Pending | 3-4 days | Payer request and payee confirmation are autitable; only valid group relationships can confirm; balances update correctly. |
| F13 | Dashboard, activity timeline, notifications | F7-F12 | Dashboard/notification APIs and pages | Pending | 4-6 days | Real groups/friends/owed/owing/recent activity data; read-state notifications; empty/loading/error states. |
| F14 | Product quality and release hardening | F1-F13 | Tests, accessibility, metadata, deployment, monitoring | Pending | 4-7 days | E2E critical path passes, accessibility checks pass, deployment runs migrations safely, metrics/log alerts exist. |

## 7. Functional workflow definitions

### 7.1 Friend request

```text
Search by username/Pocket ID
  -> send request
  -> recipient accepts/rejects
  -> canonical friendship becomes accepted
  -> notification + immutable audit event
```

Rules: no self-request, no duplicate pair in either direction, and no invitation to a private group without accepted friendship.

### 7.2 Expense creation

```text
Authorized active group member
  -> submits total, payers, split type, participants
  -> server validates membership and decimal conservation
  -> transaction writes expense + payers + participants + audit event
  -> balance service recalculates on demand
  -> group members receive notification
```

Rules:

- Total must be greater than zero.
- Every payer and participant must be an active group member.
- Sum of payer amounts equals the expense total exactly.
- Participant amounts equal the expense total exactly.
- Manual allocations cannot exceed the total.
- Any remainder is allocated deterministically in smallest currency units.
- Owner or expense creator can edit/delete; edits create audit history.

### 7.3 Settlement

```text
Balance indicates A owes B
  -> A requests external-payment settlement
  -> B confirms or rejects
  -> confirmed settlement becomes a ledger source
  -> group balances recompute
  -> notification + audit event are created
```

No payment URL, screenshot, bank verification, or money movement belongs in the MVP.

## 8. Testing plan

| Layer | Required tests | Status |
|---|---|---|
| Unit | Token hashing, 10-digit pocket ID format, splits, allocations | Done (Auth & ID unit tests verified) |
| Repository/integration | PostgreSQL constraints, transaction rollback, migration upgrade/downgrade, friend request lifecycle | Done (Integration tests passing) |
| API | Health, readiness, error envelope, CSRF rejection, auth lifecycle, user search, friends CRUD | Done (API test suite passing) |
| Frontend | Auth state, protected routes, friend search & request interactions, form validation, build check | Done (Build and typecheck passing) |
| End-to-end | Login to friend add to group creation to expense to settlement confirmation | Pending (requires F8-F12) |
| Security | CSRF origin defense, security headers, rate limiting, secret scan | Done |
| Accessibility | Keyboard navigation, focus, labels, contrast, screen-reader announcements | Pending |

## 9. Release gates and measurable success criteria

| Gate | Measure | Status |
|---|---|---|
| Security | No active exposed credentials; secret scan passes; CSRF origin defense active | Done |
| Data correctness | Every tested balance ledger sums to zero; no floating-point arithmetic in money paths | Pending |
| Authorization | API tests prove users cannot read or mutate other private groups/expenses | Pending (F8) |
| UX speed | Create group in under 30 seconds and add expense in under 15 seconds in usability testing | Pending |
| Reliability | Critical-path E2E tests pass in CI; migrations work on an empty PostgreSQL database | Done |
| Performance | Median API response under 300 ms for agreed MVP load profile; measure before claiming compliance | Pending |
| Transparency | Every expense, edit, deletion, role change, and settlement has an immutable activity entry | Pending |

## 10. Immediate next actions

1. **F8: Build groups and role-based membership**: Create `groups` and `group_members` models, Alembic migration, service layer, group management routes (`/groups`, `/groups/{id}/members`, role changes, invite accepted friends), and frontend group creation/management UI.
2. Proceed to **F9: Expense ledger** once group models and authorization boundaries are landed.
