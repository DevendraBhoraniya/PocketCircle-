from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_groups import create_test_user, make_friends


@pytest.mark.asyncio
async def test_expense_splits_multipayer_and_audit(client: AsyncClient, db_session: AsyncSession):
    # Setup 3 users
    alice, headers_alice = await create_test_user(db_session, "Alice User")
    bob, headers_bob = await create_test_user(db_session, "Bob User")
    charlie, headers_charlie = await create_test_user(db_session, "Charlie User")
    outsider, headers_outsider = await create_test_user(db_session, "Outsider User")

    await make_friends(db_session, alice, bob)
    await make_friends(db_session, alice, charlie)

    # 1. Create a group with Alice, Bob, Charlie
    group_resp = await client.post(
        "/groups",
        headers=headers_alice,
        json={
            "name": "Flatmates",
            "initial_member_ids": [str(bob.id), str(charlie.id)],
        },
    )
    assert group_resp.status_code == 201
    group_id = group_resp.json()["id"]

    # 2. Equal split among 3 people for 100.00 (tests 1 paisa remainder allocation)
    exp1_resp = await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_alice,
        json={
            "description": "Groceries",
            "amount": "100.00",
            "split_type": "equal",
            # payers omitted -> Alice pays 100.00
            # participants omitted -> all 3 members included
        },
    )
    assert exp1_resp.status_code == 201
    exp1_data = exp1_resp.json()
    assert Decimal(str(exp1_data["amount"])) == Decimal("100.00")
    assert len(exp1_data["payers"]) == 1
    assert exp1_data["payers"][0]["user"]["id"] == str(alice.id)
    assert Decimal(str(exp1_data["payers"][0]["amount"])) == Decimal("100.00")

    # Verify participants sum equals exactly 100.00 and amounts are 33.34, 33.33, 33.33
    participants = exp1_data["participants"]
    assert len(participants) == 3
    part_amounts = sorted([Decimal(str(p["amount"])) for p in participants])
    assert part_amounts == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert sum(part_amounts) == Decimal("100.00")

    # 3. Multi-payer exact split
    exp2_resp = await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_bob,
        json={
            "description": "Weekend Dinner",
            "amount": "250.00",
            "split_type": "exact",
            "payers": [
                {"user_id": str(alice.id), "amount": "100.00"},
                {"user_id": str(bob.id), "amount": "150.00"},
            ],
            "participants": [
                {"user_id": str(alice.id), "amount": "80.00"},
                {"user_id": str(bob.id), "amount": "100.00"},
                {"user_id": str(charlie.id), "amount": "70.00"},
            ],
        },
    )
    assert exp2_resp.status_code == 201
    exp2_data = exp2_resp.json()
    assert exp2_data["description"] == "Weekend Dinner"
    assert Decimal(str(exp2_data["amount"])) == Decimal("250.00")
    assert len(exp2_data["payers"]) == 2
    assert len(exp2_data["participants"]) == 3

    # 4. Multi-payer sum mismatch fails with 422
    exp_fail_payers = await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_alice,
        json={
            "description": "Invalid Payers",
            "amount": "100.00",
            "split_type": "equal",
            "payers": [
                {"user_id": str(alice.id), "amount": "60.00"},
                {"user_id": str(bob.id), "amount": "30.00"},  # 90 != 100
            ],
        },
    )
    assert exp_fail_payers.status_code == 422
    assert "Sum of payers" in exp_fail_payers.json()["detail"]

    # 5. Non-member payer fails with 422
    exp_fail_outsider = await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_alice,
        json={
            "description": "Outsider",
            "amount": "100.00",
            "split_type": "equal",
            "payers": [
                {"user_id": str(outsider.id), "amount": "100.00"},
            ],
        },
    )
    assert exp_fail_outsider.status_code == 422

    # 6. List expenses for group
    list_resp = await client.get(f"/groups/{group_id}/expenses", headers=headers_charlie)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 2

    # 7. Edit expense
    exp2_id = exp2_data["id"]
    edit_resp = await client.patch(
        f"/groups/{group_id}/expenses/{exp2_id}",
        headers=headers_bob,
        json={
            "description": "Fancy Weekend Dinner",
        },
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["description"] == "Fancy Weekend Dinner"

    # 8. Delete expense (soft delete)
    del_resp = await client.delete(
        f"/groups/{group_id}/expenses/{exp2_id}",
        headers=headers_bob,
    )
    assert del_resp.status_code == 200

    # Verify deleted expense is no longer listed
    list_after_del = await client.get(f"/groups/{group_id}/expenses", headers=headers_alice)
    assert len(list_after_del.json()) == 1

    # 9. Check Activity timeline
    activity_resp = await client.get(f"/groups/{group_id}/activity", headers=headers_alice)
    assert activity_resp.status_code == 200
    events = activity_resp.json()
    actions = [e["action"] for e in events]
    assert "expense_deleted" in actions
    assert "expense_updated" in actions
    assert "expense_created" in actions
    assert "group_created" in actions
