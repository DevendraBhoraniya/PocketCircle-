from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from schemas.auth import PublicUser


class AuditEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID | None
    actor: PublicUser
    action: str
    entity_type: str
    entity_id: UUID
    details: str | None
    created_at: datetime


class ActivityTimelineResponse(BaseModel):
    events: list[AuditEventResponse]
