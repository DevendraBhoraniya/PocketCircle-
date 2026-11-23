from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_groups import create_test_user, make_friends


@pytest.mark.asyncio
async def test_settlement_lifecycle_and_balance_reconciliation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # Setup users: Alice (payer/creator), Bob (friend)
    alice, headers_alice = await create_test_user(db_session, "Alice Settlement")
    bob, headers_bob = await create_test_user(db_session, "Bob Settlement")
    await make_friends(db_session, alice, bob)

    # 1. Alice creates a group with Bob
    grp_res = await client.post(
        "/groups",
        json={"name": "Goa Trip Settlements", "initial_member_ids": [str(bob.id)]},
        headers=headers_alice,
    )
    assert grp_res.status_code == 201
    group_id = grp_res.json()["id"]

    # 2. Bob creates an expense of ₹200 split equally (₹100 each).
    # Bob pays ₹200, Alice owes ₹100.
    # Alice net: -100.00 (owes), Bob net: +100.00 (owed).
    exp_res = await client.post(
        f"/groups/{group_id}/expenses",
        json={
            "description": "Hotel Stay",
            "amount": "200.00",
            "split_type": "equal",
            "payers": [{"user_id": str(bob.id), "amount": "200.00"}],
            "participants": [{"user_id": str(alice.id)}, {"user_id": str(bob.id)}],
        },
        headers=headers_bob,
    )
    assert exp_res.status_code == 201

    # Check initial balances
    bal_res = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal_res.status_code == 200
    bal_data = bal_res.json()
    assert bal_data["my_net_balance"] == "-100.00"

    # Check initial settlement plan: Alice -> Bob ₹100.00
    plan_res = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert plan_res.status_code == 200
    plan_data = plan_res.json()
    assert len(plan_data["transfers"]) == 1
    assert plan_data["transfers"][0]["from_user"]["id"] == str(alice.id)
    assert plan_data["transfers"][0]["to_user"]["id"] == str(bob.id)
    assert plan_data["transfers"][0]["amount"] == "100.00"

    # 3. Validation: Alice cannot settle with herself
    self_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={"payee_id": str(alice.id), "amount": "100.00"},
        headers=headers_alice,
    )
    assert self_res.status_code == 400
    assert "with yourself" in self_res.json()["detail"]

    # 4. Validation: non-member payee rejected
    random_user_id = str(uuid.uuid4())
    non_mem_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={"payee_id": random_user_id, "amount": "100.00"},
        headers=headers_alice,
    )
    assert non_mem_res.status_code == 400

    # 5. Alice requests settlement with Bob: ₹100.00
    settle_req_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={
            "payee_id": str(bob.id),
            "amount": "100.00",
            "notes": "Paid via GPay UPI",
        },
        headers=headers_alice,
    )
    assert settle_req_res.status_code == 201
    settlement = settle_req_res.json()
    settlement_id = settlement["id"]
    assert settlement["status"] == "pending"
    assert settlement["amount"] == "100.00"
    assert settlement["notes"] == "Paid via GPay UPI"
    assert settlement["payer"]["id"] == str(alice.id)
    assert settlement["payee"]["id"] == str(bob.id)

    # 6. Balances do NOT change while settlement is pending
    bal_pending = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal_pending.json()["my_net_balance"] == "-100.00"

    # 7. Authorization: Alice (the payer) CANNOT confirm her own settlement!
    alice_confirm_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_id}/confirm",
        headers=headers_alice,
    )
    assert alice_confirm_res.status_code == 403
    assert "Only the payee" in alice_confirm_res.json()["detail"]

    # 8. Test rejection workflow: Bob rejects the settlement request first
    bob_reject_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_id}/reject",
        headers=headers_bob,
    )
    assert bob_reject_res.status_code == 200
    assert bob_reject_res.json()["status"] == "rejected"

    # Cannot confirm a rejected settlement
    bob_confirm_rejected = await client.post(
        f"/groups/{group_id}/settlements/{settlement_id}/confirm",
        headers=headers_bob,
    )
    assert bob_confirm_rejected.status_code == 400

    # 9. Alice creates a new settlement request to test cancellation
    settle_cancel_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={"payee_id": str(bob.id), "amount": "50.00"},
        headers=headers_alice,
    )
    assert settle_cancel_res.status_code == 201
    cancel_id = settle_cancel_res.json()["id"]

    # Alice cancels it
    alice_cancel = await client.post(
        f"/groups/{group_id}/settlements/{cancel_id}/cancel",
        headers=headers_alice,
    )
    assert alice_cancel.status_code == 200
    assert alice_cancel.json()["status"] == "cancelled"

    # 10. Alice creates the final settlement of ₹100.00 and Bob confirms it
    final_settle_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={
            "payee_id": str(bob.id),
            "amount": "100.00",
            "notes": "Real UPI ref 123456",
        },
        headers=headers_alice,
    )
    assert final_settle_res.status_code == 201
    final_settle_id = final_settle_res.json()["id"]

    # Bob confirms receipt
    bob_confirm = await client.post(
        f"/groups/{group_id}/settlements/{final_settle_id}/confirm",
        headers=headers_bob,
    )
    assert bob_confirm.status_code == 200
    assert bob_confirm.json()["status"] == "confirmed"
    assert bob_confirm.json()["action_by"]["id"] == str(bob.id)

    # Bob attempts to double-confirm -> returns 409 Conflict without duplicate audit
    bob_double_confirm = await client.post(
        f"/groups/{group_id}/settlements/{final_settle_id}/confirm",
        headers=headers_bob,
    )
    assert bob_double_confirm.status_code == 409
    assert "already confirmed" in bob_double_confirm.json()["detail"]

    # 11. Balances update immediately! Both Alice and Bob should now be ₹0.00 (settled)
    bal_after = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal_after.status_code == 200
    after_data = bal_after.json()
    assert after_data["my_net_balance"] == "0.00"
    for b in after_data["balances"]:
        assert b["net_balance"] == "0.00"
        assert b["status"] == "settled"

    # Settlement plan should now be empty (0 transfers needed)
    plan_after = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert len(plan_after.json()["transfers"]) == 0

    # 12. Cross-group summary should reflect 0.00 net balance
    summary_res = await client.get("/balances/summary", headers=headers_alice)
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert summary_data["overall_net_balance"] == "0.00"
    assert summary_data["total_i_owe"] == "0.00"
    assert summary_data["total_owed_to_me"] == "0.00"

    # 13. Audit events verify full trail
    audit_res = await client.get(f"/groups/{group_id}/activity", headers=headers_alice)
    assert audit_res.status_code == 200
    actions = [ev["action"] for ev in audit_res.json()]
    assert "SETTLEMENT_REQUESTED" in actions
    assert "SETTLEMENT_CONFIRMED" in actions
    assert actions.count("SETTLEMENT_CONFIRMED") == 1
    assert "SETTLEMENT_REJECTED" in actions
    assert "SETTLEMENT_CANCELLED" in actions

    # 14. List group settlements endpoint verifies list
    settlements_list_res = await client.get(
        f"/groups/{group_id}/settlements",
        headers=headers_alice,
    )
    assert settlements_list_res.status_code == 200
    s_list = settlements_list_res.json()["settlements"]
    assert len(s_list) == 3  # rejected, cancelled, confirmed
