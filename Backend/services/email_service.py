from abc import ABC, abstractmethod
import asyncio
from dataclasses import dataclass
from email.message import EmailMessage
import logging
import smtplib
from typing import Literal

import httpx
import resend
from resend.exceptions import ResendError

from core.config import settings

logger = logging.getLogger("pocketcircle.email")


@dataclass
class EmailDeliveryResult:
    success: bool
    status: Literal["provider_sent", "console_logged", "sandbox_restricted", "failed"]
    provider: str
    message_id: str | None = None
    error: str | None = None

    def __bool__(self) -> bool:
        return self.success


def build_otp_templates(otp: str, purpose: str) -> tuple[str, str, str]:
    action_text = "sign in to" if purpose == "login" else "activate"
    subject = f"{otp} is your PocketCircle verification code"

    plain_content = (
        f"Your PocketCircle verification code is: {otp}\n\n"
        f"This code will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
        f"If you did not request this code, you can safely ignore this email."
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f2f1ec; margin: 0; padding: 24px; color: #1b1d20; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 36px; border: 1px solid #e1dfd8; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }}
    .brand {{ font-size: 20px; font-weight: 700; color: #1b1d20; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }}
    .brand span {{ color: #5196fe; }}
    .otp-box {{ background-color: #f2f1ec; border: 1px dashed #5196fe; border-radius: 16px; padding: 20px; text-align: center; margin: 28px 0; }}
    .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1b1d20; font-family: monospace; }}
    .footer {{ font-size: 13px; color: #6e6e6e; margin-top: 28px; border-top: 1px solid #e1dfd8; padding-top: 20px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Pocket<span>Circle</span></div>
    <h2 style="font-size: 22px; font-weight: 700; margin-top: 0; color: #1b1d20;">Confirm your email address</h2>
    <p style="font-size: 15px; color: #6e6e6e; line-height: 1.6;">
      Please use the verification code below to {action_text} your PocketCircle account.
    </p>
    <div class="otp-box">
      <div class="otp-code">{otp}</div>
    </div>
    <p style="font-size: 14px; color: #6e6e6e;">
      This code is valid for <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>. For your security, never share this code with anyone.
    </p>
    <div class="footer">
      If you didn't attempt to sign in to PocketCircle, please disregard this email.
    </div>
  </div>
</body>
</html>"""

    return subject, plain_content, html_content


class BaseEmailAdapter(ABC):
    @abstractmethod
    async def send_otp(self, to_email: str, otp: str, purpose: str = "login") -> EmailDeliveryResult:
        pass


class ConsoleEmailAdapter(BaseEmailAdapter):
    """
    Development-only adapter. Outputs verification codes to terminal in local development.
    Disabled by design in staging and production to prevent credential leakage.
    """

    async def send_otp(self, to_email: str, otp: str, purpose: str = "login") -> EmailDeliveryResult:
        if settings.ENVIRONMENT != "development":
            err_msg = "ConsoleEmailAdapter is strictly prohibited outside development environment."
            logger.error(err_msg)
            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="console",
                error=err_msg,
            )

        subject, _, _ = build_otp_templates(otp, purpose)
        try:
            print("\n" + "=" * 60)
            print("[POCKETCIRCLE DEV EMAIL CONSOLE]")
            print(f"TO:      {to_email}")
            print(f"SUBJECT: {subject}")
            print(f"OTP:     >>> {otp} <<< (valid for {settings.OTP_EXPIRE_MINUTES} mins)")
            print("STATUS:  Local development console adapter")
            print("=" * 60 + "\n")
        except Exception as exc:
            logger.warning(f"Failed to print OTP to console: {exc}")

        return EmailDeliveryResult(
            success=True,
            status="console_logged",
            provider="console",
        )


class ResendEmailAdapter(BaseEmailAdapter):
    """
    Sends email using the official Resend Python SDK (https://resend.com/docs/api-reference/emails/send-email).
    Supports verified custom domains, explicit testing mode guardrails, and graceful testing diagnostics.
    """

    async def send_otp(self, to_email: str, otp: str, purpose: str = "login") -> EmailDeliveryResult:
        normalized_email = to_email.strip().lower()

        if not settings.RESEND_API_KEY or not settings.RESEND_API_KEY.strip():
            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="resend",
                error="RESEND_API_KEY is not configured",
            )

        # Resend Testing Mode Guardrail:
        # In testing mode (using onboarding@resend.dev), Resend strictly restricts delivery to the account owner.
        if settings.RESEND_TESTING_MODE and settings.RESEND_PERMITTED_RECIPIENT:
            permitted = settings.RESEND_PERMITTED_RECIPIENT.strip().lower()
            if normalized_email != permitted:
                logger.info(
                    "Resend testing mode active: delivery rejected for non-permitted recipient"
                )
                if settings.ENVIRONMENT == "development":
                    console_adapter = ConsoleEmailAdapter()
                    await console_adapter.send_otp(normalized_email, otp, purpose)
                    return EmailDeliveryResult(
                        success=True,
                        status="sandbox_restricted",
                        provider="resend",
                        error="Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
                    )
                return EmailDeliveryResult(
                    success=False,
                    status="sandbox_restricted",
                    provider="resend",
                    error="Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
                )

        subject, plain_content, html_content = build_otp_templates(otp, purpose)
        api_key = settings.RESEND_API_KEY.strip()
        from_email = (
            settings.RESEND_FROM_EMAIL.strip()
            if settings.RESEND_FROM_EMAIL
            else "PocketCircle <onboarding@resend.dev>"
        )

        resend.api_key = api_key

        params: resend.Emails.SendParams = {
            "from": from_email,
            "to": [normalized_email],
            "subject": subject,
            "html": html_content,
            "text": plain_content,
        }

        try:
            # Send using official Resend Python SDK in thread pool
            response = await asyncio.to_thread(resend.Emails.send, params)
            message_id = response.get("id") if isinstance(response, dict) else getattr(response, "id", None)
            logger.info("Email delivered via Resend SDK successfully (id: %s)", message_id)
            return EmailDeliveryResult(
                success=True,
                status="provider_sent",
                provider="resend",
                message_id=message_id,
            )

        except ResendError as exc:
            err_msg = str(exc)
            logger.warning("Resend error sending OTP: %s", err_msg)

            # Check if this is the free testing domain restriction
            is_sandbox_restriction = (
                "only send testing emails to your own email address" in err_msg.lower()
                or "validation_error" in err_msg.lower()
            )

            if is_sandbox_restriction:
                if settings.ENVIRONMENT == "development":
                    console_adapter = ConsoleEmailAdapter()
                    await console_adapter.send_otp(normalized_email, otp, purpose)
                    return EmailDeliveryResult(
                        success=True,
                        status="sandbox_restricted",
                        provider="resend",
                        error="Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
                    )

                return EmailDeliveryResult(
                    success=False,
                    status="sandbox_restricted",
                    provider="resend",
                    error="Email verification is currently available only for the configured demo account. Please use Google Sign-In to access the public demo.",
                )

            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="resend",
                error="Email delivery provider encountered an error.",
            )

        except Exception as exc:
            logger.error("Failed to deliver via Resend SDK: %s", type(exc).__name__)
            if settings.ENVIRONMENT == "development":
                console_adapter = ConsoleEmailAdapter()
                await console_adapter.send_otp(normalized_email, otp, purpose)
                return EmailDeliveryResult(
                    success=True,
                    status="console_logged",
                    provider="resend",
                    error="Resend delivery failed; console logged in development.",
                )
            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="resend",
                error="Network error communicating with email provider.",
            )


class SMTPEmailAdapter(BaseEmailAdapter):
    """
    Sends email using SMTP relay (e.g., SendGrid, Mailgun, Amazon SES, or Gmail App Password).
    """

    def _send_smtp_sync(self, msg: EmailMessage) -> None:
        if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
            raise RuntimeError("SMTP_HOST is not configured")

        timeout = 15
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST.strip(), settings.SMTP_PORT, timeout=timeout)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST.strip(), settings.SMTP_PORT, timeout=timeout)
            if settings.SMTP_TLS:
                server.starttls()

        try:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD.strip())
            server.send_message(msg)
        finally:
            server.quit()

    async def send_otp(self, to_email: str, otp: str, purpose: str = "login") -> EmailDeliveryResult:
        if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="smtp",
                error="SMTP_HOST is not configured",
            )

        subject, plain_content, html_content = build_otp_templates(otp, purpose)
        sender = settings.SMTP_USER or settings.SMTP_FROM_EMAIL
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"PocketCircle <{sender}>"
        msg["To"] = to_email
        msg.set_content(plain_content)
        msg.add_alternative(html_content, subtype="html")

        try:
            await asyncio.to_thread(self._send_smtp_sync, msg)
            logger.info("Email delivered via SMTP to %s", to_email)
            return EmailDeliveryResult(
                success=True,
                status="provider_sent",
                provider="smtp",
            )
        except Exception as exc:
            logger.error("Failed sending via SMTP: %s", exc)
            if settings.ENVIRONMENT == "development":
                console_adapter = ConsoleEmailAdapter()
                await console_adapter.send_otp(to_email, otp, purpose)
                return EmailDeliveryResult(
                    success=True,
                    status="console_logged",
                    provider="smtp_fallback_console",
                    error=str(exc),
                )
            return EmailDeliveryResult(
                success=False,
                status="failed",
                provider="smtp",
                error=f"SMTP relay failed: {str(exc)}",
            )


class EmailService:
    @classmethod
    def get_adapter(cls) -> BaseEmailAdapter:
        provider = settings.EMAIL_PROVIDER.lower().strip()
        if provider == "console":
            return ConsoleEmailAdapter()
        if provider == "resend":
            return ResendEmailAdapter()
        if provider == "smtp":
            return SMTPEmailAdapter()

        # "auto" provider selection
        if settings.RESEND_API_KEY and settings.RESEND_API_KEY.strip():
            return ResendEmailAdapter()
        if settings.SMTP_HOST and settings.SMTP_HOST.strip():
            return SMTPEmailAdapter()
        return ConsoleEmailAdapter()

    @classmethod
    async def send_otp_email(cls, to_email: str, otp: str, purpose: str = "login") -> EmailDeliveryResult:
        adapter = cls.get_adapter()
        return await adapter.send_otp(to_email=to_email, otp=otp, purpose=purpose)
