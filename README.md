# PocketCircle

PocketCircle is a Google-login-only, shared-expense ledger for small friend groups. It tracks who paid, who owes, and confirmed settlements without handling fiat or UPI transactions directly.

## Tech Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 (asyncio), PostgreSQL / Neon, Alembic, Pydantic v2
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Google Identity Services
- **Design System:** Custom neo-grotesque design with sticker cards, hairline borders, toxic lime accents, and cream canvas

## Repository Layout

```text
pocket_circle/
  ├── Backend/                # FastAPI backend service
  │   ├── alembic/            # Database schema migrations
  │   ├── core/               # App configuration, database, security, middleware
  │   ├── models/             # SQLAlchemy ORM models (users, friendships, tokens)
  │   ├── routes/             # API route controllers
  │   ├── schemas/            # Pydantic request/response schemas
  │   ├── utils/              # Utilities (pocket ID, token verification)
  │   └── tests/              # Automated test suite
  ├── Frontend/               # React + Vite client
  │   ├── src/
  │   │   ├── api/            # API client with credentials support
  │   │   ├── components/     # Reusable UI components
  │   │   ├── context/        # Auth state and provider
  │   │   └── pages/          # Home, Login, Dashboard, Friends
  │   ├── DESIGN.md           # Visual design specification
  │   └── Design_tokens.json  # Design token definitions
  ├── plan.md                 # Project implementation plan and tracking
  └── .github/workflows/      # Continuous Integration workflows
```

## Getting Started

### 1. Environment Setup

Copy example environment files:

```bash
# Backend
cp Backend/.env.example Backend/.env

# Frontend
cp Frontend/.env.example Frontend/.env
```

### 2. Single-Command Dev Environment (Recommended)

From the project root:

```bash
npm run dev
```

Or on Windows PowerShell / Command Prompt:

```powershell
.\dev.ps1
```

This concurrently launches:
- **FastAPI Backend:** http://localhost:8000 (auto-reloading on port 8000)
- **Vite Frontend:** http://localhost:5173 (HMR on port 5173)

### 3. Running Services Individually (Optional)

```bash
cd Frontend
npm install
npm run dev
```

### 4. Running Tests

```bash
cd Backend
pytest
```
