from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from services.balance_engine import simplify_debts
from tests.test_groups import create_test_user, make_friends


def test_simplify_debts_cyclic_cancellation():
    u1, u2, u3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    # If A owes B 100, B owes C 100, C owes A 100 -> All net balances are 0
    net_balances = {
        u1: Decimal("0.00"),
        u2: Decimal("0.00"),
        u3: Decimal("0.00"),
    }
    transfers = simplify_debts(net_balances)
    assert len(transfers) == 0


def test_simplify_debts_transitive_reduction():
    # A is owed 60, B is 0, C owes 60 -> C pays A 60 (1 transaction)
    u_a, u_b, u_c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    net_balances = {
        u_a: Decimal("60.00"),
        u_b: Decimal("0.00"),
        u_c: Decimal("-60.00"),
    }
    transfers = simplify_debts(net_balances)
    assert len(transfers) == 1
    assert transfers[0].from_user_id == u_c
    assert transfers[0].to_user_id == u_a
    assert transfers[0].amount == Decimal("60.00")


def test_simplify_debts_complex_four_members():
    u1, u2, u3, u4 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    # Net: u1: +100, u2: +50, u3: -80, u4: -70 (Sum = 0)
    net_balances = {
        u1: Decimal("100.00"),
        u2: Decimal("50.00"),
        u3: Decimal("-80.00"),
        u4: Decimal("-70.00"),
    }
    transfers = simplify_debts(net_balances)
    # Total transferred must equal sum of positive balances = 150.00
    total_transferred = sum(t.amount for t in transfers)
    assert total_transferred == Decimal("150.00")
    # Number of transactions must be <= N - 1 = 3
    assert len(transfers) <= 3


@pytest.mark.asyncio
async def test_group_balances_and_settlement_plan_api(client: AsyncClient, db_session: AsyncSession):
    # Setup users
    alice, headers_alice = await create_test_user(db_session, "Alice Creditor")
    bob, headers_bob = await create_test_user(db_session, "Bob Neutral")
    charlie, headers_charlie = await create_test_user(db_session, "Charlie Debtor")
    outsider, headers_outsider = await create_test_user(db_session, "Outsider Sam")

    await make_friends(db_session, alice, bob)
    await make_friends(db_session, alice, charlie)

    # 1. Create group with Alice, Bob, Charlie
    group_resp = await client.post(
        "/groups",
        headers=headers_alice,
        json={
            "name": "Weekend Getaway",
            "initial_member_ids": [str(bob.id), str(charlie.id)],
        },
    )
    assert group_resp.status_code == 201
    group_id = group_resp.json()["id"]

    # 2. Non-member gets 403 on balances
    resp_out = await client.get(f"/groups/{group_id}/balances", headers=headers_outsider)
    assert resp_out.status_code == 403

    # 3. Initially, balances are all 0
    init_bal = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert init_bal.status_code == 200
    init_data = init_bal.json()
    assert Decimal(str(init_data["total_group_spending"])) == Decimal("0.00")
    assert Decimal(str(init_data["my_net_balance"])) == Decimal("0.00")
    for b in init_data["balances"]:
        assert Decimal(str(b["net_balance"])) == Decimal("0.00")
        assert b["status"] == "settled"

    # 4. Expense 1: Alice pays 90.00 equal split for Alice, Bob, Charlie (each owes 30.00)
    await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_alice,
        json={
            "description": "Hotel Room",
            "amount": "90.00",
            "split_type": "equal",
        },
    )

    # Check Balances
    bal1_resp = await client.get(f"/groups/{group_id}/balances", headers=headers_alice)
    assert bal1_resp.status_code == 200
    bal1_data = bal1_resp.json()
    assert Decimal(str(bal1_data["total_group_spending"])) == Decimal("90.00")
    assert Decimal(str(bal1_data["my_net_balance"])) == Decimal("60.00")

    alice_bal = next(b for b in bal1_data["balances"] if b["user"]["id"] == str(alice.id))
    bob_bal = next(b for b in bal1_data["balances"] if b["user"]["id"] == str(bob.id))
    charlie_bal = next(b for b in bal1_data["balances"] if b["user"]["id"] == str(charlie.id))

    assert Decimal(str(alice_bal["net_balance"])) == Decimal("60.00")
    assert alice_bal["status"] == "owed"
    assert Decimal(str(bob_bal["net_balance"])) == Decimal("-30.00")
    assert bob_bal["status"] == "owes"
    assert Decimal(str(charlie_bal["net_balance"])) == Decimal("-30.00")
    assert charlie_bal["status"] == "owes"

    # 5. Settlement plan before second expense: Bob pays Alice 30, Charlie pays Alice 30
    plan1_resp = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert plan1_resp.status_code == 200
    plan1 = plan1_resp.json()
    assert len(plan1["transfers"]) == 2
    assert Decimal(str(plan1["total_settlement_amount"])) == Decimal("60.00")

    # 6. Expense 2: Bob pays 60.00 equal split for Bob and Charlie (each owes 30.00)
    await client.post(
        f"/groups/{group_id}/expenses",
        headers=headers_bob,
        json={
            "description": "Rental Car",
            "amount": "60.00",
            "split_type": "equal",
            "participants": [
                {"user_id": str(bob.id)},
                {"user_id": str(charlie.id)},
            ],
        },
    )

    # Check Balances:
    # Alice: +60.00
    # Bob: paid 60, owed 30 + 30 = 60 -> net 0.00 (Settled!)
    # Charlie: paid 0, owed 30 + 30 = 60 -> net -60.00
    bal2_resp = await client.get(f"/groups/{group_id}/balances", headers=headers_bob)
    bal2_data = bal2_resp.json()
    assert Decimal(str(bal2_data["total_group_spending"])) == Decimal("150.00")
    bob_bal2 = next(b for b in bal2_data["balances"] if b["user"]["id"] == str(bob.id))
    charlie_bal2 = next(b for b in bal2_data["balances"] if b["user"]["id"] == str(charlie.id))
    assert Decimal(str(bob_bal2["net_balance"])) == Decimal("0.00")
    assert bob_bal2["status"] == "settled"
    assert Decimal(str(charlie_bal2["net_balance"])) == Decimal("-60.00")

    # 7. Settlement Simplification verification:
    # Instead of Charlie paying Bob 30 and Bob paying Alice 30, Bob is bypassed:
    # Charlie pays Alice 60 directly! (1 transaction)
    plan2_resp = await client.get(f"/groups/{group_id}/settlement-plan", headers=headers_alice)
    assert plan2_resp.status_code == 200
    plan2 = plan2_resp.json()
    assert len(plan2["transfers"]) == 1
    transfer = plan2["transfers"][0]
    assert transfer["from_user"]["id"] == str(charlie.id)
    assert transfer["to_user"]["id"] == str(alice.id)
    assert Decimal(str(transfer["amount"])) == Decimal("60.00")

    # 8. Cross-group summary endpoint
    summary_resp = await client.get("/balances/summary", headers=headers_alice)
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert Decimal(str(summary["overall_net_balance"])) == Decimal("60.00")
    assert Decimal(str(summary["total_owed_to_me"])) == Decimal("60.00")
    assert Decimal(str(summary["total_i_owe"])) == Decimal("0.00")
    assert len(summary["groups"]) >= 1
    assert len(summary["recent_activity"]) >= 2
