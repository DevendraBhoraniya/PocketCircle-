from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.group import Group, GroupMember
from models.notification import Notification
from models.user import User
from schemas.auth import PublicUser
from schemas.notifications import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from services.group_service import to_public_user


class NotificationService:
    @staticmethod
    async def create_notification(
        db: AsyncSession,
        recipient_id: uuid.UUID,
        event_type: str,
        payload: str,
        actor_id: Optional[uuid.UUID] = None,
        group_id: Optional[uuid.UUID] = None,
    ) -> Optional[Notification]:
        """Create a single notification. Skips if recipient is the actor."""
        if actor_id is not None and recipient_id == actor_id:
            return None

        notification = Notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            group_id=group_id,
            event_type=event_type,
            payload=payload,
            is_read=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notification)
        return notification

    @staticmethod
    async def create_group_notification(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor_id: uuid.UUID,
        event_type: str,
        payload: str,
    ) -> list[Notification]:
        """Notify all active group members except the actor."""
        result = await db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == group_id,
                GroupMember.deleted_at.is_(None),
                GroupMember.user_id != actor_id,
            )
        )
        recipient_ids = result.scalars().all()
        created = []
        for r_id in recipient_ids:
            notif = Notification(
                recipient_id=r_id,
                actor_id=actor_id,
                group_id=group_id,
                event_type=event_type,
                payload=payload,
                is_read=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(notif)
            created.append(notif)
        return created

    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: uuid.UUID,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> NotificationListResponse:
        """Fetch notifications for a user with actor and group details."""
        query = (
            select(Notification)
            .options(
                selectinload(Notification.actor),
                selectinload(Notification.group),
            )
            .where(Notification.recipient_id == user_id)
        )
        if unread_only:
            query = query.where(Notification.is_read.is_(False))

        query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        notifications = result.scalars().all()

        # Count total
        total_stmt = select(func.count(Notification.id)).where(Notification.recipient_id == user_id)
        if unread_only:
            total_stmt = total_stmt.where(Notification.is_read.is_(False))
        total_count = (await db.execute(total_stmt)).scalar() or 0

        # Count unread
        unread_stmt = select(func.count(Notification.id)).where(
            Notification.recipient_id == user_id,
            Notification.is_read.is_(False),
        )
        unread_count = (await db.execute(unread_stmt)).scalar() or 0

        items = [
            NotificationResponse(
                id=n.id,
                recipient_id=n.recipient_id,
                actor_id=n.actor_id,
                group_id=n.group_id,
                group_name=n.group.name if n.group else None,
                event_type=n.event_type,
                payload=n.payload,
                is_read=n.is_read,
                read_at=n.read_at,
                created_at=n.created_at,
                actor=to_public_user(n.actor) if n.actor else None,
            )
            for n in notifications
        ]

        return NotificationListResponse(
            notifications=items,
            total_count=total_count,
            unread_count=unread_count,
        )

    @staticmethod
    async def get_unread_count(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> UnreadCountResponse:
        """Get count of unread notifications for a user."""
        stmt = select(func.count(Notification.id)).where(
            Notification.recipient_id == user_id,
            Notification.is_read.is_(False),
        )
        count = (await db.execute(stmt)).scalar() or 0
        return UnreadCountResponse(unread_count=count)

    @staticmethod
    async def mark_as_read(
        db: AsyncSession,
        notification_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> NotificationResponse:
        """Mark a specific notification as read."""
        result = await db.execute(
            select(Notification)
            .options(
                selectinload(Notification.actor),
                selectinload(Notification.group),
            )
            .where(
                Notification.id == notification_id,
                Notification.recipient_id == user_id,
            )
        )
        notification = result.scalar_one_or_none()
        if notification is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found",
            )

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(notification)

        return NotificationResponse(
            id=notification.id,
            recipient_id=notification.recipient_id,
            actor_id=notification.actor_id,
            group_id=notification.group_id,
            group_name=notification.group.name if notification.group else None,
            event_type=notification.event_type,
            payload=notification.payload,
            is_read=notification.is_read,
            read_at=notification.read_at,
            created_at=notification.created_at,
            actor=to_public_user(notification.actor) if notification.actor else None,
        )

    @staticmethod
    async def mark_all_as_read(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """Mark all unread notifications for the user as read."""
        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(
                Notification.recipient_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True, read_at=now)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount
