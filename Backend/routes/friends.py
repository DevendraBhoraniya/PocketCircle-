from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.friendship import Friendship
from models.user import User
from schemas.auth import PublicUser
from schemas.friends import (
    CreateFriendRequest,
    FriendRequestActionResponse,
    FriendRequestItem,
    FriendRequestsResponse,
    FriendsResponse,
)

router = APIRouter(prefix="/friends", tags=["Friends"])


def user_payload(user: User) -> PublicUser:
    return PublicUser.model_validate(user)


def request_payload(friendship: Friendship, user: User) -> FriendRequestItem:
    return FriendRequestItem(
        id=friendship.id,
        user=user_payload(user),
        status=friendship.status,
        created_at=friendship.created_at,
    )


async def get_friendship_or_404(
    friendship_id: UUID,
    db: AsyncSession,
) -> Friendship:
    result = await db.execute(select(Friendship).where(Friendship.id == friendship_id))
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend request not found")
    return friendship


@router.post("/requests", response_model=FriendRequestActionResponse, status_code=status.HTTP_201_CREATED)
async def create_friend_request(
    data: CreateFriendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.friend_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="You cannot add yourself as a friend")

    target_result = await db.execute(
        select(User).where(User.id == data.friend_id).where(User.deleted_at.is_(None))
    )
    target = target_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == target.id),
                and_(Friendship.user_id == target.id, Friendship.friend_id == current_user.id),
            )
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        if existing.status == "accepted":
            detail = "You are already friends"
        elif existing.status == "pending":
            detail = "A friend request is already pending"
        else:
            detail = "This friend request has already been handled"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    friendship = Friendship(user_id=current_user.id, friend_id=target.id, status="pending")
    db.add(friendship)

    from services.notification_service import NotificationService
    await NotificationService.create_notification(
        db=db,
        recipient_id=target.id,
        actor_id=current_user.id,
        event_type="FRIEND_REQUEST_RECEIVED",
        payload=f"{current_user.name} sent you a friend request",
    )

    try:
        await db.commit()
        await db.refresh(friendship)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A friend request is already pending",
        )
    return {
        "message": "Friend request sent",
        "request": request_payload(friendship, target),
    }



@router.get("/requests", response_model=FriendRequestsResponse)
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "pending",
            or_(Friendship.user_id == current_user.id, Friendship.friend_id == current_user.id),
        )
    )
    requests = list(result.scalars())
    other_user_ids = [
        friendship.friend_id if friendship.user_id == current_user.id else friendship.user_id
        for friendship in requests
    ]
    users_result = await db.execute(select(User).where(User.id.in_(other_user_ids))) if other_user_ids else None
    users = {user.id: user for user in users_result.scalars()} if users_result else {}

    incoming: list[FriendRequestItem] = []
    outgoing: list[FriendRequestItem] = []
    for friendship in requests:
        other_user_id = friendship.friend_id if friendship.user_id == current_user.id else friendship.user_id
        other_user = users.get(other_user_id)
        if other_user is None:
            continue
        payload = request_payload(friendship, other_user)
        if friendship.friend_id == current_user.id:
            incoming.append(payload)
        else:
            outgoing.append(payload)

    return {"incoming": incoming, "outgoing": outgoing}


@router.post("/requests/{friendship_id}/accept", response_model=FriendRequestActionResponse)
async def accept_friend_request(
    friendship_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendship = await get_friendship_or_404(friendship_id, db)
    if friendship.friend_id != current_user.id or friendship.status != "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot accept this friend request")

    friendship.status = "accepted"

    requester_result = await db.execute(select(User).where(User.id == friendship.user_id))
    requester = requester_result.scalar_one()

    from services.notification_service import NotificationService
    await NotificationService.create_notification(
        db=db,
        recipient_id=requester.id,
        actor_id=current_user.id,
        event_type="FRIEND_REQUEST_ACCEPTED",
        payload=f"{current_user.name} accepted your friend request",
    )

    await db.commit()
    await db.refresh(friendship)
    return {"message": "Friend request accepted", "request": request_payload(friendship, requester)}



@router.post("/requests/{friendship_id}/reject", response_model=FriendRequestActionResponse)
async def reject_friend_request(
    friendship_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendship = await get_friendship_or_404(friendship_id, db)
    if friendship.friend_id != current_user.id or friendship.status != "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot reject this friend request")

    friendship.status = "rejected"
    await db.commit()
    return {"message": "Friend request rejected", "request": None}


@router.delete("/requests/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_friend_request(
    friendship_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friendship = await get_friendship_or_404(friendship_id, db)
    if friendship.user_id != current_user.id or friendship.status != "pending":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot cancel this friend request")

    await db.delete(friendship)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", response_model=FriendsResponse)
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(Friendship.user_id == current_user.id, Friendship.friend_id == current_user.id),
        )
    )
    friendships = list(result.scalars())
    friend_ids = [
        friendship.friend_id if friendship.user_id == current_user.id else friendship.user_id
        for friendship in friendships
    ]
    if not friend_ids:
        return {"friends": []}

    users_result = await db.execute(
        select(User)
        .where(User.id.in_(friend_ids))
        .where(User.deleted_at.is_(None))
        .order_by(User.name.asc())
    )
    return {"friends": list(users_result.scalars())}


@router.delete("/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    friend_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == current_user.id),
            ),
        )
    )
    friendship = result.scalar_one_or_none()
    if friendship is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friendship not found")

    await db.delete(friendship)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
