from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"

    # Email Service Settings (Adapter configuration)
    EMAIL_PROVIDER: Literal["auto", "resend", "smtp", "console"] = "auto"
    RESEND_API_KEY: str | None = None
    RESEND_FROM_EMAIL: str = "PocketCircle <onboarding@resend.dev>"
    RESEND_TESTING_MODE: bool = True
    RESEND_PERMITTED_RECIPIENT: str | None = None

    # SMTP / Legacy Email Settings
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "noreply@pocketcircle.app"
    SMTP_TLS: bool = True

    # OTP Configuration
    OTP_EXPIRE_MINUTES: int = 10
    OTP_RESEND_COOLDOWN_SECONDS: int = 60

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        env = (self.ENVIRONMENT or "").strip().lower()
        if env == "production":
            if not self.COOKIE_SECURE:
                raise ValueError("COOKIE_SECURE must be True in production environment.")

            disallowed_weak_secrets = {
                "pocketcircle9876543210",
                "secret",
                "changeme",
                "change-me",
                "password",
                "123456",
                "12345678",
                "admin",
                "jwt_secret",
                "supersecret",
            }
            if self.EMAIL_PROVIDER == "console":
                raise ValueError("EMAIL_PROVIDER cannot be 'console' in production. Configure a real provider ('resend' or 'smtp').")

            trimmed_secret = (self.JWT_SECRET or "").strip()
            if trimmed_secret.lower() in disallowed_weak_secrets or len(trimmed_secret) < 32:
                raise ValueError(
                    "JWT_SECRET is too weak or using a known default. Production requires a secret with at least 32 characters."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"),
        extra="ignore",
    )


settings = Settings()

