import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token
from models.user import User
from utils.generate_pocket_id import generate_unique_pocket_id


@pytest.mark.asyncio
async def test_search_users_and_friend_request_flow(client: AsyncClient, db_session: AsyncSession):
    # Create two test users
    user_a = User(
        id=uuid.uuid4(),
        google_sub=f"sub_a_{uuid.uuid4().hex[:8]}",
        email=f"user_a_{uuid.uuid4().hex[:8]}@example.com",
        name="Alice Tester",
        username=f"alice_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db_session),
    )
    user_b = User(
        id=uuid.uuid4(),
        google_sub=f"sub_b_{uuid.uuid4().hex[:8]}",
        email=f"user_b_{uuid.uuid4().hex[:8]}@example.com",
        name="Bob Tester",
        username=f"bob_{uuid.uuid4().hex[:6]}",
        pocket_id=await generate_unique_pocket_id(db_session),
    )
    db_session.add_all([user_a, user_b])
    await db_session.flush()

    token_a = create_access_token({"sub": str(user_a.id)})
    headers_a = {
        "Origin": "http://localhost:5173",
        "Cookie": f"access_token={token_a}",
    }

    # 1. Search for Bob by username
    search_resp = await client.get(f"/users/search?q={user_b.username}", headers=headers_a)
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert len(search_data["users"]) == 1
    assert search_data["users"][0]["id"] == str(user_b.id)

    # 2. Prevent self friend request
    self_req = await client.post(
        "/friends/requests",
        headers=headers_a,
        json={"friend_id": str(user_a.id)},
    )
    assert self_req.status_code == 422

    # 3. Send friend request to Bob
    req_resp = await client.post(
        "/friends/requests",
        headers=headers_a,
        json={"friend_id": str(user_b.id)},
    )
    assert req_resp.status_code == 201
    friendship_id = req_resp.json()["request"]["id"]

    # 4. Prevent duplicate friend request
    dup_resp = await client.post(
        "/friends/requests",
        headers=headers_a,
        json={"friend_id": str(user_b.id)},
    )
    assert dup_resp.status_code == 409

    # 5. Bob logs in, checks incoming requests, and accepts
    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {
        "Origin": "http://localhost:5173",
        "Cookie": f"access_token={token_b}",
    }
    incoming_resp = await client.get("/friends/requests", headers=headers_b)
    assert incoming_resp.status_code == 200
    incoming_data = incoming_resp.json()
    assert len(incoming_data["incoming"]) >= 1

    accept_resp = await client.post(
        f"/friends/requests/{friendship_id}/accept",
        headers=headers_b,
    )
    assert accept_resp.status_code == 200

    # 6. Both users see each other in their friends list
    friends_a = await client.get("/friends", headers=headers_a)
    assert friends_a.status_code == 200
    assert any(f["id"] == str(user_b.id) for f in friends_a.json()["friends"])

    friends_b = await client.get("/friends", headers=headers_b)
    assert friends_b.status_code == 200
    assert any(f["id"] == str(user_a.id) for f in friends_b.json()["friends"])
