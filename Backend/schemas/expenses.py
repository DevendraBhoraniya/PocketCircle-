from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from schemas.auth import PublicUser


class ExpensePayerInput(BaseModel):
    user_id: UUID
    amount: Decimal = Field(gt=0, decimal_places=2)


class ExpenseParticipantInput(BaseModel):
    user_id: UUID
    amount: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class CreateExpenseRequest(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, decimal_places=2)
    split_type: Literal["equal", "exact"] = "equal"
    payers: list[ExpensePayerInput] | None = None
    # For equal split, participants can be specified with or without amount; if omitted, all active members are included
    participants: list[ExpenseParticipantInput] | None = None


class UpdateExpenseRequest(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, gt=0, decimal_places=2)
    split_type: Literal["equal", "exact"] | None = None
    payers: list[ExpensePayerInput] | None = None
    participants: list[ExpenseParticipantInput] | None = None


class ExpensePayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: PublicUser
    amount: Decimal


class ExpenseParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: PublicUser
    amount: Decimal


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    description: str
    amount: Decimal
    split_type: Literal["equal", "exact"]
    creator: PublicUser
    payers: list[ExpensePayerResponse]
    participants: list[ExpenseParticipantResponse]
    created_at: datetime
    updated_at: datetime


class ExpenseListResponse(BaseModel):
    expenses: list[ExpenseResponse]


class ExpenseActionResponse(BaseModel):
    message: str
    expense: ExpenseResponse | None = None
