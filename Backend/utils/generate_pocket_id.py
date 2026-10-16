import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User


async def generate_unique_pocket_id(
    db: AsyncSession,
    max_attempts: int = 10,
) -> str:

    for _ in range(max_attempts):
        pocket_id = "".join(secrets.choice("0123456789") for _ in range(10))

        result = await db.execute(
            select(User).where(User.pocket_id == pocket_id)
        )

        existing_user = result.scalar_one_or_none()

        if existing_user is None:
            return pocket_id

    raise RuntimeError(
        "Could not generate a unique pocket_id after several attempts"
    )
