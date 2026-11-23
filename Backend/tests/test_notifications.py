import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.test_groups import create_test_user, make_friends


@pytest.mark.asyncio
async def test_notifications_full_lifecycle(
    client: AsyncClient,
    db_session: AsyncSession,
):
    # 1. Setup users
    alice, headers_alice = await create_test_user(db_session, "Alice Notif")
    bob, headers_bob = await create_test_user(db_session, "Bob Notif")

    # Initially Bob has 0 notifications
    res_b = await client.get("/notifications", headers=headers_bob)
    assert res_b.status_code == 200
    assert res_b.json()["unread_count"] == 0
    assert len(res_b.json()["notifications"]) == 0

    # 2. Alice sends Bob a friend request -> triggers FRIEND_REQUEST_RECEIVED
    req_res = await client.post(
        "/friends/requests",
        json={"friend_id": str(bob.id)},
        headers=headers_alice,
    )
    assert req_res.status_code == 201
    friendship_id = req_res.json()["request"]["id"]

    # Bob should now have 1 unread notification
    unread_res = await client.get("/notifications/unread-count", headers=headers_bob)
    assert unread_res.status_code == 200
    assert unread_res.json()["unread_count"] == 1

    list_res = await client.get("/notifications", headers=headers_bob)
    assert list_res.status_code == 200
    bob_notifs = list_res.json()["notifications"]
    assert len(bob_notifs) == 1
    assert bob_notifs[0]["event_type"] == "FRIEND_REQUEST_RECEIVED"
    assert "Alice Notif" in bob_notifs[0]["payload"]
    assert bob_notifs[0]["is_read"] is False

    # 3. Bob accepts the friend request -> triggers FRIEND_REQUEST_ACCEPTED for Alice
    accept_res = await client.post(
        f"/friends/requests/{friendship_id}/accept",
        headers=headers_bob,
    )
    assert accept_res.status_code == 200

    list_alice = await client.get("/notifications", headers=headers_alice)
    assert list_alice.status_code == 200
    alice_notifs = list_alice.json()["notifications"]
    assert len(alice_notifs) == 1
    assert alice_notifs[0]["event_type"] == "FRIEND_REQUEST_ACCEPTED"
    assert "Bob Notif" in alice_notifs[0]["payload"]

    # 4. Alice creates a group with Bob -> triggers GROUP_MEMBER_ADDED for Bob
    grp_res = await client.post(
        "/groups",
        json={"name": "Camping Trip", "initial_member_ids": [str(bob.id)]},
        headers=headers_alice,
    )
    assert grp_res.status_code == 201
    group_id = grp_res.json()["id"]

    list_b2 = await client.get("/notifications", headers=headers_bob)
    assert list_b2.status_code == 200
    assert list_b2.json()["unread_count"] == 2
    types = [n["event_type"] for n in list_b2.json()["notifications"]]
    assert "GROUP_MEMBER_ADDED" in types

    # 5. Alice adds an expense -> triggers EXPENSE_CREATED for Bob
    exp_res = await client.post(
        f"/groups/{group_id}/expenses",
        json={
            "description": "Tents and Gear",
            "amount": "150.00",
            "split_type": "equal",
            "payers": [{"user_id": str(alice.id), "amount": "150.00"}],
            "participants": [{"user_id": str(alice.id)}, {"user_id": str(bob.id)}],
        },
        headers=headers_alice,
    )
    assert exp_res.status_code == 201

    list_b3 = await client.get("/notifications", headers=headers_bob)
    assert list_b3.status_code == 200
    assert list_b3.json()["unread_count"] == 3
    assert list_b3.json()["notifications"][0]["event_type"] == "EXPENSE_CREATED"
    assert "Tents and Gear" in list_b3.json()["notifications"][0]["payload"]

    # 6. Bob settles up with Alice -> triggers SETTLEMENT_REQUESTED for Alice
    settle_res = await client.post(
        f"/groups/{group_id}/settlements",
        json={
            "payee_id": str(alice.id),
            "amount": "75.00",
            "notes": "UPI to your mobile",
        },
        headers=headers_bob,
    )
    assert settle_res.status_code == 201
    settlement_id = settle_res.json()["id"]

    list_a2 = await client.get("/notifications", headers=headers_alice)
    assert list_a2.status_code == 200
    assert list_a2.json()["notifications"][0]["event_type"] == "SETTLEMENT_REQUESTED"
    assert "Bob Notif" in list_a2.json()["notifications"][0]["payload"]

    # 7. Alice confirms the settlement -> triggers SETTLEMENT_CONFIRMED for Bob
    conf_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_id}/confirm",
        headers=headers_alice,
    )
    assert conf_res.status_code == 200

    list_b4 = await client.get("/notifications", headers=headers_bob)
    assert list_b4.status_code == 200
    assert list_b4.json()["notifications"][0]["event_type"] == "SETTLEMENT_CONFIRMED"

    # 8. Test Mark Single As Read
    target_notif = list_b4.json()["notifications"][0]
    notif_id = target_notif["id"]

    # Alice cannot mark Bob's notification as read (returns 404)
    forbidden_res = await client.post(
        f"/notifications/{notif_id}/read",
        headers=headers_alice,
    )
    assert forbidden_res.status_code == 404

    # Bob marks his own notification as read
    read_res = await client.post(
        f"/notifications/{notif_id}/read",
        headers=headers_bob,
    )
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 9. Test Mark All As Read
    mark_all_res = await client.post(
        "/notifications/read-all",
        headers=headers_bob,
    )
    assert mark_all_res.status_code == 200
    assert mark_all_res.json()["updated_count"] >= 1

    # Bob's unread count should now be 0
    final_unread = await client.get("/notifications/unread-count", headers=headers_bob)
    assert final_unread.status_code == 200
    assert final_unread.json()["unread_count"] == 0
