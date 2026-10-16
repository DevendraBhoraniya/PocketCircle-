# Backend Structure & Working

This document explains the current state of the backend and where to find different functionalities.

## Architecture Pattern
The backend follows a standard layered architecture:
- **Routes (`/routes`)**: API endpoints. They handle HTTP requests, validate input via Schemas, and call the Core/Services.
- **Models (`/models`)**: SQLAlchemy Database ORM models. This is how data is structured in PostgreSQL.
- **Schemas (`/schemas`)**: Pydantic models. Used for validating incoming JSON request bodies and structuring API responses.
- **Core (`/core`)**: Core configuration, security (JWT), database setup, and app lifespan events.
- **Utils (`/utils`)**: Helper functions.

## Current Files and Their Roles

### 1. Core Config & Setup
- **`core/config.py`**: Loads environment variables using Pydantic Settings (e.g., Database URL, JWT Secrets, Google Client ID).
- **`core/database.py`**: Sets up the async SQLAlchemy engine and session maker to connect to PostgreSQL (Neon).
- **`core/security.py`**: Contains all JWT logic. It creates Access & Refresh tokens, hashes tokens for DB storage, and contains the `get_current_user` dependency which validates secure cookies.
- **`core/startup.py`**: Handles FastAPI startup/shutdown lifespan events (e.g., creating database tables via `Base.metadata.create_all`).

### 2. Authentication & Users
- **`models/user.py`**: The SQLAlchemy model for the `users` table. Stores Google Sub, Email, Username, and Pocket ID.
- **`models/refresh_token.py`**: Stores hashed refresh tokens to manage long-lived sessions securely.
- **`schemas/auth.py`**: Contains the Pydantic schema (`GoogleLoginRequest`) ensuring we get the `credential` string from the frontend.
- **`routes/auth.py`**: Contains the `/auth/google`, `/auth/refresh`, `/auth/logout`, and `/auth/me` endpoints. It handles decoding the Google token, creating users, and setting HttpOnly Secure cookies.
- **`utils/verify_google_token.py`**: Uses the official Google Python library to verify the token signature.
- **`utils/generate_pocket_id.py` & `generate_user_name.py`**: Helpers to assign random usernames and unique 8-digit pocket IDs to new users.

### 3. Entry Point
- **`main.py`**: The FastAPI application instance. Configures CORS (allowing `localhost:5173` with credentials) and includes the routers (currently just `auth.router`).

## Future Additions
When building new features, follow this flow:
1. Create DB model in `models/`.
2. Create input/output validation in `schemas/`.
3. Build the API endpoints in `routes/` (or `api/v1/`).
4. (Optional) For complex logic like the Balance Engine, create a `services/` directory to keep routes clean.
