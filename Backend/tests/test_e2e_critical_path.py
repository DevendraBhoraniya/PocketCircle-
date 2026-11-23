from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_groups import create_test_user, make_friends


@pytest.mark.asyncio
async def test_full_e2e_critical_path_journey(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    End-to-End Critical Path Test:
    1. User creation and 10-digit Pocket ID discovery
    2. Friend request sending, notification, and acceptance
    3. Private circle creation with multiple friends
    4. Multi-payer and equal/exact decimal expense logging
    5. Deterministic balance reconciliation (net sum == 0)
    6. Greedy cash-flow settlement plan generation (<= N-1 transfers)
    7. Settlement request, notification, authorization, and payee confirmation
    8. Post-settlement ledger reconciliation (all balances == 0.00)
    9. Cross-circle summary and immutable audit history verification
    10. In-app notification center mark-all-read workflow
    """

    # ---------------------------------------------------------
    # STEP 1: User Provisioning
    # ---------------------------------------------------------
    alice, headers_alice = await create_test_user(db_session, "Alice E2E")
    bob, headers_bob = await create_test_user(db_session, "Bob E2E")
    charlie, headers_charlie = await create_test_user(db_session, "Charlie E2E")
    stranger, headers_stranger = await create_test_user(db_session, "David Stranger")

    # ---------------------------------------------------------
    # STEP 2: Friendship Discovery & Request Lifecycle
    # ---------------------------------------------------------
    # Alice searches for Bob using his 10-digit numeric Pocket ID
    search_res = await client.get(f"/users/search?q={bob.pocket_id}", headers=headers_alice)
    assert search_res.status_code == 200
    found_users = search_res.json()["users"]
    assert len(found_users) == 1
    assert found_users[0]["id"] == str(bob.id)

    # Alice sends Bob a friend request
    req_ab = await client.post(
        "/friends/requests",
        json={"friend_id": str(bob.id)},
        headers=headers_alice,
    )
    assert req_ab.status_code == 201
    friendship_ab_id = req_ab.json()["request"]["id"]

    # Bob verifies notification received
    bob_notif = await client.get("/notifications", headers=headers_bob)
    assert bob_notif.status_code == 200
    assert bob_notif.json()["unread_count"] >= 1
    assert any(n["event_type"] == "FRIEND_REQUEST_RECEIVED" for n in bob_notif.json()["notifications"])

    # Bob accepts Alice's friend request
    acc_ab = await client.post(
        f"/friends/requests/{friendship_ab_id}/accept",
        headers=headers_bob,
    )
    assert acc_ab.status_code == 200

    # Alice verifies notification that Bob accepted
    alice_notif = await client.get("/notifications", headers=headers_alice)
    assert alice_notif.status_code == 200
    assert any(n["event_type"] == "FRIEND_REQUEST_ACCEPTED" for n in alice_notif.json()["notifications"])

    # Establish friendships: Alice <-> Charlie, Bob <-> Charlie
    await make_friends(db_session, alice, charlie)
    await make_friends(db_session, bob, charlie)

    # ---------------------------------------------------------
    # STEP 3: Private Circle Creation & Membership
    # ---------------------------------------------------------
    create_group_res = await client.post(
        "/groups",
        json={
            "name": "Goa Trip E2E",
            "description": "Annual vacation shared ledger",
            "initial_member_ids": [str(bob.id), str(charlie.id)],
        },
        headers=headers_alice,
    )
    assert create_group_res.status_code == 201
    group_data = create_group_res.json()
    group_id = group_data["id"]
    assert group_data["my_role"] == "owner"
    assert len(group_data["members"]) == 3

    # Stranger tries to read circle details -> 403 Forbidden
    forbidden_res = await client.get(f"/groups/{group_id}", headers=headers_stranger)
    assert forbidden_res.status_code == 403

    # ---------------------------------------------------------
    # STEP 4: Expense Ledger Logging
    # ---------------------------------------------------------
    # Expense 1: Alice pays ₹900.00 for Villa, split equally among 3 members
    exp1_res = await client.post(
        f"/groups/{group_id}/expenses",
        json={
            "description": "Goa Villa Stay",
            "amount": "900.00",
            "split_type": "equal",
            "payers": [{"user_id": str(alice.id), "amount": "900.00"}],
            "participants": [
                {"user_id": str(alice.id)},
                {"user_id": str(bob.id)},
                {"user_id": str(charlie.id)},
            ],
        },
        headers=headers_alice,
    )
    assert exp1_res.status_code == 201

    # Check intermediate balances after Expense 1:
    # Alice: paid 900, owes 300 -> net +600.00
    # Bob: paid 0, owes 300 -> net -300.00
    # Charlie: paid 0, owes 300 -> net -300.00
    bal1_res = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal1_res.status_code == 200
    bal1_data = bal1_res.json()
    assert bal1_data["my_net_balance"] == "600.00"

    # Expense 2: Multi-payer Dinner for ₹600.00
    # Bob pays ₹400.00, Charlie pays ₹200.00
    # Exact split: Alice owes ₹300.00, Bob owes ₹150.00, Charlie owes ₹150.00
    exp2_res = await client.post(
        f"/groups/{group_id}/expenses",
        json={
            "description": "Beachfront Dinner",
            "amount": "600.00",
            "split_type": "exact",
            "payers": [
                {"user_id": str(bob.id), "amount": "400.00"},
                {"user_id": str(charlie.id), "amount": "200.00"},
            ],
            "participants": [
                {"user_id": str(alice.id), "amount": "300.00"},
                {"user_id": str(bob.id), "amount": "150.00"},
                {"user_id": str(charlie.id), "amount": "150.00"},
            ],
        },
        headers=headers_bob,
    )
    assert exp2_res.status_code == 201

    # ---------------------------------------------------------
    # STEP 5: Deterministic Balance & Conservation Check
    # ---------------------------------------------------------
    # Final net balances:
    # Alice: +600.00 - 300.00 = +300.00
    # Bob: -300.00 + 400.00 - 150.00 = -50.00
    # Charlie: -300.00 + 200.00 - 150.00 = -250.00
    # Net sum: +300 - 50 - 250 == 0.00
    bal2_res = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal2_res.status_code == 200
    balances = bal2_res.json()["balances"]

    net_map = {b["user"]["id"]: Decimal(b["net_balance"]) for b in balances}
    assert net_map[str(alice.id)] == Decimal("300.00")
    assert net_map[str(bob.id)] == Decimal("-50.00")
    assert net_map[str(charlie.id)] == Decimal("-250.00")
    assert sum(net_map.values()) == Decimal("0.00")

    # ---------------------------------------------------------
    # STEP 6: Settlement Plan Simplification (<= N-1 transfers)
    # ---------------------------------------------------------
    # Exactly 2 transfers required:
    # 1. Charlie -> Alice: ₹250.00
    # 2. Bob -> Alice: ₹50.00
    plan_res = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert plan_res.status_code == 200
    transfers = plan_res.json()["transfers"]
    assert len(transfers) == 2

    t_charlie = next(t for t in transfers if t["from_user"]["id"] == str(charlie.id))
    assert t_charlie["to_user"]["id"] == str(alice.id)
    assert Decimal(t_charlie["amount"]) == Decimal("250.00")

    t_bob = next(t for t in transfers if t["from_user"]["id"] == str(bob.id))
    assert t_bob["to_user"]["id"] == str(alice.id)
    assert Decimal(t_bob["amount"]) == Decimal("50.00")

    # ---------------------------------------------------------
    # STEP 7: Settlement Confirmation Workflow
    # ---------------------------------------------------------
    # 7A. Charlie pays Alice ₹250.00 off-platform and records the settlement request
    settle_c_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={
            "payee_id": str(alice.id),
            "amount": "250.00",
            "notes": "Paid via Google Pay",
        },
        headers=headers_charlie,
    )
    assert settle_c_res.status_code == 201
    settlement_c_id = settle_c_res.json()["id"]

    # Bob (bystander) tries to confirm Charlie's settlement -> 403 Forbidden
    bystander_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_c_id}/confirm",
        headers=headers_bob,
    )
    assert bystander_res.status_code == 403

    # Alice (payee) confirms Charlie's payment
    confirm_c_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_c_id}/confirm",
        headers=headers_alice,
    )
    assert confirm_c_res.status_code == 200
    assert confirm_c_res.json()["status"] == "confirmed"

    # Check intermediate balances after Charlie's settlement:
    # Charlie is now fully settled (0.00)
    # Alice is owed 50.00, Bob owes 50.00
    bal_after_c = await client.get(f"/groups/{group_id}/balances", headers=headers_charlie)
    assert bal_after_c.json()["my_net_balance"] == "0.00"

    # 7B. Bob settles his ₹50.00 with Alice
    settle_b_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={
            "payee_id": str(alice.id),
            "amount": "50.00",
            "notes": "Cash settlement at dinner",
        },
        headers=headers_bob,
    )
    assert settle_b_res.status_code == 201
    settlement_b_id = settle_b_res.json()["id"]

    # Alice confirms Bob's payment
    confirm_b_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_b_id}/confirm",
        headers=headers_alice,
    )
    assert confirm_b_res.status_code == 200
    assert confirm_b_res.json()["status"] == "confirmed"

    # ---------------------------------------------------------
    # STEP 8: Post-Settlement Ledger Reconciliation
    # ---------------------------------------------------------
    # All members in the circle are now settled to ₹0.00
    final_bal_res = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert final_bal_res.status_code == 200
    for b in final_bal_res.json()["balances"]:
        assert Decimal(b["net_balance"]) == Decimal("0.00")

    # Settlement plan is now empty (0 transfers)
    final_plan_res = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert final_plan_res.status_code == 200
    assert len(final_plan_res.json()["transfers"]) == 0

    # Cross-group balance summary for Alice is ₹0.00
    alice_summary_res = await client.get("/balances/summary", headers=headers_alice)
    assert alice_summary_res.status_code == 200
    summary_data = alice_summary_res.json()
    assert summary_data["overall_net_balance"] == "0.00"
    assert summary_data["total_owed_to_me"] == "0.00"
    assert summary_data["total_i_owe"] == "0.00"

    # ---------------------------------------------------------
    # STEP 9: Immutable Activity Timeline
    # ---------------------------------------------------------
    activity_res = await client.get(f"/groups/{group_id}/activity", headers=headers_alice)
    assert activity_res.status_code == 200
    events = activity_res.json()
    actions = [e["action"] for e in events]
    assert "group_created" in actions
    assert "expense_created" in actions
    assert "SETTLEMENT_REQUESTED" in actions
    assert "SETTLEMENT_CONFIRMED" in actions

    # ---------------------------------------------------------
    # STEP 10: Notification Center & Read State
    # ---------------------------------------------------------
    unread_res = await client.get("/notifications/unread-count", headers=headers_alice)
    assert unread_res.status_code == 200
    assert unread_res.json()["unread_count"] > 0

    mark_all_res = await client.post("/notifications/read-all", headers=headers_alice)
    assert mark_all_res.status_code == 200

    unread_after = await client.get("/notifications/unread-count", headers=headers_alice)
    assert unread_after.json()["unread_count"] == 0
