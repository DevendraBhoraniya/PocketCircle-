from decimal import Decimal
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.audit_event import AuditEvent
from models.expense import Expense, ExpenseParticipant, ExpensePayer
from models.group import Group, GroupMember
from models.user import User
from schemas.audit import AuditEventResponse
from schemas.auth import PublicUser
from schemas.balances import (
    GroupBalanceSummaryItem,
    GroupBalancesResponse,
    SettlementPlanResponse,
    SettlementTransferResponse,
    UserBalanceItem,
    UserCrossGroupSummary,
)
from services.balance_engine import simplify_debts
from services.group_service import (
    get_active_group_or_404,
    get_active_member,
    to_public_user,
)
from services.split_engine import quantize_currency


class BalanceService:
    @staticmethod
    async def get_group_balances(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> GroupBalancesResponse:
        group = await get_active_group_or_404(db, group_id)
        actor_membership = get_active_member(group, actor.id)
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this group",
            )

        # 1. Fetch active members and all circle members for fallback
        mem_result = await db.execute(
            select(GroupMember)
            .options(selectinload(GroupMember.user))
            .where(GroupMember.group_id == group_id)
        )
        all_members = mem_result.scalars().all()
        user_map: dict[uuid.UUID, PublicUser] = {
            m.user_id: to_public_user(m.user) for m in all_members if m.deleted_at is None and m.user is not None
        }
        all_members_lookup: dict[uuid.UUID, PublicUser] = {
            m.user_id: to_public_user(m.user) for m in all_members if m.user is not None
        }

        # 2. Fetch all active expenses with payers and participants
        exp_result = await db.execute(
            select(Expense)
            .options(
                selectinload(Expense.payers),
                selectinload(Expense.participants),
            )
            .where(
                Expense.group_id == group_id,
                Expense.deleted_at.is_(None),
            )
        )
        expenses = exp_result.scalars().all()

        total_paid_map: dict[uuid.UUID, Decimal] = {uid: Decimal("0.00") for uid in user_map}
        total_owed_map: dict[uuid.UUID, Decimal] = {uid: Decimal("0.00") for uid in user_map}
        total_group_spending = Decimal("0.00")

        for exp in expenses:
            total_group_spending += exp.amount
            for payer in exp.payers:
                total_paid_map[payer.user_id] = (
                    total_paid_map.get(payer.user_id, Decimal("0.00")) + payer.amount
                )
            for part in exp.participants:
                total_owed_map[part.user_id] = (
                    total_owed_map.get(part.user_id, Decimal("0.00")) + part.amount
                )

        # 3. Factor in confirmed settlements
        from models.settlement import Settlement
        settle_result = await db.execute(
            select(Settlement).where(
                Settlement.group_id == group_id,
                Settlement.status == "confirmed",
            )
        )
        confirmed_settlements = settle_result.scalars().all()

        # If any historical member still has an unsettled ledger entry, include them in user_map
        all_involved_uids = set(total_paid_map.keys()) | set(total_owed_map.keys())
        for s in confirmed_settlements:
            all_involved_uids.add(s.payer_id)
            all_involved_uids.add(s.payee_id)

        for uid in all_involved_uids:
            if uid not in user_map and uid in all_members_lookup:
                user_map[uid] = all_members_lookup[uid]

        return BalanceService.compute_balances_from_data(
            group_id=group_id,
            user_map=user_map,
            expenses=expenses,
            confirmed_settlements=confirmed_settlements,
            actor_id=actor.id,
        )

    @staticmethod
    def compute_balances_from_data(
        group_id: uuid.UUID,
        user_map: dict[uuid.UUID, PublicUser],
        expenses: list[Expense],
        confirmed_settlements: list,
        actor_id: uuid.UUID,
    ) -> GroupBalancesResponse:
        total_paid_map: dict[uuid.UUID, Decimal] = {uid: Decimal("0.00") for uid in user_map}
        total_owed_map: dict[uuid.UUID, Decimal] = {uid: Decimal("0.00") for uid in user_map}
        total_group_spending = Decimal("0.00")

        for exp in expenses:
            total_group_spending += exp.amount
            for payer in exp.payers:
                total_paid_map[payer.user_id] = (
                    total_paid_map.get(payer.user_id, Decimal("0.00")) + payer.amount
                )
            for part in exp.participants:
                total_owed_map[part.user_id] = (
                    total_owed_map.get(part.user_id, Decimal("0.00")) + part.amount
                )

        for s in confirmed_settlements:
            total_paid_map[s.payer_id] = (
                total_paid_map.get(s.payer_id, Decimal("0.00")) + s.amount
            )
            total_owed_map[s.payee_id] = (
                total_owed_map.get(s.payee_id, Decimal("0.00")) + s.amount
            )

        balances: list[UserBalanceItem] = []
        my_net_balance = Decimal("0.00")

        for uid, p_user in user_map.items():
            paid = quantize_currency(total_paid_map.get(uid, Decimal("0.00")))
            owed = quantize_currency(total_owed_map.get(uid, Decimal("0.00")))
            net = paid - owed

            if net > Decimal("0.00"):
                user_status = "owed"
            elif net < Decimal("0.00"):
                user_status = "owes"
            else:
                user_status = "settled"

            if uid == actor_id:
                my_net_balance = net

            balances.append(
                UserBalanceItem(
                    user=p_user,
                    net_balance=net,
                    total_paid=paid,
                    total_owed=owed,
                    status=user_status,
                )
            )

        net_sum = sum((b.net_balance for b in balances), Decimal("0.00"))
        if abs(net_sum) > Decimal("0.01"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Balance engine invariant violated: sum of net balances is {net_sum}",
            )

        balances.sort(key=lambda b: b.net_balance, reverse=True)

        return GroupBalancesResponse(
            group_id=group_id,
            total_group_spending=quantize_currency(total_group_spending),
            my_net_balance=my_net_balance,
            balances=balances,
        )

    @staticmethod
    def compute_plan_from_balances(
        group_id: uuid.UUID,
        balances_resp: GroupBalancesResponse,
    ) -> SettlementPlanResponse:
        user_map: dict[uuid.UUID, PublicUser] = {
            b.user.id: b.user for b in balances_resp.balances
        }
        net_balances = {b.user.id: b.net_balance for b in balances_resp.balances}

        simplified_transfers = simplify_debts(net_balances)

        formatted_transfers: list[SettlementTransferResponse] = []
        total_settlement = Decimal("0.00")

        for t in simplified_transfers:
            from_u = user_map.get(t.from_user_id)
            to_u = user_map.get(t.to_user_id)
            if from_u and to_u:
                formatted_transfers.append(
                    SettlementTransferResponse(
                        from_user=from_u,
                        to_user=to_u,
                        amount=t.amount,
                    )
                )
                total_settlement += t.amount

        return SettlementPlanResponse(
            group_id=group_id,
            transfers=formatted_transfers,
            total_settlement_amount=quantize_currency(total_settlement),
        )

    @staticmethod
    async def get_settlement_plan(
        db: AsyncSession,
        group_id: uuid.UUID,
        actor: User,
    ) -> SettlementPlanResponse:
        balances_resp = await BalanceService.get_group_balances(db, group_id, actor)
        return BalanceService.compute_plan_from_balances(group_id, balances_resp)

    @staticmethod
    async def get_user_cross_group_summary(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> UserCrossGroupSummary:
        from collections import defaultdict
        from models.settlement import Settlement

        # 1. Fetch user's active group memberships
        mem_result = await db.execute(
            select(GroupMember)
            .join(Group, Group.id == GroupMember.group_id)
            .where(
                GroupMember.user_id == user_id,
                GroupMember.deleted_at.is_(None),
                Group.deleted_at.is_(None),
            )
            .options(
                selectinload(GroupMember.group).selectinload(Group.members),
            )
        )
        memberships = mem_result.scalars().all()

        if not memberships:
            return UserCrossGroupSummary(
                overall_net_balance=Decimal("0.00"),
                total_owed_to_me=Decimal("0.00"),
                total_i_owe=Decimal("0.00"),
                groups=[],
                recent_activity=[],
            )

        active_group_ids = [m.group.id for m in memberships]

        # 2. Batch fetch all active expenses with payers and participants across ALL active groups
        exp_result = await db.execute(
            select(Expense)
            .options(
                selectinload(Expense.payers),
                selectinload(Expense.participants),
            )
            .where(
                Expense.group_id.in_(active_group_ids),
                Expense.deleted_at.is_(None),
            )
        )
        all_expenses = exp_result.scalars().all()

        expenses_by_group: dict[uuid.UUID, list[Expense]] = defaultdict(list)
        for exp in all_expenses:
            expenses_by_group[exp.group_id].append(exp)

        # 3. Batch fetch all confirmed settlements across ALL active groups
        settle_result = await db.execute(
            select(Settlement).where(
                Settlement.group_id.in_(active_group_ids),
                Settlement.status == "confirmed",
            )
        )
        all_settles = settle_result.scalars().all()

        settles_by_group: dict[uuid.UUID, list[Settlement]] = defaultdict(list)
        for s in all_settles:
            settles_by_group[s.group_id].append(s)

        overall_net = Decimal("0.00")
        total_owed_to_me = Decimal("0.00")
        total_i_owe = Decimal("0.00")
        group_summaries: list[GroupBalanceSummaryItem] = []

        for m in memberships:
            grp = m.group
            active_member_count = sum(1 for gm in grp.members if gm.deleted_at is None)

            paid_in_grp = Decimal("0.00")
            owed_in_grp = Decimal("0.00")

            for exp in expenses_by_group.get(grp.id, []):
                for p in exp.payers:
                    if p.user_id == user_id:
                        paid_in_grp += p.amount
                for pt in exp.participants:
                    if pt.user_id == user_id:
                        owed_in_grp += pt.amount

            for s in settles_by_group.get(grp.id, []):
                if s.payer_id == user_id:
                    paid_in_grp += s.amount
                if s.payee_id == user_id:
                    owed_in_grp += s.amount

            net_in_grp = quantize_currency(paid_in_grp - owed_in_grp)
            overall_net += net_in_grp

            if net_in_grp > Decimal("0.00"):
                status_str = "owed"
                total_owed_to_me += net_in_grp
            elif net_in_grp < Decimal("0.00"):
                status_str = "owes"
                total_i_owe += abs(net_in_grp)
            else:
                status_str = "settled"

            group_summaries.append(
                GroupBalanceSummaryItem(
                    group_id=grp.id,
                    group_name=grp.name,
                    my_net_balance=net_in_grp,
                    my_role=m.role,
                    member_count=active_member_count,
                    status=status_str,
                )
            )

        # 2. Fetch latest 10 activity events across user's active groups
        recent_events: list[AuditEventResponse] = []
        if active_group_ids:
            act_result = await db.execute(
                select(AuditEvent)
                .options(selectinload(AuditEvent.actor))
                .where(AuditEvent.group_id.in_(active_group_ids))
                .order_by(AuditEvent.created_at.desc())
                .limit(10)
            )
            events = act_result.scalars().all()
            recent_events = [
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
                if e.actor is not None
            ]

        return UserCrossGroupSummary(
            overall_net_balance=quantize_currency(overall_net),
            total_owed_to_me=quantize_currency(total_owed_to_me),
            total_i_owe=quantize_currency(total_i_owe),
            groups=group_summaries,
            recent_activity=recent_events,
        )
