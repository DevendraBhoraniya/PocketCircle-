import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User


def generate_username(name: str) -> str:
    # Take the first name from Google's name
    name_parts = name.strip().split()
    first_name = name_parts[0].lower() if name_parts else "user"
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
            select(User).where(User.username == username)
        )

        existing_user = result.scalar_one_or_none()

        if existing_user is None:
            return username

    raise RuntimeError(
        "Could not generate a unique username after several attempts"
    )