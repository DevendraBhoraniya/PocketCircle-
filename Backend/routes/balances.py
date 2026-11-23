import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from schemas.balances import (
    GroupBalancesResponse,
    SettlementPlanResponse,
    UserCrossGroupSummary,
)
from services.balance_service import BalanceService

router = APIRouter(tags=["Balances"])


@router.get("/groups/{group_id}/balances", response_model=GroupBalancesResponse)
async def get_group_balances(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await BalanceService.get_group_balances(db, group_id, current_user)


@router.get("/groups/{group_id}/settlement-plan", response_model=SettlementPlanResponse)
async def get_group_settlement_plan(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await BalanceService.get_settlement_plan(db, group_id, current_user)


@router.get("/balances/summary", response_model=UserCrossGroupSummary)
async def get_user_cross_group_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await BalanceService.get_user_cross_group_summary(db, current_user.id)
