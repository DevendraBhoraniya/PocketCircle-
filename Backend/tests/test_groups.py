import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token
from models.friendship import Friendship
from models.user import User
from utils.generate_pocket_id import generate_unique_pocket_id


async def create_test_user(db: AsyncSession, name: str) -> tuple[User, dict[str, str]]:
    u = User(
        id=uuid.uuid4(),
        google_sub=f"sub_{uuid.uuid4().hex[:8]}",
        email=f"user_{uuid.uuid4().hex[:8]}@example.com",
        name=name,
        username=f"user_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db),
    )
    db.add(u)
    await db.flush()
    token = create_access_token({"sub": str(u.id)})
    headers = {
        "Origin": "http://localhost:5173",
        "Cookie": f"access_token={token}",
    }
    return u, headers


async def make_friends(db: AsyncSession, user_a: User, user_b: User):
    f = Friendship(
        id=uuid.uuid4(),
        user_id=user_a.id,
        friend_id=user_b.id,
        status="accepted",
    )
    db.add(f)
    await db.flush()


@pytest.mark.asyncio
async def test_group_lifecycle_roles_and_access(client: AsyncClient, db_session: AsyncSession):
    # Setup users
    alice, headers_alice = await create_test_user(db_session, "Alice Owner")
    bob, headers_bob = await create_test_user(db_session, "Bob Admin")
    charlie, headers_charlie = await create_test_user(db_session, "Charlie Member")
    stranger, headers_stranger = await create_test_user(db_session, "Sam Stranger")

    # Alice is friends with Bob and Charlie; stranger is not
    await make_friends(db_session, alice, bob)
    await make_friends(db_session, alice, charlie)

    # 1. Non-friend in initial_member_ids fails with 422
    resp_fail = await client.post(
        "/groups",
        headers=headers_alice,
        json={
            "name": "Trip to Goa",
            "description": "Vacation circle",
            "initial_member_ids": [str(stranger.id)],
        },
    )
    assert resp_fail.status_code == 422
    assert "not your accepted friend" in resp_fail.json()["detail"]

    # 2. Create group with accepted friend Bob
    resp = await client.post(
        "/groups",
        headers=headers_alice,
        json={
            "name": "Trip to Goa",
            "description": "Vacation circle",
            "initial_member_ids": [str(bob.id)],
        },
    )
    assert resp.status_code == 201
    group_data = resp.json()
    group_id = group_data["id"]
    assert group_data["name"] == "Trip to Goa"
    assert group_data["owner_id"] == str(alice.id)
    assert group_data["my_role"] == "owner"
    assert len(group_data["members"]) == 2

    # 3. Private group access isolation: Stranger gets 403
    resp_stranger = await client.get(f"/groups/{group_id}", headers=headers_stranger)
    assert resp_stranger.status_code == 403

    # 4. Bob (regular member) cannot add members yet
    resp_bob_add = await client.post(
        f"/groups/{group_id}/members",
        headers=headers_bob,
        json={"user_id": str(charlie.id)},
    )
    assert resp_bob_add.status_code == 403

    # 5. Alice promotes Bob to admin
    resp_promo = await client.patch(
        f"/groups/{group_id}/members/{bob.id}/role",
        headers=headers_alice,
        json={"role": "admin"},
    )
    assert resp_promo.status_code == 200
    bob_mem = next(m for m in resp_promo.json()["members"] if m["user"]["id"] == str(bob.id))
    assert bob_mem["role"] == "admin"

    # 6. Alice adds Charlie (friend) to group
    resp_add_c = await client.post(
        f"/groups/{group_id}/members",
        headers=headers_alice,
        json={"user_id": str(charlie.id)},
    )
    assert resp_add_c.status_code == 201
    assert len(resp_add_c.json()["members"]) == 3

    # 7. Bob (now admin) tries to remove Alice (owner) -> forbidden 403
    resp_rem_owner = await client.delete(
        f"/groups/{group_id}/members/{alice.id}",
        headers=headers_bob,
    )
    assert resp_rem_owner.status_code == 403

    # 8. Bob (admin) removes Charlie (member) -> succeeds
    resp_rem_c = await client.delete(
        f"/groups/{group_id}/members/{charlie.id}",
        headers=headers_bob,
    )
    assert resp_rem_c.status_code == 200
    assert len(resp_rem_c.json()["members"]) == 2

    # 9. Charlie can no longer access group
    resp_c_access = await client.get(f"/groups/{group_id}", headers=headers_charlie)
    assert resp_c_access.status_code == 403

    # 10. Alice transfers ownership to Bob
    resp_trans = await client.post(
        f"/groups/{group_id}/transfer-ownership",
        headers=headers_alice,
        json={"new_owner_id": str(bob.id)},
    )
    assert resp_trans.status_code == 200
    assert resp_trans.json()["owner_id"] == str(bob.id)
    assert resp_trans.json()["my_role"] == "admin"  # Alice is now admin

    # 11. Alice can now leave group
    resp_leave = await client.post(f"/groups/{group_id}/leave", headers=headers_alice)
    assert resp_leave.status_code == 200

    # 12. Bob is now the sole owner and can delete the group
    resp_del = await client.delete(f"/groups/{group_id}", headers=headers_bob)
    assert resp_del.status_code == 200

    # Group is now deleted (404)
    resp_get_del = await client.get(f"/groups/{group_id}", headers=headers_bob)
    assert resp_get_del.status_code == 404
