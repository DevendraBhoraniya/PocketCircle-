from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from schemas.auth import PublicUser


class CreateFriendRequest(BaseModel):
    friend_id: UUID


class FriendRequestItem(BaseModel):
    id: UUID
    user: PublicUser
    status: Literal["pending", "accepted", "rejected"]
    created_at: datetime


class FriendRequestsResponse(BaseModel):
    incoming: list[FriendRequestItem]
    outgoing: list[FriendRequestItem]


class FriendsResponse(BaseModel):
    friends: list[PublicUser]


class FriendRequestActionResponse(BaseModel):
    message: str
    request: FriendRequestItem | None = None
