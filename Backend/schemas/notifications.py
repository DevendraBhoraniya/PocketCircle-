import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict
from schemas.auth import PublicUser


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_id: uuid.UUID
    actor_id: Optional[uuid.UUID] = None
    group_id: Optional[uuid.UUID] = None
    group_name: Optional[str] = None
    event_type: str
    payload: str
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    actor: Optional[PublicUser] = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total_count: int
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadResponse(BaseModel):
    message: str
    updated_count: int
