# PocketCircle — Public Demo Authentication Architecture

This document describes the public authentication strategy implemented for HR demonstrations and production deployment.

---

## 1. Google Sign-In (Primary Public Authentication)

Google Sign-In serves as the primary, unrestricted authentication method for all public evaluators, hiring managers, and demonstration reviewers.

### Backend Verification Mechanism
- **Verification Engine**: Google's official `google.oauth2.id_token.verify_oauth2_token` with `google.auth.transport.requests.Request`.
- **Security Validations**:
  1. **Audience Check**: Verified against the configured `GOOGLE_CLIENT_ID`.
  2. **Issuer Verification**: Strictly validates that `iss` is either `accounts.google.com` or `https://accounts.google.com`.
  3. **Signature & Expiration**: Cryptographically checked against Google's live public keys.
  4. **Email Verification**: Enforces `email_verified is True` in the token claims. Unverified Google emails are rejected immediately.
  5. **Required Claims**: Validates non-empty `sub` and `email` identity tokens.

### Account Linking & Hijacking Prevention
- When a Google identity authenticates:
  - If no user exists with the verified email, a new verified account is created and bound to `google_sub`.
  - If a user exists without a `google_sub`, the verified identity is securely linked, and `is_email_verified` is upgraded to `True`.
  - **Account Collision Protection**: If a user exists whose email matches but is already bound to a **different** `google_sub`, the request is rejected with `HTTP 409 Conflict` (`"An account with this email is already linked to a different Google account."`). This prevents unauthorized identity takeover.

---

## 2. Resend Testing Mode (Secondary Email OTP Authentication)

The application supports email OTP verification via [Resend](https://resend.com) utilizing the standard free testing sender domain (`onboarding@resend.dev`).

### Sandbox Operational Boundaries
- Under Resend's free tier, emails dispatched from `onboarding@resend.dev` are restricted strictly by Resend to the developer's registered account email.
- Attempting to dispatch emails to arbitrary external addresses triggers Resend API restrictions (`403/422: You can only send testing emails to your own email address...`).

### Graceful Grace & Security Protections
- **Configuration**:
  - `RESEND_TESTING_MODE: bool = True`
  - `RESEND_PERMITTED_RECIPIENT: str | None = None`
- **Graceful Error Handling**:
  - Unpermitted recipients in testing mode or Resend sandbox exceptions return an explicit, non-crashing `HTTP 403 Forbidden` response:
    ```json
    {
      "detail": "Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo."
    }
    ```
- **Privacy & Hygiene**:
  - The developer's personal email is **never** exposed in error messages, API responses, or client bundles.
  - OTP codes are never logged to console or logs in production environments (`settings.ENVIRONMENT != "development"`).
  - Failed deliveries **never** mark accounts as verified.

---

## 3. UI Experience & Guidelines for Evaluators

1. **Prominent Google Sign-In**: Positioned at the top of the authentication screen with the badge:
   `Primary Public Sign-In — Recommended for HR Demo`.
2. **Pre-Submission Notice**: An informational panel informs visitors that email OTP is in testing mode and recommends one-click Google Sign-In.
3. **Session Management**: All authenticated sessions receive standard secure, HTTP-only JWT cookies (`pc_access` and `pc_refresh`) with CSRF protection and refresh token rotation.
