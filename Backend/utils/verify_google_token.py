from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests
from google.oauth2 import id_token
from fastapi import HTTPException, status
from core.config import settings


def verify_google_token(credential: str) -> dict:
    """
    Verifies a Google ID token using Google's official oauth2 library.
    Strictly validates:
      1. Cryptographic signature against Google's public JWK keys
      2. Audience against configured settings.GOOGLE_CLIENT_ID
      3. Token issuer (accounts.google.com or https://accounts.google.com)
      4. Expiration timestamp
      5. Required identity claims ('sub', 'email')
      6. Email verification status
    """
    if not credential or not isinstance(credential, str) or not credential.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token credential must not be empty.",
        )

    try:
        google_user = id_token.verify_oauth2_token(
            credential.strip(),
            requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        # 1. Validate issuer
        issuer = google_user.get("iss", "")
        if issuer not in ("accounts.google.com", "https://accounts.google.com"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential: unverified token issuer.",
            )

        # 2. Validate required identity claims
        if not google_user.get("sub") or not google_user.get("email"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google credential missing required identity claims.",
            )

        # 3. Validate that Google has verified this email address
        if not google_user.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google account email is not verified.",
            )

        return google_user

    except (ValueError, GoogleAuthError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential: signature verification failed or token expired.",
        )
