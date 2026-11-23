# PocketCircle — Test Architecture & Quality Verification Strategy

This document details the automated testing strategy, execution instructions, financial invariant verification, and CI/CD test gates for the **PocketCircle** platform.

---

## 1. Test Architecture Overview

PocketCircle employs a multi-tiered test suite ensuring functional correctness, security boundary enforcement, and financial invariant guarantees:

```
┌────────────────────────────────────────────────────────┐
│                   Test Suites                          │
│                                                        │
│  1. Financial Invariants (test_financial_invariants.py)│
│     - Zero-sum group balance conservation              │
│     - Randomized equal split paisa conservation        │
│     - Remainder distribution determinism               │
│     - Minimum cash flow transfer bounds (<= N-1)       │
│                                                        │
│  2. Core Ledger & Splits (test_splits.py, balances.py) │
│     - Exact splits, unequal shares, multi-payer splits │
│     - Cyclic debt cancellation & transitive reduction  │
│                                                        │
│  3. Security & Access Control (test_security_audit...)  │
│     - Account enumeration & timing-safe responses      │
│     - OTP attempt limits (max 5) & atomic locking      │
│     - Cross-group IDOR access control                  │
│     - Unsettled balance group departure lockout        │
│                                                        │
│  4. End-to-End Critical Path (test_e2e_critical_path)  │
│     - Full journey: Register -> Create Circle ->       │
│       Invite Members -> Add Expense -> Settle Debt     │
│                                                        │
│  5. API Foundation & Audit (test_api_foundation.py)    │
│     - Security headers, CORS, CSRF origin defense      │
│     - Health/readiness probes & versioning             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Running Backend Tests Locally

### A. Fast In-Memory SQLite Mode (Recommended for Local Dev & CI)
The backend engine dynamically adapts connection pool arguments and SQL dialect constraints, allowing the entire 68-test suite to execute in isolated in-memory SQLite in ~28 seconds:

```bash
cd Backend
# Windows PowerShell
$env:DATABASE_URL="sqlite+aiosqlite:///:memory:"
uv run pytest -v

# Linux / macOS
DATABASE_URL="sqlite+aiosqlite:///:memory:" uv run pytest -v
```

### B. PostgreSQL Integration Mode (Staging / Production DB)
To run against a local or remote PostgreSQL database instance:

```bash
cd Backend
# Ensure DATABASE_URL in .env points to PostgreSQL
uv run pytest -v
```

---

## 3. Financial Invariant Verification

The platform enforces five mathematical invariants across all financial operations, validated via randomized property tests in `Backend/tests/test_financial_invariants.py`:

| Invariant | Mathematical Formulation | Code Guarantee | Test Reference |
| :--- | :--- | :--- | :--- |
| **Conservation of Expense Splits** | $\sum_{s \in \text{Shares}} s = \text{Total}$ | Quantized to `0.01` with remainder paisa distributed deterministically by UUID. | `test_invariant_equal_split_randomized_conservation` |
| **Zero-Sum Ledger** | $\sum_{m \in \text{Group}} \text{NetBalance}_m = 0.00$ | Verified before returning group balances; throws 500 error if $\ne 0.00$. | `test_invariant_net_balance_sum_zero_randomized_ledger` |
| **Max Transfers Bound** | $\|\text{Transfers}\| \le \max(0, N - 1)$ | Greedy Minimum Cash Flow algorithm guarantees at most $N-1$ bilateral transfers. | `test_invariant_debt_simplification_bounds_and_conservation` |
| **Deterministic Tie-Breaking** | Identical inputs $\implies$ Identical transfers | Debtor and creditor queues break ties by `(amount, str(user_id))`. | `test_invariant_debt_simplification_tie_breaker_determinism` |
| **Complete Debt Settlement** | $\text{Balance}_m + \sum \Delta_{\text{transfers}} = 0.00$ | Executing all proposed transfers reconciles all member debts to exactly ₹0.00. | `test_invariant_settlement_reconciliation_reduces_net_debt_to_zero` |

---

## 4. Frontend Quality Verification

The frontend codebase is validated via TypeScript typechecking, ESLint, and production Vite compilation:

```bash
cd Frontend

# 1. Type Check
npx tsc -b

# 2. Lint Check (0 errors, 0 warnings enforced)
npm run lint

# 3. Production Rollup Build
npm run build
```

---

## 5. Automated CI Verification Matrix

All pull requests and pushes to `master` must pass the GitHub Actions CI pipeline (`.github/workflows/ci.yml`):
- **Backend Job:**
  - Python 3.12 setup via `astral-sh/setup-uv`
  - Dependency sync via `uv sync --frozen`
  - Database schema tests on isolated SQLite
  - Full pytest execution: 67 passed, 1 skipped (concurrency race requiring Postgres), 0 failed
- **Frontend Job:**
  - Node.js 20 setup with npm cache
  - `npm ci`
  - `npm run lint`
  - `npm run build`
