from decimal import Decimal, ROUND_DOWN
import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.audit_event import AuditEvent
from models.expense import Expense, ExpenseParticipant, ExpensePayer
from models.group import Group, GroupMember
from models.user import User
from schemas.auth import PublicUser
from schemas.expenses import (
    CreateExpenseRequest,
    ExpenseParticipantResponse,
    ExpensePayerResponse,
    ExpenseResponse,
    UpdateExpenseRequest,
)
from schemas.audit import AuditEventResponse
from services.group_service import (
    get_active_group_or_404,
    get_active_member,
    log_audit_event,
    to_public_user,
)


from services.split_engine import (
    SplitValidationError,
    calculate_equal_split,
    quantize_currency,
    validate_and_allocate_exact_split,
    validate_payers,
)


class ExpenseService:
    @staticmethod
    def _format_expense(expense: Expense) -> ExpenseResponse:
        return ExpenseResponse(
            id=expense.id,
            group_id=expense.group_id,
            description=expense.description,
            amount=expense.amount,
            split_type=expense.split_type,
            creator=to_public_user(expense.creator),
            payers=[
                ExpensePayerResponse(
                    id=p.id,
                    user=to_public_user(p.user),
                    amount=p.amount,
                )
                for p in expense.payers
            ],
            participants=[
                ExpenseParticipantResponse(
                    id=pt.id,
                    user=to_public_user(pt.user),
                    amount=pt.amount,
                )
                for pt in expense.participants
            ],
            created_at=expense.created_at,
            updated_at=expense.updated_at,
        )

    @staticmethod
    async def create_expense(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        data: CreateExpenseRequest,
    ) -> ExpenseResponse:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        total_amount = data.amount.quantize(Decimal("0.01"))
        if total_amount <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Expense amount must be greater than zero",
            )

        active_member_dict = {
            m.user_id: m for m in group.members if m.deleted_at is None
        }

        # 1. Resolve & validate payers
        payers_map: dict[uuid.UUID, Decimal] = {}
        if not data.payers:
            # Default: current user paid 100%
            payers_map[actor.id] = total_amount
        else:
            raw_payers = {}
            for p in data.payers:
                if p.user_id not in active_member_dict:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Payer {p.user_id} is not an active member of this group",
                    )
                raw_payers[p.user_id] = p.amount
            try:
                payers_map = validate_payers(total_amount, raw_payers)
            except SplitValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(e),
                )

        # 2. Resolve & validate participants and split
        participants_map: dict[uuid.UUID, Decimal] = {}
        if data.split_type == "equal":
            if data.participants:
                target_ids = [pt.user_id for pt in data.participants]
            else:
                target_ids = list(active_member_dict.keys())

            for uid in target_ids:
                if uid not in active_member_dict:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Participant {uid} is not an active member of this group",
                    )

            try:
                participants_map = calculate_equal_split(total_amount, list(set(target_ids)))
            except SplitValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(e),
                )
        else:
            # Exact split
            if not data.participants:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Participants with amounts are required for exact split",
                )
            raw_shares = {}
            for pt in data.participants:
                if pt.user_id not in active_member_dict:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Participant {pt.user_id} is not an active member of this group",
                    )
                if pt.amount is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Participant {pt.user_id} requires a non-negative amount",
                    )
                raw_shares[pt.user_id] = pt.amount

            try:
                participants_map = validate_and_allocate_exact_split(total_amount, raw_shares)
            except SplitValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(e),
                )

        # 3. Create expense records
        new_expense = Expense(
            id=uuid.uuid4(),
            group_id=group.id,
            description=data.description.strip(),
            amount=total_amount,
            split_type=data.split_type,
            creator_id=actor.id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(new_expense)
        await db.flush()

        for uid, amt in payers_map.items():
            db.add(
                ExpensePayer(
                    id=uuid.uuid4(),
                    expense_id=new_expense.id,
                    user_id=uid,
                    amount=amt,
                )
            )

        for uid, amt in participants_map.items():
            db.add(
                ExpenseParticipant(
                    id=uuid.uuid4(),
                    expense_id=new_expense.id,
                    user_id=uid,
                    amount=amt,
                )
            )

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="expense_created",
            entity_type="expense",
            entity_id=new_expense.id,
            details={
                "description": new_expense.description,
                "amount": str(new_expense.amount),
                "split_type": new_expense.split_type,
            },
        )

        from services.notification_service import NotificationService
        await NotificationService.create_group_notification(
            db=db,
            group_id=group.id,
            actor_id=actor.id,
            event_type="EXPENSE_CREATED",
            payload=f"{actor.name} added '{new_expense.description}' (₹{new_expense.amount}) in '{group.name}'",
        )

        await db.commit()


        return await ExpenseService.get_expense_detail(db, group.id, new_expense.id, actor)

    @staticmethod
    async def get_expense_detail(
        db: AsyncSession,
        group_id: uuid.UUID,
        expense_id: uuid.UUID,
        actor: User,
    ) -> ExpenseResponse:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Expense)
            .options(
                selectinload(Expense.creator),
                selectinload(Expense.payers).selectinload(ExpensePayer.user),
                selectinload(Expense.participants).selectinload(ExpenseParticipant.user),
            )
            .where(
                Expense.id == expense_id,
                Expense.group_id == group_id,
                Expense.deleted_at.is_(None),
            )
        )
        expense = result.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )

        return ExpenseService._format_expense(expense)

    @staticmethod
    async def list_expenses(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> list[ExpenseResponse]:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Expense)
            .options(
                selectinload(Expense.creator),
                selectinload(Expense.payers).selectinload(ExpensePayer.user),
                selectinload(Expense.participants).selectinload(ExpenseParticipant.user),
            )
            .where(
                Expense.group_id == group_id,
                Expense.deleted_at.is_(None),
            )
            .order_by(Expense.created_at.desc())
        )
        expenses = result.scalars().all()
        return [ExpenseService._format_expense(e) for e in expenses]

    @staticmethod
    async def update_expense(
        db: AsyncSession,
        group_id: uuid.UUID,
        expense_id: uuid.UUID,
        actor: User,
        data: UpdateExpenseRequest,
    ) -> ExpenseResponse:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Expense)
            .options(
                selectinload(Expense.payers),
                selectinload(Expense.participants),
            )
            .where(
                Expense.id == expense_id,
                Expense.group_id == group_id,
                Expense.deleted_at.is_(None),
            )
        )
        expense = result.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )

        # Check edit authorization: creator, owner, or admin
        if (
            expense.creator_id != actor.id
            and actor_membership.role not in ("owner", "admin")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the expense creator, group owner, or group admin can edit this expense",
            )

        active_member_dict = {
            m.user_id: m for m in group.members if m.deleted_at is None
        }

        # New values or existing values
        new_description = data.description.strip() if data.description is not None else expense.description
        new_amount = data.amount.quantize(Decimal("0.01")) if data.amount is not None else expense.amount
        new_split_type = data.split_type if data.split_type is not None else expense.split_type

        # Re-resolve payers if provided, else keep existing if valid
        payers_map: dict[uuid.UUID, Decimal] = {}
        if data.payers is not None:
            raw_payers = {}
            for p in data.payers:
                if p.user_id not in active_member_dict:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Payer {p.user_id} is not an active member of this group",
                    )
                raw_payers[p.user_id] = p.amount
            try:
                payers_map = validate_payers(new_amount, raw_payers)
            except SplitValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(e),
                )
        else:
            # If amount changed and payers not provided, default single payer to expense creator or actor
            if new_amount != expense.amount:
                payers_map[expense.creator_id] = new_amount
            else:
                for p in expense.payers:
                    payers_map[p.user_id] = p.amount

        # Re-resolve participants
        participants_map: dict[uuid.UUID, Decimal] = {}
        if new_split_type == "equal":
            if data.participants is not None:
                target_ids = [pt.user_id for pt in data.participants]
            else:
                target_ids = [pt.user_id for pt in expense.participants]

            for uid in target_ids:
                if uid not in active_member_dict:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"Participant {uid} is not an active member of this group",
                    )

            try:
                participants_map = calculate_equal_split(new_amount, list(set(target_ids)))
            except SplitValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=str(e),
                )
        else:
            if data.participants is None:
                if new_amount == expense.amount and expense.split_type == "exact":
                    for pt in expense.participants:
                        participants_map[pt.user_id] = pt.amount
                else:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="Participants with amounts are required for exact split when amount or split type changes",
                    )
            else:
                raw_shares = {}
                for pt in data.participants:
                    if pt.user_id not in active_member_dict:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail=f"Participant {pt.user_id} is not an active member of this group",
                        )
                    if pt.amount is None:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                            detail=f"Participant {pt.user_id} requires a non-negative amount",
                        )
                    raw_shares[pt.user_id] = pt.amount

                try:
                    participants_map = validate_and_allocate_exact_split(new_amount, raw_shares)
                except SplitValidationError as e:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=str(e),
                    )

        # Update expense
        expense.description = new_description
        expense.amount = new_amount
        expense.split_type = new_split_type
        expense.updated_at = datetime.now(timezone.utc)

        # Replace payers and participants (flush deletes first to avoid unique constraint collisions)
        for old_p in list(expense.payers):
            await db.delete(old_p)
        for old_pt in list(expense.participants):
            await db.delete(old_pt)
        await db.flush()

        for uid, amt in payers_map.items():
            db.add(
                ExpensePayer(
                    id=uuid.uuid4(),
                    expense_id=expense.id,
                    user_id=uid,
                    amount=amt,
                )
            )

        for uid, amt in participants_map.items():
            db.add(
                ExpenseParticipant(
                    id=uuid.uuid4(),
                    expense_id=expense.id,
                    user_id=uid,
                    amount=amt,
                )
            )

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="expense_updated",
            entity_type="expense",
            entity_id=expense.id,
            details={
                "description": expense.description,
                "amount": str(expense.amount),
                "split_type": expense.split_type,
            },
        )

        from services.notification_service import NotificationService
        await NotificationService.create_group_notification(
            db=db,
            group_id=group.id,
            actor_id=actor.id,
            event_type="EXPENSE_UPDATED",
            payload=f"{actor.name} updated '{expense.description}' (₹{expense.amount}) in '{group.name}'",
        )

        await db.commit()

        return await ExpenseService.get_expense_detail(db, group.id, expense.id, actor)

    @staticmethod
    async def delete_expense(
        db: AsyncSession,
        group_id: uuid.UUID,
        expense_id: uuid.UUID,
        actor: User,
    ) -> None:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Expense).where(
                Expense.id == expense_id,
                Expense.group_id == group_id,
                Expense.deleted_at.is_(None),
            )
        )
        expense = result.scalar_one_or_none()
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )

        # Check delete authorization: creator, owner, or admin
        if (
            expense.creator_id != actor.id
            and actor_membership.role not in ("owner", "admin")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the expense creator, group owner, or group admin can delete this expense",
            )

        expense.deleted_at = datetime.now(timezone.utc)

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="expense_deleted",
            entity_type="expense",
            entity_id=expense.id,
            details={"description": expense.description, "amount": str(expense.amount)},
        )

        from services.notification_service import NotificationService
        await NotificationService.create_group_notification(
            db=db,
            group_id=group.id,
            actor_id=actor.id,
            event_type="EXPENSE_DELETED",
            payload=f"{actor.name} deleted expense '{expense.description}' in '{group.name}'",
        )

        await db.commit()


    @staticmethod
    async def get_activity(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> list[AuditEventResponse]:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(AuditEvent)
            .options(selectinload(AuditEvent.actor))
            .where(AuditEvent.group_id == group_id)
            .order_by(AuditEvent.created_at.desc())
        )
        events = result.scalars().all()

        return [
            AuditEventResponse(
                id=e.id,
                group_id=e.group_id,
                actor=to_public_user(e.actor),
                action=e.action,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                details=e.details,
                created_at=e.created_at,
            )
            for e in events
        ]
