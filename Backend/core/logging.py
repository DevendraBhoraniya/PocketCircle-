import logging
import sys
import re

SENSITIVE_PATTERNS = [
    re.compile(r'(access_token|refresh_token|credential|password|secret|jwt)=[^;&]+', re.IGNORECASE),
    re.compile(r'("?(?:credential|password|secret|token|access_token|refresh_token)"?\s*:\s*)"[^"]+"', re.IGNORECASE),
]

def redact_sensitive(message: str) -> str:
    redacted = message
    for pattern in SENSITIVE_PATTERNS:
        redacted = pattern.sub(r'\1=[REDACTED]', redacted)
    return redacted


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        return redact_sensitive(original)


def setup_logging(level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("pocketcircle")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            RedactingFormatter(
                fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        logger.addHandler(handler)

    return logger


logger = setup_logging()
