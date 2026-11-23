import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from models.user import User
from schemas.audit import AuditEventResponse
from schemas.expenses import (
    CreateExpenseRequest,
    ExpenseResponse,
    UpdateExpenseRequest,
)
from services.expense_service import ExpenseService

router = APIRouter(prefix="/groups/{group_id}", tags=["Expenses"])


@router.get("/expenses", response_model=list[ExpenseResponse])
async def list_expenses(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ExpenseService.list_expenses(db, group_id, current_user)


@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    group_id: uuid.UUID,
    data: CreateExpenseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ExpenseService.create_expense(db, group_id, current_user, data)


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    group_id: uuid.UUID,
    expense_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ExpenseService.get_expense_detail(db, group_id, expense_id, current_user)


@router.patch("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    group_id: uuid.UUID,
    expense_id: uuid.UUID,
    data: UpdateExpenseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ExpenseService.update_expense(db, group_id, expense_id, current_user, data)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_200_OK)
async def delete_expense(
    group_id: uuid.UUID,
    expense_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await ExpenseService.delete_expense(db, group_id, expense_id, current_user)
    return {"message": "Expense deleted successfully"}


@router.get("/activity", response_model=list[AuditEventResponse])
async def get_activity(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ExpenseService.get_activity(db, group_id, current_user)
