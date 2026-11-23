from datetime import datetime, timezone
from decimal import Decimal
import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.audit_event import AuditEvent
from models.expense import Expense, ExpenseParticipant, ExpensePayer
from models.friendship import Friendship
from models.group import Group, GroupMember
from models.settlement import Settlement
from models.user import User
from schemas.auth import PublicUser
from schemas.groups import (
    CreateGroupRequest,
    GroupDetail,
    GroupMemberItem,
    GroupSummary,
    UpdateGroupRequest,
)
from services.split_engine import quantize_currency



def to_public_user(user: User) -> PublicUser:
    return PublicUser.model_validate(user)


async def check_is_accepted_friend(db: AsyncSession, user_id: uuid.UUID, friend_id: uuid.UUID) -> bool:
    if user_id == friend_id:
        return False
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id),
            ),
            Friendship.status == "accepted",
        )
    )
    return result.scalar_one_or_none() is not None


async def get_active_group_or_404(db: AsyncSession, group_id: uuid.UUID) -> Group:
    result = await db.execute(
        select(Group)
        .options(selectinload(Group.members).selectinload(GroupMember.user))
        .where(Group.id == group_id, Group.deleted_at.is_(None))
    )
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )
    return group


def get_active_member(group: Group, user_id: uuid.UUID) -> GroupMember | None:
    for m in group.members:
        if m.user_id == user_id and m.deleted_at is None:
            return m
    return None


async def log_audit_event(
    db: AsyncSession,
    actor_id: uuid.UUID,
    group_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID,
    details: dict | None = None,
):
    event = AuditEvent(
        id=uuid.uuid4(),
        actor_id=actor_id,
        group_id=group_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details) if details else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)


async def assert_member_can_depart(db: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """
    Guarantees ledger integrity: prevents a member from leaving or being removed
    if they have pending settlements or an unsettled net balance in the circle.
    """
    # 1. Reject if there are any pending settlements involving this member
    pending_settlement_res = await db.execute(
        select(Settlement.id).where(
            Settlement.group_id == group_id,
            Settlement.status == "pending",
            or_(Settlement.payer_id == user_id, Settlement.payee_id == user_id),
        )
    )
    if pending_settlement_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Cannot leave or remove member with pending settlements in this circle. Please confirm or cancel pending settlements first.",
        )

    # 2. Check net balance in active expenses & confirmed settlements
    paid_res = await db.execute(
        select(ExpensePayer.amount)
        .join(Expense, Expense.id == ExpensePayer.expense_id)
        .where(
            Expense.group_id == group_id,
            Expense.deleted_at.is_(None),
            ExpensePayer.user_id == user_id,
        )
    )
    total_paid = sum(paid_res.scalars().all(), Decimal("0.00"))

    owed_res = await db.execute(
        select(ExpenseParticipant.amount)
        .join(Expense, Expense.id == ExpenseParticipant.expense_id)
        .where(
            Expense.group_id == group_id,
            Expense.deleted_at.is_(None),
            ExpenseParticipant.user_id == user_id,
        )
    )
    total_owed = sum(owed_res.scalars().all(), Decimal("0.00"))

    settled_paid_res = await db.execute(
        select(Settlement.amount).where(
            Settlement.group_id == group_id,
            Settlement.status == "confirmed",
            Settlement.payer_id == user_id,
        )
    )
    settled_paid = sum(settled_paid_res.scalars().all(), Decimal("0.00"))

    settled_recv_res = await db.execute(
        select(Settlement.amount).where(
            Settlement.group_id == group_id,
            Settlement.status == "confirmed",
            Settlement.payee_id == user_id,
        )
    )
    settled_received = sum(settled_recv_res.scalars().all(), Decimal("0.00"))

    net_balance = quantize_currency((total_paid - total_owed) + (settled_paid - settled_received))
    if abs(net_balance) > Decimal("0.00"):
        debt_status = (
            f"owes ₹{abs(net_balance):.2f}"
            if net_balance < Decimal("0.00")
            else f"is owed ₹{net_balance:.2f}"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot remove or leave circle with an unsettled balance. This member {debt_status}. All balances must be ₹0.00 before departure.",
        )



class GroupService:
    @staticmethod
    async def create_group(
        db: AsyncSession,
        creator: User,
        data: CreateGroupRequest,
    ) -> GroupDetail:
        # Validate initial members: must be accepted friends
        clean_initial_ids = set()
        for fid in data.initial_member_ids:
            if fid == creator.id:
                continue
            is_friend = await check_is_accepted_friend(db, creator.id, fid)
            if not is_friend:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"User {fid} is not your accepted friend",
                )
            clean_initial_ids.add(fid)

        new_group = Group(
            id=uuid.uuid4(),
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            owner_id=creator.id,
            visibility=data.visibility,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(new_group)
        await db.flush()

        # Add creator as owner
        creator_membership = GroupMember(
            id=uuid.uuid4(),
            group_id=new_group.id,
            user_id=creator.id,
            role="owner",
            joined_at=datetime.now(timezone.utc),
        )
        db.add(creator_membership)

        # Add initial members
        for fid in clean_initial_ids:
            member = GroupMember(
                id=uuid.uuid4(),
                group_id=new_group.id,
                user_id=fid,
                role="member",
                joined_at=datetime.now(timezone.utc),
            )
            db.add(member)

        await log_audit_event(
            db,
            actor_id=creator.id,
            group_id=new_group.id,
            action="group_created",
            entity_type="group",
            entity_id=new_group.id,
            details={"name": new_group.name, "member_count": 1 + len(clean_initial_ids)},
        )

        from services.notification_service import NotificationService
        for fid in clean_initial_ids:
            await NotificationService.create_notification(
                db=db,
                recipient_id=fid,
                actor_id=creator.id,
                group_id=new_group.id,
                event_type="GROUP_MEMBER_ADDED",
                payload=f"{creator.name} added you to '{new_group.name}'",
            )

        await db.commit()


        # Fetch fully loaded group
        return await GroupService.get_group_detail(db, new_group.id, creator.id)

    @staticmethod
    async def list_user_groups(db: AsyncSession, user_id: uuid.UUID) -> list[GroupSummary]:
        result = await db.execute(
            select(GroupMember)
            .join(Group, Group.id == GroupMember.group_id)
            .where(
                GroupMember.user_id == user_id,
                GroupMember.deleted_at.is_(None),
                Group.deleted_at.is_(None),
            )
            .options(selectinload(GroupMember.group).selectinload(Group.members))
        )
        memberships = result.scalars().all()

        summaries = []
        for m in memberships:
            grp = m.group
            active_count = sum(1 for gm in grp.members if gm.deleted_at is None)
            summaries.append(
                GroupSummary(
                    id=grp.id,
                    name=grp.name,
                    description=grp.description,
                    owner_id=grp.owner_id,
                    visibility=grp.visibility,
                    my_role=m.role,
                    member_count=active_count,
                    created_at=grp.created_at,
                )
            )
        return summaries

    @staticmethod
    async def list_public_groups(db: AsyncSession, limit: int = 50) -> list[GroupSummary]:
        result = await db.execute(
            select(Group)
            .options(selectinload(Group.members))
            .where(
                Group.visibility == "public",
                Group.deleted_at.is_(None),
            )
            .order_by(Group.created_at.desc())
            .limit(limit)
        )
        groups = result.scalars().all()
        summaries = []
        for grp in groups:
            active_count = sum(1 for gm in grp.members if gm.deleted_at is None)
            summaries.append(
                GroupSummary(
                    id=grp.id,
                    name=grp.name,
                    description=grp.description,
                    owner_id=grp.owner_id,
                    visibility=grp.visibility,
                    my_role="member",
                    member_count=active_count,
                    created_at=grp.created_at,
                )
            )
        return summaries

    @staticmethod
    async def get_group_detail(
        db: AsyncSession,
        group_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)

        mem_result = await db.execute(
            select(GroupMember)
            .options(selectinload(GroupMember.user))
            .where(
                GroupMember.group_id == group_id,
                GroupMember.deleted_at.is_(None),
            )
            .order_by(GroupMember.joined_at.asc())
        )
        active_members_db = mem_result.scalars().all()

        current_membership = next(
            (m for m in active_members_db if m.user_id == user_id), None
        )
        if not current_membership:
            # YouTube-like visibility rule:
            # - Private: Requires active membership to view
            # - Unlisted & Public: Accessible via direct link/ID lookup
            if group.visibility == "private":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of this private circle",
                )

        active_members: list[GroupMemberItem] = [
            GroupMemberItem(
                id=m.id,
                user=to_public_user(m.user),
                role=m.role,
                joined_at=m.joined_at,
            )
            for m in active_members_db
            if m.user is not None
        ]

        return GroupDetail(
            id=group.id,
            name=group.name,
            description=group.description,
            owner_id=group.owner_id,
            visibility=group.visibility,
            my_role=current_membership.role if current_membership else None,
            members=active_members,
            created_at=group.created_at,
        )

    @staticmethod
    async def update_group(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        data: UpdateGroupRequest,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)
        membership = get_active_member(group, actor.id)
        if not membership or membership.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owners and admins can update group details",
            )

        if data.visibility is not None:
            # YouTube-like access rule: Only the circle owner can change visibility!
            if membership.role != "owner":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the group owner can change circle visibility",
                )
            group.visibility = data.visibility

        if data.name is not None:
            group.name = data.name.strip()
        if data.description is not None:
            group.description = data.description.strip()
        group.updated_at = datetime.now(timezone.utc)

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="group_updated",
            entity_type="group",
            entity_id=group.id,
            details={"name": group.name},
        )

        await db.commit()
        return await GroupService.get_group_detail(db, group.id, actor.id)

    @staticmethod
    async def delete_group(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> None:
        group = await get_active_group_or_404(db, group_id)
        membership = get_active_member(group, actor.id)
        if not membership or membership.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the group owner can delete the group",
            )

        now = datetime.now(timezone.utc)
        group.deleted_at = now
        for m in group.members:
            if m.deleted_at is None:
                m.deleted_at = now

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="group_deleted",
            entity_type="group",
            entity_id=group.id,
        )

        await db.commit()

    @staticmethod
    async def add_member(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        target_user_id: uuid.UUID,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership or actor_membership.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owners and admins can add members",
            )

        # Check target is accepted friend
        is_friend = await check_is_accepted_friend(db, actor.id, target_user_id)
        if not is_friend:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="You can only add users who are your accepted friends",
            )

        # Check target user exists
        target_user_res = await db.execute(
            select(User).where(User.id == target_user_id, User.deleted_at.is_(None))
        )
        target_user = target_user_res.scalar_one_or_none()
        if not target_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Check if already active member or previously soft-deleted member
        existing_mem_res = await db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == target_user_id,
            )
        )
        existing_mem = existing_mem_res.scalar_one_or_none()
        if existing_mem:
            if existing_mem.deleted_at is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="User is already an active member of this group",
                )
            # Reactivate
            existing_mem.deleted_at = None
            existing_mem.role = "member"
            existing_mem.joined_at = datetime.now(timezone.utc)
        else:
            new_mem = GroupMember(
                id=uuid.uuid4(),
                group_id=group.id,
                user_id=target_user.id,
                role="member",
                joined_at=datetime.now(timezone.utc),
            )
            db.add(new_mem)

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="member_added",
            entity_type="group_member",
            entity_id=target_user.id,
            details={"username": target_user.username, "name": target_user.name},
        )

        from services.notification_service import NotificationService
        await NotificationService.create_notification(
            db=db,
            recipient_id=target_user.id,
            actor_id=actor.id,
            group_id=group.id,
            event_type="GROUP_MEMBER_ADDED",
            payload=f"{actor.name} added you to '{group.name}'",
        )

        await db.commit()

        return await GroupService.get_group_detail(db, group.id, actor.id)

    @staticmethod
    async def update_member_role(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        target_user_id: uuid.UUID,
        new_role: str,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership or actor_membership.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the group owner can change member roles",
            )

        if target_user_id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Use transfer ownership to change owner role",
            )

        target_membership = get_active_member(group, target_user_id)
        if not target_membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group",
            )

        target_membership.role = new_role

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="member_role_changed",
            entity_type="group_member",
            entity_id=target_user_id,
            details={"new_role": new_role},
        )

        await db.commit()
        return await GroupService.get_group_detail(db, group.id, actor.id)

    @staticmethod
    async def transfer_ownership(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        new_owner_id: uuid.UUID,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership or actor_membership.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the group owner can transfer ownership",
            )

        if new_owner_id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="You are already the owner of this group",
            )

        target_membership = get_active_member(group, new_owner_id)
        if not target_membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target user must be an active member of the group",
            )

        group.owner_id = new_owner_id
        target_membership.role = "owner"
        actor_membership.role = "admin"

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="group_ownership_transferred",
            entity_type="group",
            entity_id=group.id,
            details={"from_user": str(actor.id), "to_user": str(new_owner_id)},
        )

        await db.commit()
        return await GroupService.get_group_detail(db, group.id, actor.id)

    @staticmethod
    async def remove_member(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
        target_user_id: uuid.UUID,
    ) -> GroupDetail:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership or actor_membership.role not in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owners and admins can remove members",
            )

        if target_user_id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Cannot remove yourself. Use leave group instead.",
            )

        target_membership = get_active_member(group, target_user_id)
        if not target_membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this group",
            )

        if actor_membership.role == "admin" and target_membership.role in ("owner", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot remove the owner or other admins",
            )

        # Enforce ledger integrity: verify target member has 0 balance and no pending settlements
        await assert_member_can_depart(db, group.id, target_user_id)

        target_membership.deleted_at = datetime.now(timezone.utc)

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="member_removed",
            entity_type="group_member",
            entity_id=target_user_id,
        )

        await db.commit()
        return await GroupService.get_group_detail(db, group.id, actor.id)

    @staticmethod
    async def leave_group(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> None:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        active_members = [m for m in group.members if m.deleted_at is None]
        if actor_membership.role == "owner":
            if len(active_members) > 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Owner cannot leave without transferring ownership first",
                )
            # Sole member leaving deletes group
            group.deleted_at = datetime.now(timezone.utc)

        # Enforce ledger integrity: verify departing member has 0 balance and no pending settlements
        if len(active_members) > 1:
            await assert_member_can_depart(db, group.id, actor.id)

        actor_membership.deleted_at = datetime.now(timezone.utc)

        await log_audit_event(
            db,
            actor_id=actor.id,
            group_id=group.id,
            action="member_left",
            entity_type="group_member",
            entity_id=actor.id,
        )

        await db.commit()

    @staticmethod
    async def get_group_overview(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ):
        from models.expense import Expense, ExpensePayer, ExpenseParticipant
        from models.settlement import Settlement
        from schemas.audit import AuditEventResponse
        from schemas.expenses import ExpenseResponse, ExpensePayerResponse, ExpenseParticipantResponse
        from schemas.groups import GroupOverviewResponse
        from schemas.settlements import SettlementResponse
        from services.balance_service import BalanceService

        # 1. Fetch group detail (verifies visibility/membership & 404)
        group_detail = await GroupService.get_group_detail(db, group_id, actor.id)
        if group_detail.my_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be a member of this circle to view its financial ledger and balances",
            )
        user_map: dict[uuid.UUID, PublicUser] = {m.user.id: m.user for m in group_detail.members}

        # 2. Fetch expenses with payers & participants
        exp_result = await db.execute(
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
        expenses = exp_result.scalars().all()
        expense_responses = [
            ExpenseResponse(
                id=e.id,
                group_id=e.group_id,
                description=e.description,
                amount=e.amount,
                split_type=e.split_type,
                creator=to_public_user(e.creator),
                payers=[
                    ExpensePayerResponse(
                        id=p.id,
                        user=to_public_user(p.user),
                        amount=p.amount,
                    )
                    for p in e.payers
                    if p.user is not None
                ],
                participants=[
                    ExpenseParticipantResponse(
                        id=pt.id,
                        user=to_public_user(pt.user),
                        amount=pt.amount,
                    )
                    for pt in e.participants
                    if pt.user is not None
                ],
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in expenses
        ]

        # 3. Fetch audit activity
        act_result = await db.execute(
            select(AuditEvent)
            .options(selectinload(AuditEvent.actor))
            .where(AuditEvent.group_id == group_id)
            .order_by(AuditEvent.created_at.desc())
            .limit(50)
        )
        activity_events = [
            AuditEventResponse(
                id=ev.id,
                group_id=ev.group_id,
                actor=to_public_user(ev.actor),
                action=ev.action,
                entity_type=ev.entity_type,
                entity_id=ev.entity_id,
                details=ev.details,
                created_at=ev.created_at,
            )
            for ev in act_result.scalars().all()
            if ev.actor is not None
        ]

        # 4. Fetch settlements
        settle_result = await db.execute(
            select(Settlement)
            .options(
                selectinload(Settlement.payer),
                selectinload(Settlement.payee),
                selectinload(Settlement.action_by),
            )
            .where(Settlement.group_id == group_id)
            .order_by(Settlement.created_at.desc())
        )
        settlements = settle_result.scalars().all()
        settlement_responses = [
            SettlementResponse(
                id=s.id,
                group_id=s.group_id,
                payer=to_public_user(s.payer),
                payee=to_public_user(s.payee),
                amount=s.amount,
                status=s.status,
                notes=s.notes,
                action_by=to_public_user(s.action_by) if s.action_by else None,
                action_at=s.action_at,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in settlements
        ]

        # 5. In-memory balances and settlement plan calculation (0 queries)
        confirmed_settlements = [s for s in settlements if s.status == "confirmed"]
        balances_resp = BalanceService.compute_balances_from_data(
            group_id=group_id,
            user_map=user_map,
            expenses=expenses,
            confirmed_settlements=confirmed_settlements,
            actor_id=actor.id,
        )
        settlement_plan_resp = BalanceService.compute_plan_from_balances(group_id, balances_resp)

        return GroupOverviewResponse(
            group=group_detail,
            expenses=expense_responses,
            activity=activity_events,
            balances=balances_resp,
            settlement_plan=settlement_plan_resp,
            settlements=settlement_responses,
        )
