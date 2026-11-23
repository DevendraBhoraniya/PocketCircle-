from datetime import datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, Field

from schemas.auth import PublicUser


class CreateSettlementRequest(BaseModel):
    payee_id: uuid.UUID = Field(..., description="User ID of the payee (recipient of funds)")
    amount: Decimal = Field(..., gt=Decimal("0.00"), description="Positive settlement amount")
    notes: str | None = Field(None, max_length=255, description="Optional payment reference or note")


class SettlementResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    payer: PublicUser
    payee: PublicUser
    amount: Decimal
    status: str
    notes: str | None = None
    action_by: PublicUser | None = None
    action_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettlementListResponse(BaseModel):
    group_id: uuid.UUID
    settlements: list[SettlementResponse]
