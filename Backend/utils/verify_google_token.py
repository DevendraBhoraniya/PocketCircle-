from google.oauth2 import id_token
from google.auth.transport import requests
from core.config import settings
from fastapi import HTTPException


def verify_google_token(credential: str):
    try:
        google_user = id_token.verify_oauth2_token(
            credential,
            requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        return google_user

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google credential",
        )