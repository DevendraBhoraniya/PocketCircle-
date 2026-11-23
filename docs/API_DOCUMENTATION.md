# PocketCircle API Reference

The PocketCircle API provides RESTful endpoints for user authentication, friend management, expense tracking, debt calculations, and settlements.

All responses follow a consistent JSON format. In case of error, the payload returns an `error` envelope with a code, human-readable message, and request identifier.

Both root endpoints (`/auth`, `/groups`, etc.) and canonical versioned endpoints (`/api/v1/auth`, `/api/v1/groups`, etc.) are supported.

---

## 1. Authentication (`/auth` or `/api/v1/auth`)

### `POST /auth/register`
Register a new user account with email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123",
    "name": "Alex Mercer"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Verification code sent to your email",
    "email": "user@example.com",
    "user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```

### `POST /auth/verify-otp`
Verify a 6-digit numeric OTP sent to the user's email address.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "482910"
  }
  ```
- **Response (200 OK):** Sets `access_token` and `refresh_token` HTTP-only cookies and returns user details.

### `POST /auth/login`
Authenticate with email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK):** Returns user details and sets authentication cookies.
- **Error (401 Unauthorized):** Uniformly returns `"Invalid email or password."` to eliminate email enumeration.

### `POST /auth/google`
Authenticate or register via Google Sign-In ID token.
- **Request Body:**
  ```json
  {
    "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
  }
  ```

### `GET /auth/me`
Retrieve profile of currently authenticated user.

### `POST /auth/logout` & `POST /auth/logout-all`
- `/logout`: Clears session cookies and revokes current refresh token.
- `/logout-all`: Revokes all active refresh tokens for the user account.

---

## 2. Groups (`/groups` or `/api/v1/groups`)

### `GET /groups`
List all groups where the authenticated user is an active member.

### `POST /groups`
Create a new shared expense circle.
- **Request Body:**
  ```json
  {
    "name": "Weekend Goa Trip",
    "description": "Shared beach trip expenses",
    "visibility": "private",
    "initial_member_ids": ["uuid-1", "uuid-2"]
  }
  ```

### `GET /groups/{group_id}/overview`
Atomic aggregation endpoint returning group details, recent expenses, activity log, calculated balances, and recommended settlement plan in a single round-trip.

### `POST /groups/{group_id}/members`
Add an accepted friend to the circle.

### `POST /groups/{group_id}/leave`
Leave the group. Enforces that the user has a net balance of ₹0.00 and no pending settlements.

---

## 3. Expenses (`/groups/{group_id}/expenses`)

### `POST /groups/{group_id}/expenses`
Record a new expense with single or multiple payers and equal or exact split.
- **Equal Split Example:**
  ```json
  {
    "description": "Villa Booking",
    "amount": "15000.00",
    "split_type": "equal",
    "payers": [
      { "user_id": "uuid-alex", "amount": "10000.00" },
      { "user_id": "uuid-sam", "amount": "5000.00" }
    ],
    "participants": [
      { "user_id": "uuid-alex" },
      { "user_id": "uuid-sam" },
      { "user_id": "uuid-priya" }
    ]
  }
  ```

### `GET /groups/{group_id}/expenses`
List expenses for the group with payer and participant share breakdowns.

---

## 4. Balances & Settlements (`/groups/{group_id}`)

### `GET /groups/{group_id}/balances`
Returns net balances for each member. Validates that the sum of all net balances equals ₹0.00.

### `GET /groups/{group_id}/settlement-plan`
Returns the optimized list of transfers calculated via greedy cash flow reduction ($N-1$ maximum transfers).

### `POST /groups/{group_id}/settlements`
Initiate an off-platform settlement record.
- **Request Body:**
  ```json
  {
    "payee_id": "uuid-sam",
    "amount": "3333.33",
    "notes": "Paid via UPI"
  }
  ```

### `POST /groups/{group_id}/settlements/{settlement_id}/confirm`
Confirm receipt of payment (payee only). Atomically updates settlement status to `confirmed` and reconciles the group balance sheet.
