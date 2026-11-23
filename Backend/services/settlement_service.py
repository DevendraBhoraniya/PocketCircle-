from datetime import datetime, timezone
from decimal import Decimal
import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.audit_event import AuditEvent
from models.group import Group, GroupMember
from models.settlement import Settlement
from models.user import User
from schemas.settlements import CreateSettlementRequest, SettlementResponse
from services.group_service import (
    get_active_group_or_404,
    get_active_member,
    to_public_user,
)
from services.split_engine import quantize_currency


def to_settlement_response(s: Settlement) -> SettlementResponse:
    return SettlementResponse(
        id=s.id,
        group_id=s.group_id,
        payer=to_public_user(s.payer),
        payee=to_public_user(s.payee),
        amount=quantize_currency(s.amount),
        status=s.status,
        notes=s.notes,
        action_by=to_public_user(s.action_by) if s.action_by else None,
        action_at=s.action_at,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


class SettlementService:
    @staticmethod
    async def list_settlements(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> list[SettlementResponse]:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
                selectinload(Settlement.action_by),
            )
            .where(Settlement.group_id == group_id)
            .order_by(Settlement.created_at.desc())
        )
        settlements = result.scalars().all()
        return [to_settlement_response(s) for s in settlements]

    @staticmethod
    async def create_settlement_request(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        data: CreateSettlementRequest,
    ) -> SettlementResponse:
        group = await get_active_group_or_404(db, group_id)
        payer_member = get_active_member(group, actor.id)
        if not payer_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        if actor.id == data.payee_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot record a settlement with yourself",
            )

        payee_member = get_active_member(group, data.payee_id)
        if not payee_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payee is not an active member of this group",
            )

        quantized_amount = quantize_currency(data.amount)
        if quantized_amount <= Decimal("0.00"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Settlement amount must be greater than zero",
            )

        settlement = Settlement(
            id=uuid.uuid4(),
            group_id=group_id,
            payer_id=actor.id,
            payee_id=data.payee_id,
            amount=quantized_amount,
            status="pending",
            notes=data.notes.strip() if data.notes else None,
        )
        db.add(settlement)

        audit = AuditEvent(
            group_id=group_id,
            actor_id=actor.id,
            action="SETTLEMENT_REQUESTED",
            entity_type="settlement",
            entity_id=settlement.id,
            details=json.dumps(
                {
                    "amount": str(quantized_amount),
                    "payer": actor.name,
                    "payee": payee_member.user.name,
                    "notes": settlement.notes,
                }
            ),
        )
        db.add(audit)

        from services.notification_service import NotificationService
        await NotificationService.create_notification(
            db=db,
            recipient_id=settlement.payee_id,
            actor_id=actor.id,
            group_id=group_id,
            event_type="SETTLEMENT_REQUESTED",
            payload=f"{actor.name} recorded an off-platform payment of ₹{quantized_amount} to you in '{group.name}'",
        )

        await db.commit()


        # Re-fetch with relationships loaded
        return await SettlementService.get_settlement_by_id(db, settlement.id)

    @staticmethod
    async def get_settlement_by_id(
        db: AsyncSession,
        settlement_id: uuid.UUID,
    ) -> SettlementResponse:
        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
                selectinload(Settlement.action_by),
            )
            .where(Settlement.id == settlement_id)
        )
        settlement = result.scalar_one_or_none()
        if not settlement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Settlement not found",
            )
        return to_settlement_response(settlement)

    @staticmethod
    async def confirm_settlement(
        db: AsyncSession,
        group_id: uuid.UUID,
        settlement_id: uuid.UUID,
        actor: User,
    ) -> SettlementResponse:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
            )
            .where(
                Settlement.id == settlement_id,
                Settlement.group_id == group_id,
            )
            .with_for_update()
        )
        settlement = result.scalar_one_or_none()
        if not settlement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Settlement not found",
            )

        if settlement.status == "confirmed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Settlement cannot be confirmed because it is already confirmed",
            )

        if settlement.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Settlement cannot be confirmed because it is already {settlement.status}",
            )

        # Only the payee can confirm receipt of payment
        if settlement.payee_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the payee can confirm receipt of this settlement",
            )

        settlement.status = "confirmed"
        settlement.action_by_id = actor.id
        settlement.action_at = datetime.now(timezone.utc)

        audit = AuditEvent(
            group_id=group_id,
            actor_id=actor.id,
            action="SETTLEMENT_CONFIRMED",
            entity_type="settlement",
            entity_id=settlement.id,
            details=json.dumps(
                {
                    "amount": str(settlement.amount),
                    "payer": settlement.payer.name,
                    "payee": actor.name,
                    "notes": settlement.notes,
                }
            ),
        )
        db.add(audit)

        from services.notification_service import NotificationService
        await NotificationService.create_notification(
            db=db,
            recipient_id=settlement.payer_id,
            actor_id=actor.id,
            group_id=group_id,
            event_type="SETTLEMENT_CONFIRMED",
            payload=f"{actor.name} confirmed your payment of ₹{settlement.amount} in '{group.name}'",
        )

        await db.commit()
        return await SettlementService.get_settlement_by_id(db, settlement.id)

    @staticmethod
    async def reject_settlement(
        db: AsyncSession,
        group_id: uuid.UUID,
        settlement_id: uuid.UUID,
        actor: User,
    ) -> SettlementResponse:
        group = await get_active_group_or_404(db, group_id)
        if not get_active_member(group, actor.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
            )
            .where(
                Settlement.id == settlement_id,
                Settlement.group_id == group_id,
            )
            .with_for_update()
        )
        settlement = result.scalar_one_or_none()
        if not settlement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Settlement not found",
            )

        if settlement.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Settlement cannot be rejected because it is already {settlement.status}",
            )

        # Only the payee can reject the settlement request
        if settlement.payee_id != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the payee can reject this settlement request",
            )

        settlement.status = "rejected"
        settlement.action_by_id = actor.id
        settlement.action_at = datetime.now(timezone.utc)

        audit = AuditEvent(
            group_id=group_id,
            actor_id=actor.id,
            action="SETTLEMENT_REJECTED",
            entity_type="settlement",
            entity_id=settlement.id,
            details=json.dumps(
                {
                    "amount": str(settlement.amount),
                    "payer": settlement.payer.name,
                    "payee": actor.name,
                }
            ),
        )
        db.add(audit)

        from services.notification_service import NotificationService
        await NotificationService.create_notification(
            db=db,
            recipient_id=settlement.payer_id,
            actor_id=actor.id,
            group_id=group_id,
            event_type="SETTLEMENT_REJECTED",
            payload=f"{actor.name} rejected your payment of ₹{settlement.amount} in '{group.name}'",
        )

        await db.commit()
        return await SettlementService.get_settlement_by_id(db, settlement.id)

    @staticmethod
    async def cancel_settlement(
        db: AsyncSession,
        group_id: uuid.UUID,
        settlement_id: uuid.UUID,
        actor: User,
    ) -> SettlementResponse:
        group = await get_active_group_or_404(db, group_id)
        actor_member = get_active_member(group, actor.id)
        if not actor_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
            )
            .where(
                Settlement.id == settlement_id,
                Settlement.group_id == group_id,
            )
            .with_for_update()
        )
        settlement = result.scalar_one_or_none()
        if not settlement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Settlement not found",
            )

        if settlement.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Settlement cannot be cancelled because it is already {settlement.status}",
            )

        # Either the payer who created it or a group admin/owner can cancel a pending request
        is_creator = settlement.payer_id == actor.id
        is_admin_or_owner = actor_member.role in ("owner", "admin")

        if not (is_creator or is_admin_or_owner):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the payer or group admin can cancel this settlement request",
            )

        settlement.status = "cancelled"
        settlement.action_by_id = actor.id
        settlement.action_at = datetime.now(timezone.utc)

        audit = AuditEvent(
            group_id=group_id,
            actor_id=actor.id,
            action="SETTLEMENT_CANCELLED",
            entity_type="settlement",
            entity_id=settlement.id,
            details=json.dumps(
                {
                    "amount": str(settlement.amount),
                    "cancelled_by": actor.name,
                }
            ),
        )
        db.add(audit)

        from services.notification_service import NotificationService
        target_to_notify = settlement.payee_id if actor.id == settlement.payer_id else settlement.payer_id
        await NotificationService.create_notification(
            db=db,
            recipient_id=target_to_notify,
            actor_id=actor.id,
            group_id=group_id,
            event_type="SETTLEMENT_CANCELLED",
            payload=f"{actor.name} cancelled the payment request of ₹{settlement.amount} in '{group.name}'",
        )

        await db.commit()
        return await SettlementService.get_settlement_by_id(db, settlement.id)

