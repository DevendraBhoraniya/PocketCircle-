# Changelog

All notable changes to the PocketCircle project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-11-23

### Added
- Multi-party expense sharing with equal and exact split mechanisms.
- Multi-payer support allowing multiple group members to co-fund an expense.
- Greedy debt simplification engine ensuring at most N-1 bilateral transfers.
- In-memory SQLite dialect support for local and CI testing (~28s test suite).
- Atomic OTP verification guard enforcing a maximum of 5 attempts.
- Unified timing-resistant authentication responses to prevent account enumeration.
- Comprehensive property-based financial invariant test suite (`test_financial_invariants.py`).
- Full documentation suite (`ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md`, `DEPLOYMENT.md`, `TESTING.md`, `SECURITY_REVIEW.md`, `FINAL_AUDIT.md`).

### Fixed
- Fixed SQLite database engine initialization parameters (`pool_size` and `max_overflow` constrained to PostgreSQL).
- Eliminated personal developer email disclosures in API responses.
- Resolved reciprocal friendship unique constraint race conditions.
- Added composite database indexes for notifications and refresh tokens.
