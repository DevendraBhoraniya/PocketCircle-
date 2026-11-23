# Contributing to PocketCircle

Thank you for your interest in contributing to PocketCircle! We welcome community contributions, bug reports, and suggestions.

---

## Development Workflow

1. **Fork & Branch:** Create a feature branch from `master` (`git checkout -b feature/my-feature`).
2. **Local Environment:**
   - Backend: Set up Python 3.12 with `uv` (`uv sync`).
   - Frontend: Set up Node.js 20+ with npm (`npm install` inside `Frontend`).
3. **Run Checks Before Submitting:**
   - Backend tests: `DATABASE_URL="sqlite+aiosqlite:///:memory:" uv run pytest`
   - Frontend lint: `npm --prefix Frontend run lint`
   - Frontend build: `npm --prefix Frontend run build`
4. **Pull Requests:** Open a pull request against `master` describing your changes, motivation, and test evidence.
