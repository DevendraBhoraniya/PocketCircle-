import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from schemas.groups import (
    AddGroupMemberRequest,
    CreateGroupRequest,
    GroupDetail,
    GroupOverviewResponse,
    GroupSummary,
    TransferOwnershipRequest,
    UpdateGroupRequest,
    UpdateMemberRoleRequest,
)
from services.group_service import GroupService

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get("", response_model=list[GroupSummary])
async def list_my_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.list_user_groups(db, current_user.id)


@router.get("/public", response_model=list[GroupSummary])
async def list_public_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.list_public_groups(db)


@router.get("/{group_id}/overview", response_model=GroupOverviewResponse)
async def get_group_overview(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.get_group_overview(db, group_id, current_user)


@router.post("", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: CreateGroupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.create_group(db, current_user, data)


@router.get("/{group_id}", response_model=GroupDetail)
async def get_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.get_group_detail(db, group_id, current_user.id)


@router.patch("/{group_id}", response_model=GroupDetail)
async def update_group(
    group_id: uuid.UUID,
    data: UpdateGroupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.update_group(db, group_id, current_user, data)


@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
async def delete_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await GroupService.delete_group(db, group_id, current_user)
    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/members", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
async def add_group_member(
    group_id: uuid.UUID,
    data: AddGroupMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.add_member(db, group_id, current_user, data.user_id)


@router.patch("/{group_id}/members/{user_id}/role", response_model=GroupDetail)
async def update_member_role(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    data: UpdateMemberRoleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.update_member_role(db, group_id, current_user, user_id, data.role)


@router.post("/{group_id}/transfer-ownership", response_model=GroupDetail)
async def transfer_ownership(
    group_id: uuid.UUID,
    data: TransferOwnershipRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.transfer_ownership(db, group_id, current_user, data.new_owner_id)


@router.delete("/{group_id}/members/{user_id}", response_model=GroupDetail)
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await GroupService.remove_member(db, group_id, current_user, user_id)


@router.post("/{group_id}/leave", status_code=status.HTTP_200_OK)
async def leave_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await GroupService.leave_group(db, group_id, current_user)
    return {"message": "You have left the group"}
