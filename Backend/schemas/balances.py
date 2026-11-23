from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from schemas.audit import AuditEventResponse
from schemas.auth import PublicUser


class UserBalanceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: PublicUser
    net_balance: Decimal
    total_paid: Decimal
    total_owed: Decimal
    status: Literal["owed", "owes", "settled"]


class GroupBalancesResponse(BaseModel):
    group_id: UUID
    total_group_spending: Decimal
    my_net_balance: Decimal
    balances: list[UserBalanceItem]


class SettlementTransferResponse(BaseModel):
    from_user: PublicUser
    to_user: PublicUser
    amount: Decimal


class SettlementPlanResponse(BaseModel):
    group_id: UUID
    transfers: list[SettlementTransferResponse]
    total_settlement_amount: Decimal


class GroupBalanceSummaryItem(BaseModel):
    group_id: UUID
    group_name: str
    my_net_balance: Decimal
    my_role: str
    member_count: int
    status: Literal["owed", "owes", "settled"]


class UserCrossGroupSummary(BaseModel):
    overall_net_balance: Decimal
    total_owed_to_me: Decimal
    total_i_owe: Decimal
    groups: list[GroupBalanceSummaryItem]
    recent_activity: list[AuditEventResponse]
