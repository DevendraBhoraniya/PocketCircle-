from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from schemas.auth import PublicUser


GroupVisibility = Literal["private", "unlisted", "public"]


class GroupMemberItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user: PublicUser
    role: Literal["owner", "admin", "member"]
    joined_at: datetime


class GroupSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    owner_id: UUID
    visibility: GroupVisibility = "private"
    my_role: Literal["owner", "admin", "member"]
    member_count: int
    created_at: datetime


class GroupDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    owner_id: UUID
    visibility: GroupVisibility = "private"
    my_role: Literal["owner", "admin", "member"] | None = None
    members: list[GroupMemberItem]
    created_at: datetime


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    visibility: GroupVisibility = Field(default="private")
    initial_member_ids: list[UUID] = Field(default_factory=list)


class UpdateGroupRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    visibility: GroupVisibility | None = None


class AddGroupMemberRequest(BaseModel):
    user_id: UUID


class UpdateMemberRoleRequest(BaseModel):
    role: Literal["admin", "member"]


class TransferOwnershipRequest(BaseModel):
    new_owner_id: UUID


class GroupActionResponse(BaseModel):
    message: str
    group: GroupDetail | None = None


from schemas.expenses import ExpenseResponse
from schemas.audit import AuditEventResponse
from schemas.balances import GroupBalancesResponse, SettlementPlanResponse
from schemas.settlements import SettlementResponse


class GroupOverviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group: GroupDetail
    expenses: list[ExpenseResponse]
    activity: list[AuditEventResponse]
    balances: GroupBalancesResponse
    settlement_plan: SettlementPlanResponse
    settlements: list[SettlementResponse]

