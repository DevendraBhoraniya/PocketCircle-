from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from schemas.auth import PublicUser, UserSearchResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/search", response_model=UserSearchResponse)
async def search_users(
    q: str = Query(min_length=1, max_length=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = q.strip()
    if not query:
        return {"users": []}

    result = await db.execute(
        select(User)
        .where(User.deleted_at.is_(None))
        .where(User.id != current_user.id)
        .where(
            or_(
                User.username.ilike(f"%{query}%"),
                User.pocket_id == query,
            )
        )
        .order_by(User.username.asc())
        .limit(20)
    )
    return {"users": list(result.scalars())}
