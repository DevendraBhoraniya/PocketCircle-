import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User


def generate_username(name: str) -> str:
    # Take first name truncated to 14 chars so name(<=14) + '_'(1) + 4-digit(4) <= 19 chars (fits VARCHAR(20))
    name_parts = name.strip().split()
    first_name = name_parts[0].lower()[:14] if name_parts else "user"
    number = secrets.randbelow(9000) + 1000
    return f"{first_name}_{number}"


async def generate_unique_username(
    name: str,
    db: AsyncSession,
    max_attempts: int = 10,
) -> str:
    for _ in range(max_attempts):
        username = generate_username(name)

        result = await db.execute(
            select(User.id).where(User.username == username)
        )

        if result.scalar_one_or_none() is None:
            return username

    # Fallback to high-entropy UUID suffix if 4-digit random numbers collide
    for _ in range(5):
        fallback = f"u_{uuid.uuid4().hex[:12]}"  # 14 chars <= 20
        result = await db.execute(
            select(User.id).where(User.username == fallback)
        )
        if result.scalar_one_or_none() is None:
            return fallback

    raise RuntimeError(
        "Could not generate a unique username after several attempts"
    )
