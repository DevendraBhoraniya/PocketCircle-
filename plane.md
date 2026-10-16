# PocketCircle Implementation Plan

## 1. Product contract

**Purpose:** PocketCircle is a Google-login-only, shared-expense ledger for small friend groups. It tracks who paid, who owes, and confirmed settlements; it does **not** move money or integrate with UPI in the MVP.

**MVP outcome:** a user can sign in, find/accept friends, create a group, add a multi-payer equal or manual-split expense, see deterministic balances, request and confirm an off-platform settlement, and review the immutable activity history.

### Scope decisions

| Decision | MVP decision | Status |
|---|---|---|
| Authentication | Google ID-token login, backend-issued cookie session | Partial |
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
| React/Vite frontend | Home, Google login page, auth context, dashboard, and friends page | Partial - baseline established |
| Google token verification | Backend verifies Google ID token and creates/finds a user | Partial |
| Browser session | Access JWT and rotating hashed refresh token exist | Partial - security fixes required |
| User profile | User record, `/auth/me`, and 10-digit numeric Pocket ID generation with constraint | Partial |
| User search | `/users/search` by username and 10-digit Pocket ID + search UI in Friends page | Done (needs automated tests) |
| Friend requests / friend list | Full API (`/friends/requests`, accept, reject, cancel, list, remove) + `/friends` UI | Partial / Implemented (needs payload fix on Add Friend button & tests) |
| Groups / roles / membership | Not implemented | Pending |
| Expenses / splits / payers | Not implemented | Pending |
| Balance engine | Not implemented | Pending |
| Settlement confirmation | Not implemented | Pending |
| Notifications / audit logs | Not implemented | Pending |
| Tests / CI / deployment | Not implemented | Pending |

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
    core/            # config, DB, security, logging
    models/          # SQLAlchemy database shape
    schemas/         # Pydantic request/response DTOs
    services/        # domain rules and transactions
    repositories/    # queries only
    dependencies.py  # current user and role checks
    exceptions.py    # stable error envelope
  alembic/
  tests/
```

Retain the existing stack; migrate toward this layout incrementally rather than rewriting all authentication code at once.

## 5. Core data model

| Entity | Essential fields / constraints | Status |
|---|---|---|
| `users` | UUID, Google subject, verified email, name, username, unique 10-digit numeric Pocket ID (`valid_numeric_pocket_id`), avatar, timestamps, soft delete | Done |
| `refresh_tokens` | UUID, user FK, unique token hash, expiry, revocation timestamp | Partial |
| `friendships` | `(user_id, friend_id)`, status (`pending`, `accepted`, `rejected`), check `user_id <> friend_id`, unique `(user_id, friend_id)`, bidirectional query handling | Implemented via migration `f88220a7ddc6` |
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
| F0 | Rotate exposed credentials; remove secret files; add `.env` and OAuth-secret ignores; add `.env.example` | None | Root, `Backend/.gitignore`, `Frontend/.gitignore` | Pending | 0.5-1 day | Old credentials invalidated; no real secret is tracked or present in templates; secret scan passes. |
| F1 | Create one root Git baseline and CI skeleton | F0 | Root `.gitignore`, GitHub Actions, READMEs | Pending | 0.5-1 day | Clean initial commit; CI runs frontend typecheck/lint and backend tests. |
| F2 | Repair schema baseline and migration workflow | F0 | `Backend/alembic`, models, test database setup | Done / In Progress | 1-2 days | Empty PostgreSQL can upgrade to head, downgrade, then upgrade again. (`f88220a7ddc6` in place). |
| F3 | Harden authentication/session contract | F2 | Auth route, security, schemas, API client | Partial - cookie-only API responses, cookie cleanup, automatic refresh, and sign-in UI are implemented; live database/browser tests remain | 1-2 days | Tokens are cookie-only, logout actually clears cookies, response DTOs are explicit, browser auth tests pass. |
| F4 | Add API foundation | F3 | `/api/v1`, exception handlers, logging, dependencies, config | Pending | 1-2 days | Versioned routes, stable error envelope, request ID, redacted logs, health/readiness endpoints. |
| F5 | Add browser/API security controls | F3-F4 | Middleware, auth/client, deployment configuration | Pending | 1-2 days | CSRF/origin defense on mutations, rate limits on auth endpoints, production cookie policy documented and tested. |
| F6 | Build user profile and search | F4-F5 | User schemas/service/routes/UI | Done / Partial | 2-3 days | `/users/search` and search UI implemented for username and 10-digit pocket ID; tests pending. |
| F7 | Build friend-request lifecycle | F2, F4-F6 | Friendship migration/model/service/routes/UI | Done / Partial | 3-4 days | Send, list (incoming/outgoing), accept, reject, cancel, list friends, and remove friend implemented across backend and UI. Minor payload fix on frontend Add Friend button and automated tests pending. |
| F8 | Build groups and role-based membership | F7 | Group/member migrations, services, routes, UI | Next Up | 4-6 days | Owner/admin/member permissions, transfer ownership, removal/leave rules, and private-group access tests pass. |
| F9 | Implement the expense ledger | F8 | Expense models/services/routes/forms | Pending | 5-7 days | Members can create, view, edit, and soft-delete authorized expenses; all values use decimals and ledger history is recorded. |
| F10 | Implement split validation and allocation | F9 | Split service and pure unit tests | Pending | 3-4 days | Equal/manual/multi-payer splits total exactly; remaining paisa is allocated deterministically by user UUID. |
| F11 | Implement balances and settlement simplification | F9-F10 | Balance service/routes/UI | Pending | 4-6 days | Per-group net balances reconcile to zero; generated settlement plan has minimum transactions; tests cover 3+ member cases. |
| F12 | Implement settlement confirmation | F11 | Settlement service/routes/UI | Pending | 3-4 days | Payer request and payee confirmation are auditable; only valid group relationships can confirm; balances update correctly. |
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
| Unit | Decimal allocation, equal/manual splits, multi-payer ledger deltas, settlement simplification, permissions | Pending |
| Repository/integration | PostgreSQL constraints, transaction rollback, migration upgrade/downgrade, authorization boundaries, friend request flows | Pending |
| API | Auth lifecycle, validation errors, friend/group/expense/settlement workflows | Pending |
| Frontend | Auth state, protected routes, friend search & request interactions, form validation, loading/error/empty states | Pending |
| End-to-end | Login to friend add to group creation to expense to settlement confirmation | Pending |
| Security | CSRF, CORS, privilege escalation, IDOR, rate limit, secret scan | Pending |
| Accessibility | Keyboard navigation, focus, labels, contrast, screen-reader announcements | Pending |

## 9. Release gates and measurable success criteria

| Gate | Measure | Status |
|---|---|---|
| Security | No active exposed credentials; secret scan and dependency scan pass | Pending |
| Data correctness | Every tested balance ledger sums to zero; no floating-point arithmetic in money paths | Pending |
| Authorization | API tests prove users cannot read or mutate other private groups/expenses | Pending |
| UX speed | Create group in under 30 seconds and add expense in under 15 seconds in usability testing | Pending |
| Reliability | Critical-path E2E tests pass in CI; migrations work on an empty PostgreSQL database | Pending |
| Performance | Median API response under 300 ms for agreed MVP load profile; measure before claiming compliance | Pending |
| Transparency | Every expense, edit, deletion, role change, and settlement has an immutable activity entry | Pending |

## 10. Immediate next actions

1. **Frontend payload fix in `Friends_page.tsx`**: Update `performAction` to pass `{ friend_id: result.id }` in the JSON body when sending a friend request to `POST /friends/requests`.
2. **F8: Build groups and role-based membership**: Create group and member models, migrations, service layer, group management routes, and frontend group creation/management UI.
3. **Automated testing for F6 & F7**: Add unit and integration tests for user search and friend request lifecycles (including duplicate request prevention and self-request rejection).
