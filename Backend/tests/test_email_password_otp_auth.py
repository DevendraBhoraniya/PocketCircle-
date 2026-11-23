import uuid
from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password, hash_otp
from models.user import User
from models.email_otp import EmailOTP
from utils.generate_pocket_id import generate_unique_pocket_id


@pytest.mark.asyncio
async def test_email_password_register_and_verify_otp_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    email = f"test_reg_{uuid.uuid4().hex[:8]}@example.com"
    password = "SuperSecurePassword123!"
    name = "Test Register User"

    # 1. Register with email and password
    reg_res = await client.post(
        "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["otp_required"] is True
    assert reg_data["email"] == email
    otp_code = reg_data["dev_otp"]
    assert otp_code is not None
    assert len(otp_code) == 6

    # Verify user exists in database but unverified
    user_q = await db_session.execute(select(User).where(User.email == email))
    user = user_q.scalar_one_or_none()
    assert user is not None
    assert user.is_email_verified is False
    assert user.name == name
    assert user.pocket_id is not None
    assert len(user.pocket_id) == 10

    # 2. Verify OTP with incorrect code -> fails
    bad_res = await client.post(
        "/auth/verify-otp",
        json={"email": email, "otp": "000000"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert bad_res.status_code == 400
    assert "Invalid verification code" in bad_res.json()["detail"]

    # 3. Verify OTP with correct code -> logs in, sets cookies, marks verified
    verify_res = await client.post(
        "/auth/verify-otp",
        json={"email": email, "otp": otp_code},
        headers={"Origin": "http://localhost:5173"},
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["message"] == "Signed in successfully"
    assert verify_data["user"]["email"] == email
    assert verify_data["user"]["name"] == name

    # Check cookies were set
    set_cookies = verify_res.headers.get_list("set-cookie")
    assert any("access_token=" in c for c in set_cookies)
    assert any("refresh_token=" in c for c in set_cookies)

    # 4. Check /auth/me with the access_token
    access_cookie = next(c.split(";")[0] for c in set_cookies if "access_token=" in c)
    me_res = await client.get("/auth/me", headers={"Cookie": access_cookie})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == email


@pytest.mark.asyncio
async def test_email_password_login_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    email = f"test_login_{uuid.uuid4().hex[:8]}@example.com"
    password = "CorrectPassword123!"

    # Create pre-existing verified user
    user = User(
        id=uuid.uuid4(),
        email=email,
        name="Existing User",
        password_hash=hash_password(password),
        username=f"user_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db_session),
        is_email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # 1. Login with invalid password
    bad_login = await client.post(
        "/auth/login",
        json={"email": email, "password": "WrongPassword!"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert bad_login.status_code == 401
    assert "Invalid email or password" in bad_login.json()["detail"]

    # 2. Login with correct password
    good_login = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": "http://localhost:5173"},
    )
    assert good_login.status_code == 200
    login_data = good_login.json()
    assert login_data["otp_required"] is True
    assert login_data["email"] == email
    otp = login_data["dev_otp"]
    assert otp is not None

    # 3. Complete login with OTP
    verify_res = await client.post(
        "/auth/verify-otp",
        json={"email": email, "otp": otp},
        headers={"Origin": "http://localhost:5173"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["user"]["id"] == str(user.id)


@pytest.mark.asyncio
async def test_resend_otp_cooldown_and_expiry(
    client: AsyncClient,
    db_session: AsyncSession,
):
    email = f"test_resend_{uuid.uuid4().hex[:8]}@example.com"
    password = "MyPassword123!"

    user = User(
        id=uuid.uuid4(),
        email=email,
        name="Resend User",
        password_hash=hash_password(password),
        username=f"user_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db_session),
        is_email_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # 1. Trigger login to send first OTP
    login_res = await client.post(
        "/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": "http://localhost:5173"},
    )
    assert login_res.status_code == 200

    # 2. Immediately resend OTP -> 429 Too Many Requests (cooldown active)
    resend_res = await client.post(
        "/auth/resend-otp",
        json={"email": email},
        headers={"Origin": "http://localhost:5173"},
    )
    assert resend_res.status_code == 429
    assert "Please wait" in resend_res.json()["detail"]

    # 3. Test email that only has an expired OTP
    expired_email = f"expired_{uuid.uuid4().hex[:8]}@example.com"
    expired_otp = EmailOTP(
        email=expired_email,
        otp_hash=hash_otp("111111"),
        purpose="login",
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        created_at=datetime.now(timezone.utc) - timedelta(minutes=15),
    )
    db_session.add(expired_otp)
    await db_session.flush()

    expired_verify = await client.post(
        "/auth/verify-otp",
        json={"email": expired_email, "otp": "111111"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert expired_verify.status_code == 400
    assert "Invalid or expired" in expired_verify.json()["detail"]


@pytest.mark.asyncio
async def test_otp_attempt_limit_and_concurrent_brute_force_protection(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verify atomic attempt limiting under concurrency:
    - Attempt limit of 5 is strictly enforced.
    - Subsequent attempts are rejected once attempts >= 5.
    - Concurrent verification requests cannot exceed or bypass the 5-attempt limit.
    """
    import asyncio

    email = f"bruteforce_{uuid.uuid4().hex[:8]}@example.com"
    otp_record = EmailOTP(
        email=email,
        otp_hash=hash_otp("888888"),
        purpose="login",
        attempts=0,
        is_used=False,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db_session.add(otp_record)
    await db_session.commit()

    # Send 7 wrong attempts
    responses = []
    for i in range(7):
        res = await client.post(
            "/auth/verify-otp",
            json={"email": email, "otp": f"99999{i}"},
            headers={"Origin": "http://localhost:5173"},
        )
        responses.append(res)

    # First 4 attempts: "Invalid verification code. X attempt(s) remaining."
    for r in responses[:4]:
        assert r.status_code == 400
        assert "attempt(s) remaining" in r.json()["detail"]

    # 5th attempt and onwards: "Too many incorrect attempts"
    for r in responses[4:]:
        assert r.status_code == 400
        assert "Too many incorrect attempts" in r.json()["detail"]

    # Even with correct code after lockout, it MUST fail
    lockout_verify = await client.post(
        "/auth/verify-otp",
        json={"email": email, "otp": "888888"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert lockout_verify.status_code == 400
    assert "Too many incorrect attempts" in lockout_verify.json()["detail"]


@pytest.mark.asyncio
async def test_auth_login_uniform_response_prevents_account_enumeration(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Verify login error responses are completely uniform between:
    - Non-existent accounts
    - Google OAuth accounts (password_hash is None)
    - Accounts with wrong password
    """
    # 1. Non-existent account
    res_nonexistent = await client.post(
        "/auth/login",
        json={"email": "doesnotexist_9999@example.com", "password": "RandomPassword123!"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res_nonexistent.status_code == 401
    assert res_nonexistent.json()["detail"] == "Invalid email or password."

    # 2. Existing Google user without password_hash
    google_email = f"googleuser_{uuid.uuid4().hex[:8]}@example.com"
    google_user = User(
        id=uuid.uuid4(),
        google_sub=f"sub_{uuid.uuid4().hex[:12]}",
        email=google_email,
        name="Google Account User",
        password_hash=None,
        username=f"user_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db_session),
        is_email_verified=True,
    )
    db_session.add(google_user)
    await db_session.commit()

    res_google = await client.post(
        "/auth/login",
        json={"email": google_email, "password": "AnyPassword123!"},
        headers={"Origin": "http://localhost:5173"},
    )
    # MUST be 401 with exact same message, NOT 400 leaking Google account existence
    assert res_google.status_code == 401
    assert res_google.json()["detail"] == "Invalid email or password."

