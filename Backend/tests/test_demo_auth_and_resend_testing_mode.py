import uuid
from unittest.mock import AsyncMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.security import hash_password
from models.user import User
from services.email_service import EmailDeliveryResult, EmailService, ResendEmailAdapter
from utils.verify_google_token import verify_google_token


@pytest.mark.asyncio
async def test_google_oauth_full_verification_valid(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
):
    """
    Test valid Google ID token authentication:
    Verifies audience, issuer, claims, creates new user, sets secure cookies.
    """
    google_sub = f"google_sub_{uuid.uuid4().hex[:12]}"
    email = f"google_verified_{uuid.uuid4().hex[:8]}@example.com"
    name = "Verified Google User"

    mock_google_payload = {
        "iss": "https://accounts.google.com",
        "sub": google_sub,
        "email": email,
        "email_verified": True,
        "name": name,
        "picture": "https://lh3.googleusercontent.com/photo.jpg",
    }

    monkeypatch.setattr("routes.auth.verify_google_token", lambda cred: mock_google_payload)

    res = await client.post(
        "/auth/google",
        json={"credential": "mock_valid_google_jwt_token"},
        headers={"Origin": "http://localhost:5173"},
    )

    assert res.status_code == 200, res.text
    data = res.json()
    assert data["message"] == "Signed in successfully"
    assert data["user"]["email"] == email
    assert data["user"]["name"] == name
    assert data["user"]["pocket_id"] is not None
    assert "access_token" in res.cookies
    assert "refresh_token" in res.cookies

    # Verify user in database has google_sub linked and is_email_verified
    db_q = await db_session.execute(select(User).where(User.email == email))
    db_user = db_q.scalar_one_or_none()
    assert db_user is not None
    assert db_user.google_sub == google_sub
    assert db_user.is_email_verified is True


@pytest.mark.asyncio
async def test_google_oauth_unverified_email_rejected():
    """
    Test that Google tokens with email_verified=False are rejected with HTTP 401.
    """
    unverified_payload = {
        "iss": "https://accounts.google.com",
        "sub": "sub_unverified_123",
        "email": "unverified@example.com",
        "email_verified": False,
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=unverified_payload):
        with pytest.raises(Exception) as exc_info:
            verify_google_token("dummy_token")
        assert "Google account email is not verified" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_oauth_invalid_issuer_rejected():
    """
    Test that tokens from untrusted issuers are rejected with HTTP 401.
    """
    bad_issuer_payload = {
        "iss": "https://attacker.evil.com",
        "sub": "sub_attacker_123",
        "email": "victim@example.com",
        "email_verified": True,
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=bad_issuer_payload):
        with pytest.raises(Exception) as exc_info:
            verify_google_token("dummy_token")
        assert "unverified token issuer" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_oauth_missing_claims_rejected():
    """
    Test that tokens missing sub or email claims are rejected.
    """
    missing_claims_payload = {
        "iss": "https://accounts.google.com",
        "email_verified": True,
    }

    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=missing_claims_payload):
        with pytest.raises(Exception) as exc_info:
            verify_google_token("dummy_token")
        assert "missing required identity claims" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_oauth_empty_credential_rejected():
    """
    Test that empty or whitespace-only credentials are immediately rejected with 401.
    """
    with pytest.raises(Exception) as exc_info:
        verify_google_token("   ")
    assert "credential must not be empty" in str(exc_info.value)


@pytest.mark.asyncio
async def test_google_oauth_account_linking_success(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
):
    """
    Test safe account linking:
    When an unverified email user signs in with Google, link google_sub and mark verified.
    """
    email = f"link_target_{uuid.uuid4().hex[:8]}@example.com"
    existing_user = User(
        email=email,
        name="Pre-existing Account",
        username=f"pre_{uuid.uuid4().hex[:6]}",
        pocket_id="9988776655",
        password_hash=hash_password("MyPassword123!"),
        is_email_verified=False,
        google_sub=None,
    )
    db_session.add(existing_user)
    await db_session.commit()

    google_sub = f"google_link_{uuid.uuid4().hex[:10]}"
    mock_payload = {
        "iss": "https://accounts.google.com",
        "sub": google_sub,
        "email": email,
        "email_verified": True,
        "name": "Pre-existing Account",
        "picture": "https://lh3.googleusercontent.com/avatar.jpg",
    }
    monkeypatch.setattr("routes.auth.verify_google_token", lambda cred: mock_payload)

    res = await client.post(
        "/auth/google",
        json={"credential": "valid_token_linking"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["email"] == email

    # Verify database has updated google_sub and is_email_verified
    await db_session.refresh(existing_user)
    assert existing_user.google_sub == google_sub
    assert existing_user.is_email_verified is True


@pytest.mark.asyncio
async def test_google_oauth_account_linking_collision_rejected(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
):
    """
    Test unauthorized account linking defense:
    If an account is already linked to Google ID A, an attempt to authenticate with Google ID B
    for the same email must be rejected with HTTP 409 Conflict.
    """
    email = f"collision_{uuid.uuid4().hex[:8]}@example.com"
    existing_user = User(
        email=email,
        name="Collision User",
        username=f"col_{uuid.uuid4().hex[:6]}",
        pocket_id="1122334455",
        google_sub="original_google_sub_11111",
        is_email_verified=True,
    )
    db_session.add(existing_user)
    await db_session.commit()

    attacker_google_sub = "different_google_sub_22222"
    mock_payload = {
        "iss": "https://accounts.google.com",
        "sub": attacker_google_sub,
        "email": email,
        "email_verified": True,
        "name": "Collision User",
    }
    monkeypatch.setattr("routes.auth.verify_google_token", lambda cred: mock_payload)

    res = await client.post(
        "/auth/google",
        json={"credential": "collision_token"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 409
    assert "already linked to a different Google account" in res.json()["detail"]


@pytest.mark.asyncio
async def test_resend_testing_mode_permitted_recipient_success(monkeypatch):
    """
    Test Resend testing mode with permitted recipient:
    When to_email matches RESEND_PERMITTED_RECIPIENT, sending proceeds through the adapter.
    """
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key_123456789")
    monkeypatch.setattr(settings, "RESEND_TESTING_MODE", True)
    monkeypatch.setattr(settings, "RESEND_PERMITTED_RECIPIENT", "demo-owner@pocketcircle.dev")

    adapter = ResendEmailAdapter()

    with patch("resend.Emails.send", return_value={"id": "msg_permitted_123"}):
        result = await adapter.send_otp(
            to_email="demo-owner@pocketcircle.dev",
            otp="123456",
            purpose="login",
        )
        assert result.success is True
        assert result.status == "provider_sent"
        assert result.message_id == "msg_permitted_123"


@pytest.mark.asyncio
async def test_resend_testing_mode_unsupported_recipient_rejected(monkeypatch):
    """
    Test Resend testing mode with external/unpermitted recipient:
    In testing mode, external emails are safely rejected with sandbox_restricted status
    and clear user explanation, without calling Resend API or exposing developer credentials.
    """
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key_123456789")
    monkeypatch.setattr(settings, "RESEND_TESTING_MODE", True)
    monkeypatch.setattr(settings, "RESEND_PERMITTED_RECIPIENT", "demo-owner@pocketcircle.dev")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    adapter = ResendEmailAdapter()

    result = await adapter.send_otp(
        to_email="external-evaluator@company.com",
        otp="123456",
        purpose="login",
    )
    assert result.success is False
    assert result.status == "sandbox_restricted"
    assert "configured demo account" in result.error
    assert "Google Sign-In" in result.error
    # Must NOT reveal developer's personal email
    assert "bhoraniya" not in result.error
    assert "demo-owner" not in result.error


@pytest.mark.asyncio
async def test_resend_testing_mode_api_endpoint_response(
    client: AsyncClient,
    monkeypatch,
):
    """
    Test that when an unpermitted recipient attempts registration/login in production testing mode,
    the API returns HTTP 403 with the recommended user-facing explanation and zero secrets/dev_otp.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "RESEND_TESTING_MODE", True)

    sandbox_restricted_result = EmailDeliveryResult(
        success=False,
        status="sandbox_restricted",
        provider="resend",
        error="Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
    )
    monkeypatch.setattr(EmailService, "send_otp_email", AsyncMock(return_value=sandbox_restricted_result))

    res = await client.post(
        "/auth/register",
        json={
            "name": "HR Evaluator",
            "email": "hr-recruiter@enterprise.com",
            "password": "ValidPassword123!",
        },
        headers={"Origin": "http://localhost:5173"},
    )

    assert res.status_code == 403
    detail = res.json()["detail"]
    assert "configured demo account" in detail
    assert "Google Sign-In" in detail
    # Ensure no secrets or dev_otp are returned
    assert "dev_otp" not in res.json()
    assert "bhoraniyadevendra" not in str(res.json())
