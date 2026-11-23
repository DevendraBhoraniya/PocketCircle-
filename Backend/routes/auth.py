import asyncio
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import case, select, update

from core.middleware import auth_rate_limiter
from core.database import get_db
from core.config import settings
from core.security import (
    create_access_token, 
    generate_refresh_token, 
    hash_token,
    get_current_user,
    hash_password,
    verify_password,
    generate_otp,
    hash_otp,
)
from schemas.auth import (
    AuthenticatedUserResponse,
    GoogleLoginRequest,
    SessionResponse,
    EmailPasswordLoginRequest,
    EmailPasswordRegisterRequest,
    VerifyOtpRequest,
    ResendOtpRequest,
    OtpSentResponse,
)
from models.user import User
from models.refresh_token import RefreshToken
from models.email_otp import EmailOTP
from services.email_service import EmailService
from utils.generate_pocket_id import generate_unique_pocket_id
from utils.verify_google_token import verify_google_token
from utils.generate_user_name import generate_unique_username

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# Constant-time dummy PBKDF2 hash to eliminate response timing discrepancies during login enumeration attacks
DUMMY_PASSWORD_HASH = "404b56c7001745e0f5683d86213b72f3$6966fdb421537c287fb665a8b09e943b771528d58f2c1fe69428dcd41749da9c"

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )

@router.post("/login", response_model=OtpSentResponse)
async def email_password_login(
    data: EmailPasswordLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again in a minute.",
        )

    email = data.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if not user:
        # Constant-time dummy verification to thwart user enumeration via response timing
        verify_password(data.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.password_hash:
        # Constant-time dummy verification to eliminate user enumeration between email/password and OAuth accounts
        verify_password(data.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Invalidate previous unused OTPs for this email
    await db.execute(
        update(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.is_used.is_(False))
        .values(is_used=True)
    )

    # Generate and store new OTP
    otp = generate_otp(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db_otp = EmailOTP(
        email=email,
        otp_hash=hash_otp(otp),
        purpose="login",
        expires_at=expires_at,
    )
    db.add(db_otp)
    await db.commit()

    # Deliver OTP via email service
    delivery = await EmailService.send_otp_email(email, otp, purpose="login")
    is_success = getattr(delivery, "success", bool(delivery))
    delivery_status = getattr(delivery, "status", "console_logged" if is_success else "failed")
    delivery_error = getattr(delivery, "error", None)

    if not is_success and settings.ENVIRONMENT != "development":
        if delivery_status == "sandbox_restricted":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=delivery_error or "Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to dispatch verification email. Please use Google Sign-In to access the public demo.",
        )

    # dev_otp is strictly restricted to local development environments when running console fallback or sandbox restricted
    dev_otp = otp if (settings.ENVIRONMENT == "development" and delivery_status in ("console_logged", "sandbox_restricted")) else None

    if delivery_status == "provider_sent":
        message = f"Verification code sent to {email}. Please check your Inbox and Spam/Junk folder."
    elif delivery_status == "sandbox_restricted":
        message = "Resend Sandbox Restriction: Emails on the free sandbox domain can only be sent to verified domain recipients. In development, use the verification code below."
    else:
        message = "Verification code generated in local console mode."

    return {
        "message": message,
        "email": email,
        "otp_required": True,
        "dev_otp": dev_otp,
        "delivery_status": delivery_status,
        "sandbox_warning": delivery_error if delivery_status == "sandbox_restricted" else None,
    }


@router.post("/register", response_model=OtpSentResponse)
async def email_password_register(
    data: EmailPasswordRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again in a minute.",
        )

    if len(data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Password must be at least 8 characters long.",
        )

    email = data.email.strip().lower()
    name = data.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Name cannot be empty.",
        )

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if user:
        if user.is_email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please sign in.",
            )
        # Update unverified user details and password
        user.name = name
        user.password_hash = hash_password(data.password)
        await db.flush()
    else:
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(data.password),
            username=await generate_unique_username(name, db),
            pocket_id=await generate_unique_pocket_id(db),
            is_email_verified=False,
        )
        db.add(user)
        await db.flush()

    # Invalidate old OTPs
    await db.execute(
        update(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.is_used.is_(False))
        .values(is_used=True)
    )

    otp = generate_otp(6)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db_otp = EmailOTP(
        email=email,
        otp_hash=hash_otp(otp),
        purpose="register",
        expires_at=expires_at,
    )
    db.add(db_otp)
    await db.commit()

    delivery = await EmailService.send_otp_email(email, otp, purpose="register")
    is_success = getattr(delivery, "success", bool(delivery))
    delivery_status = getattr(delivery, "status", "console_logged" if is_success else "failed")
    delivery_error = getattr(delivery, "error", None)

    if not is_success and settings.ENVIRONMENT != "development":
        if delivery_status == "sandbox_restricted":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=delivery_error or "Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to dispatch verification email. Please use Google Sign-In to access the public demo.",
        )

    # dev_otp is strictly restricted to local development environments when running console fallback or sandbox restricted
    dev_otp = otp if (settings.ENVIRONMENT == "development" and delivery_status in ("console_logged", "sandbox_restricted")) else None

    if delivery_status == "provider_sent":
        message = f"Verification code sent to {email}. Please check your Inbox and Spam/Junk folder."
    elif delivery_status == "sandbox_restricted":
        message = "Resend Sandbox Restriction: Emails on the free sandbox domain can only be sent to verified domain recipients. In development, use the verification code below."
    else:
        message = "Verification code generated in local console mode."

    return {
        "message": message,
        "email": email,
        "otp_required": True,
        "dev_otp": dev_otp,
        "delivery_status": delivery_status,
        "sandbox_warning": delivery_error if delivery_status == "sandbox_restricted" else None,
    }


@router.post("/verify-otp", response_model=AuthenticatedUserResponse)
async def verify_otp(
    data: VerifyOtpRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification attempts. Please try again in a minute.",
        )

    email = data.email.strip().lower()
    otp_code = data.otp.strip()

    # Fetch active OTP record
    now = datetime.now(timezone.utc)
    query = (
        select(EmailOTP)
        .where(
            EmailOTP.email == email,
            EmailOTP.expires_at > now,
        )
        .order_by(EmailOTP.created_at.desc())
        .limit(1)
    )
    bind = db.get_bind()
    if bind and getattr(bind.dialect, "name", "") == "postgresql":
        query = query.with_for_update()

    result = await db.execute(query)
    db_otp = result.scalar_one_or_none()

    if not db_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new one.",
        )

    if db_otp.is_used or db_otp.attempts >= 5:
        if not db_otp.is_used:
            db_otp.is_used = True
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please request a new verification code."
            if db_otp.attempts >= 5
            else "This verification code has already been used. Please request a new one.",
        )

    submitted_hash = hash_otp(otp_code)
    # Constant-time comparison to prevent timing side channels
    if not secrets.compare_digest(submitted_hash, db_otp.otp_hash):
        # Atomic database update of attempts with conditional is_used flag
        update_stmt = (
            update(EmailOTP)
            .where(EmailOTP.id == db_otp.id)
            .values(
                attempts=EmailOTP.attempts + 1,
                is_used=case((EmailOTP.attempts + 1 >= 5, True), else_=EmailOTP.is_used),
            )
        )
        await db.execute(update_stmt)
        await db.commit()
        await db.refresh(db_otp)

        remaining = max(0, 5 - db_otp.attempts)
        detail_msg = "Invalid verification code."
        if remaining > 0:
            detail_msg += f" {remaining} attempt(s) remaining."
        else:
            detail_msg = "Too many incorrect attempts. Please request a new verification code."
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg,
        )

    # Valid OTP! Atomically mark is_used=True conditioned on is_used still being False and attempts < 5
    mark_used_result = await db.execute(
        update(EmailOTP)
        .where(
            EmailOTP.id == db_otp.id,
            EmailOTP.is_used.is_(False),
            EmailOTP.attempts < 5,
        )
        .values(is_used=True)
    )
    if mark_used_result.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Please request a new one.",
        )

    # Find and update user
    user_res = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.is_email_verified = True
    await db.flush()

    # Generate session tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_plain = generate_refresh_token()
    refresh_token_hashed = hash_token(refresh_token_plain)

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hashed,
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.commit()
    await db.refresh(user)

    set_auth_cookies(response, access_token, refresh_token_plain)
    return {"message": "Signed in successfully", "user": user}


@router.post("/resend-otp", response_model=OtpSentResponse)
async def resend_otp(
    data: ResendOtpRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again in a minute.",
        )

    email = data.email.strip().lower()
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        # Prevent account enumeration: return uniform generic response without leaking existence
        return {
            "message": "If an account is associated with this email, a verification code has been sent",
            "email": email,
            "otp_required": True,
            "dev_otp": None,
        }

    # Cooldown check
    now = datetime.now(timezone.utc)
    otp_res = await db.execute(
        select(EmailOTP)
        .where(EmailOTP.email == email)
        .order_by(EmailOTP.created_at.desc())
        .limit(1)
    )
    latest_otp = otp_res.scalar_one_or_none()
    if latest_otp and latest_otp.created_at:
        latest_created = (
            latest_otp.created_at
            if latest_otp.created_at.tzinfo
            else latest_otp.created_at.replace(tzinfo=timezone.utc)
        )
        diff_seconds = (now - latest_created).total_seconds()
        if diff_seconds < settings.OTP_RESEND_COOLDOWN_SECONDS:
            wait_time = int(settings.OTP_RESEND_COOLDOWN_SECONDS - diff_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_time}s before requesting a new code.",
            )

    # Invalidate previous OTPs
    await db.execute(
        update(EmailOTP)
        .where(EmailOTP.email == email, EmailOTP.is_used.is_(False))
        .values(is_used=True)
    )

    otp = generate_otp(6)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db_otp = EmailOTP(
        email=email,
        otp_hash=hash_otp(otp),
        purpose="login",
        expires_at=expires_at,
    )
    db.add(db_otp)
    await db.commit()

    delivery = await EmailService.send_otp_email(email, otp, purpose="login")
    is_success = getattr(delivery, "success", bool(delivery))
    delivery_status = getattr(delivery, "status", "console_logged" if is_success else "failed")
    delivery_error = getattr(delivery, "error", None)

    if not is_success and settings.ENVIRONMENT != "development":
        if delivery_status == "sandbox_restricted":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=delivery_error or "Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to dispatch verification email. Please use Google Sign-In to access the public demo.",
        )

    # dev_otp is strictly restricted to local development environments when running console fallback or sandbox restricted
    dev_otp = otp if (settings.ENVIRONMENT == "development" and delivery_status in ("console_logged", "sandbox_restricted")) else None

    if delivery_status == "provider_sent":
        message = f"New verification code sent to {email}. Please check your Inbox and Spam/Junk folder."
    elif delivery_status == "sandbox_restricted":
        message = "Resend Sandbox Restriction: Emails on the free sandbox domain can only be sent to verified domain recipients. In development, use the verification code below."
    else:
        message = "New verification code generated in local console mode."

    return {
        "message": message,
        "email": email,
        "otp_required": True,
        "dev_otp": dev_otp,
        "delivery_status": delivery_status,
        "sandbox_warning": delivery_error if delivery_status == "sandbox_restricted" else None,
    }


@router.post("/google", response_model=AuthenticatedUserResponse)
async def google_login(
    data: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please try again in a minute.",
        )

    google_user = await asyncio.to_thread(verify_google_token, data.credential)

    google_sub = google_user["sub"]
    email = google_user["email"].strip().lower()
    name = google_user.get("name", "")
    avatar_url = google_user.get("picture")

    # Check if user already exists by google_sub or email
    result = await db.execute(
        select(User).where((User.google_sub == google_sub) | (User.email == email))
    )
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        user = User(
            google_sub=google_sub,
            email=email,
            name=name,
            username=await generate_unique_username(name, db),
            pocket_id=await generate_unique_pocket_id(db),
            avatar_url=avatar_url,
            is_email_verified=True,
        )
        db.add(user)
        await db.flush()
    else:
        # Prevent unauthorized account linking:
        # If the account is already bound to a different Google identity, reject linking.
        if user.google_sub and user.google_sub != google_sub:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email is already linked to a different Google account.",
            )

        # Link google_sub and verify email if not already set
        if not user.google_sub:
            user.google_sub = google_sub
        if not user.is_email_verified:
            user.is_email_verified = True
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        await db.flush()

    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_plain = generate_refresh_token()
    refresh_token_hashed = hash_token(refresh_token_plain)

    # Store refresh token in DB
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_token_hashed,
        expires_at=expires_at,
    )
    db.add(db_token)
    await db.commit()
    await db.refresh(user)

    # Set secure cookies
    set_auth_cookies(response, access_token, refresh_token_plain)

    return {"message": "Signed in successfully", "user": user}

@router.post("/refresh", response_model=SessionResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    client_ip = request.client.host if request.client else "unknown"
    if auth_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refresh attempts. Please try again in a minute.",
        )

    token = request.cookies.get("refresh_token")
    if not token:
        # Fallback to check json body if frontend sends it manually
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing")

    token_hash = hash_token(token)
    
    # Find active token in DB
    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .where(RefreshToken.revoked_at.is_(None))
        .where(RefreshToken.expires_at > datetime.now(timezone.utc))
    )
    db_refresh_token = result.scalar_one_or_none()
    
    if not db_refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
        
    user_id = db_refresh_token.user_id
    
    # Revoke old token
    db_refresh_token.revoked_at = datetime.now(timezone.utc)
    
    # Issue new tokens
    new_access_token = create_access_token(data={"sub": str(user_id)})
    new_refresh_token_plain = generate_refresh_token()
    new_refresh_token_hashed = hash_token(new_refresh_token_plain)
    
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_db_token = RefreshToken(
        user_id=user_id,
        token_hash=new_refresh_token_hashed,
        expires_at=new_expires_at,
    )
    db.add(new_db_token)
    await db.commit()
    
    set_auth_cookies(response, new_access_token, new_refresh_token_plain)
    
    return {"message": "Session refreshed"}

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("refresh_token")
    if token:
        token_hash = hash_token(token)
        result = await db.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .where(RefreshToken.revoked_at.is_(None))
        )
        db_refresh_token = result.scalar_one_or_none()
        
        if db_refresh_token:
            db_refresh_token.revoked_at = datetime.now(timezone.utc)
            await db.commit()
            
    # Clear cookies
    response.delete_cookie(
        "access_token",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.delete_cookie(
        "refresh_token",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response

@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return {"message": "Authenticated", "user": current_user}


@router.get("/ok")
async def auth_ok():
    """Better Auth standard health probe endpoint."""
    return {"status": "ok"}


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke all active sessions and refresh tokens for the current user across all devices (Better Auth revokeSessions standard).
    """
    now = datetime.now(timezone.utc)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == current_user.id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    await db.commit()

    # Clear cookies
    response.delete_cookie(
        "access_token",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.delete_cookie(
        "refresh_token",
        secure=settings.COOKIE_SECURE,
        httponly=True,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
