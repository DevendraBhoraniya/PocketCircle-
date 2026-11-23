# PocketCircle — Resume & Technical Interview Guide

This guide provides resume-ready bullet points, architectural highlights, and STAR-format technical interview answers derived directly from the PocketCircle engineering transformation.

---

## 1. Resume Entry Options

### Format A: Full-Stack / Backend Heavy (Recommended)
**PocketCircle | Full-Stack Shared Expense Ledger**
*Python, FastAPI, SQLAlchemy 2.0, PostgreSQL, React 19, TypeScript, Tailwind CSS, Docker, Vite*
- Engineered an asynchronous multi-party expense ledger supporting multi-payer contributions, exact/equal splits, and automated bilateral settlements.
- Developed a greedy cash flow simplification engine reducing circular and transitive debts to at most $N-1$ transfers, eliminating floating-point errors using strict Python `Decimal` minor-unit arithmetic.
- Fortified authentication via Google OAuth 2.0 and PBKDF2-HMAC-SHA256 (310k iterations) with timing-attack mitigation and atomic, row-level locked OTP verification (max 5 attempts).
- Architected a dialect-aware SQLAlchemy test suite executing 68 unit, invariant, and E2E tests against in-memory SQLite in ~28 seconds (17x acceleration over remote cloud execution).
- Implemented defense-in-depth network middleware including origin-based CSRF mitigation, strict Content Security Policy, and bounded LRU rate limiting.

### Format B: Systems & Software Engineering Focus
**PocketCircle | Core Ledger Engine & Cloud API**
*Python 3.12, FastAPI, PostgreSQL, SQLite, Pydantic, Docker, GitHub Actions CI/CD*
- Designed and benchmarked a greedy debt-simplification graph algorithm guaranteeing mathematical conservation of balances ($\sum B_i = 0.00$) and deterministic remainder distribution.
- Eliminated cross-database compatibility bottlenecks between SQLite and PostgreSQL through dynamic AST constraint compilers and deterministic functional unique index mappings.
- Built a zero-warning CI/CD pipeline running automated linting, type-checking, property-based financial invariant tests, and Docker container builds.

---

## 2. Deep-Dive Interview Talking Points

### A. Financial Invariant Integrity
- **Challenge:** Traditional expense apps using standard IEEE 754 floating-point types (`float` in Python or `number` in JS) introduce rounding discrepancies (e.g., $100 / 3 = 33.3333...$). In a financial ledger, missing pennies violate conservation of money.
- **Solution:** PocketCircle quantizes all inputs to `Decimal("0.01")`. When dividing uneven amounts, the engine calculates base shares via floor rounding and deterministically allocates remainder cents (paisa) to members sorted by their canonical UUID string. A post-allocation invariant assertion ensures $\sum \text{Shares} = \text{Total Amount}$ before any database record is persisted.

### B. Concurrency & OTP Brute-Force Mitigation
- **Challenge:** Naive attempt counting in REST APIs allows concurrent HTTP requests to bypass rate limits (TOCTOU race condition).
- **Solution:** Implemented atomic database-level increment expressions combined with row-level locking (`SELECT ... FOR UPDATE` on PostgreSQL). When attempts exceed 4, the record is invalidated in the same transaction. Verification uses `secrets.compare_digest` to prevent timing side channels.

### C. Database Dialect Adaptation
- **Challenge:** PostgreSQL features like regex constraints (`~`) and functional unique indexes (`LEAST`, `GREATEST`) fail under SQLite during local unit testing.
- **Solution:** Utilized SQLAlchemy's `@compiles` mechanism to dynamically translate regex checks into length assertions on SQLite, and registered deterministic `min`/`max` scalar functions on connection events, allowing reciprocal friendship uniqueness and composite notification indexes to run identically across engines.

---

## 3. Behavioral / Technical STAR Stories

### Situation 1: "Describe a complex algorithm you implemented."
- **Situation:** Users in a 10-person group had dozens of cross-cutting debts from a shared road trip, leading to confusing settlement chains.
- **Task:** Simplify group balances into the minimum possible direct payments without requiring a centralized clearinghouse.
- **Action:** Implemented a Greedy Minimum Cash Flow algorithm. Calculated net position for each member, segregated debtors from creditors, and matched the largest debtor with the largest creditor. Integrated deterministic UUID tie-breaking so identical balances yield consistent recommendations across devices.
- **Result:** Decreased required settlement transactions from $\mathcal{O}(N^2)$ worst-case to at most $N-1$, proven across 100 randomized property-based test runs.

### Situation 2: "Tell me about a security flaw you identified and fixed."
- **Situation:** The authentication login endpoint returned different error responses when an account existed with Google auth versus when it did not exist, allowing automated email enumeration. Additionally, user lookup timing varied by hundreds of milliseconds.
- **Task:** Eliminate both visual and timing-based enumeration vectors without degrading genuine user experience.
- **Action:** Standardized all failed login responses to HTTP 401 `"Invalid email or password."`. For non-existent accounts or OAuth-only users, injected a dummy PBKDF2 hash computation with 310,000 iterations to match the processing time of a real password verification.
- **Result:** Completely mitigated enumeration attacks; automated timing analysis tests confirmed indistinguishable response latencies.
