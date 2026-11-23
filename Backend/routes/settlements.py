import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from schemas.settlements import (
    CreateSettlementRequest,
    SettlementListResponse,
    SettlementResponse,
)
from services.settlement_service import SettlementService

router = APIRouter(tags=["Settlements"])


@router.get(
    "/groups/{group_id}/settlements",
    response_model=SettlementListResponse,
    summary="List all settlements in a group",
)
async def list_group_settlements(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settlements = await SettlementService.list_settlements(db, group_id, current_user)
    return SettlementListResponse(group_id=group_id, settlements=settlements)


@router.post(
    "/groups/{group_id}/settlements",
    response_model=SettlementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request a new settlement (record off-platform payment)",
)
async def create_settlement_request(
    group_id: uuid.UUID,
    data: CreateSettlementRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettlementService.create_settlement_request(
        db, group_id, current_user, data
    )


@router.post(
    "/groups/{group_id}/settlements/{settlement_id}/confirm",
    response_model=SettlementResponse,
    summary="Confirm receipt of a settlement (payee only)",
)
async def confirm_settlement(
    group_id: uuid.UUID,
    settlement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettlementService.confirm_settlement(
        db, group_id, settlement_id, current_user
    )


@router.post(
    "/groups/{group_id}/settlements/{settlement_id}/reject",
    response_model=SettlementResponse,
    summary="Reject a settlement request (payee only)",
)
async def reject_settlement(
    group_id: uuid.UUID,
    settlement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettlementService.reject_settlement(
        db, group_id, settlement_id, current_user
    )


@router.post(
    "/groups/{group_id}/settlements/{settlement_id}/cancel",
    response_model=SettlementResponse,
    summary="Cancel a pending settlement request (payer or group admin)",
)
async def cancel_settlement(
    group_id: uuid.UUID,
    settlement_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettlementService.cancel_settlement(
        db, group_id, settlement_id, current_user
    )
