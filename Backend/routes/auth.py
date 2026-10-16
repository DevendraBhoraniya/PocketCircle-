from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Response, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.middleware import auth_rate_limiter
from core.database import get_db
from core.config import settings
from core.security import (
    create_access_token, 
    generate_refresh_token, 
    hash_token,
    get_current_user
)
from schemas.auth import (
    AuthenticatedUserResponse,
    GoogleLoginRequest,
    SessionResponse,
)
from models.user import User
from models.refresh_token import RefreshToken
from utils.generate_pocket_id import generate_unique_pocket_id
from utils.verify_google_token import verify_google_token
from utils.generate_user_name import generate_unique_username

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

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

    google_user = verify_google_token(data.credential)

    google_sub = google_user["sub"]
    email = google_user["email"]
    name = google_user.get("name", "")
    avatar_url = google_user.get("picture")

    # Check if user already exists
    result = await db.execute(select(User).where(User.google_sub == google_sub))
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
        )
        db.add(user)
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
