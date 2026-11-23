import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from core.security import hash_password, create_access_token
from models.user import User
from models.group import Group, GroupMember
from services.email_service import (
    EmailService,
    ConsoleEmailAdapter,
    EmailDeliveryResult,
)


@pytest.mark.asyncio
async def test_login_timing_defense_nonexistent_user(client: AsyncClient):
    """
    Ensures that logging in with an email that does NOT exist returns 401
    and executes the constant-time dummy PBKDF2 hash path without revealing
    absence of account.
    """
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent_target_user@pocketcircle.internal", "password": "RandomPassword123!"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_resend_otp_account_enumeration_defense(client: AsyncClient):
    """
    Ensures that /auth/resend-otp for an email not present in the database returns
    a generic 200 response rather than leaking 404 User Not Found.
    """
    resp = await client.post(
        "/api/v1/auth/resend-otp",
        json={"email": "unregistered_account_probe@pocketcircle.internal"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "If an account is associated with this email" in body["message"]
    assert body["dev_otp"] is None


@pytest.mark.asyncio
async def test_group_visibility_private_by_default(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies that new groups default to visibility = 'private'.
    """
    owner = User(
        id=uuid.uuid4(),
        email="group_owner_test@pocketcircle.internal",
        name="Owner Test",
        username=f"owner_{uuid.uuid4().hex[:6]}",
        pocket_id=str(uuid.uuid4().int % 9000000000 + 1000000000),
        password_hash=hash_password("Pass12345!"),
        is_email_verified=True,
    )
    db_session.add(owner)
    await db_session.commit()

    token = create_access_token(data={"sub": str(owner.id)})
    headers = {"Origin": "http://localhost:5173"}
    resp = await client.post(
        "/api/v1/groups",
        json={"name": "Confidential Circle", "description": "Private finances"},
        cookies={"access_token": token},
        headers=headers,
    )
    assert resp.status_code == 201
    group_data = resp.json()
    assert group_data["visibility"] == "private"


@pytest.mark.asyncio
async def test_youtube_visibility_access_boundaries(client: AsyncClient, db_session: AsyncSession):
    """
    YouTube-style visibility tests:
    - Private group: Non-members receive 403 Forbidden
    - Unlisted group: Non-members can view group meta via direct ID link, but my_role is None
    - Unlisted group financial overview (/overview): Non-members receive 403 Forbidden
    - Public group: Appears in /groups/public discovery
    - Only owner can modify visibility: Admin attempt receives 403 Forbidden
    """
    # 1. Create owner and non-member
    owner = User(
        id=uuid.uuid4(),
        email="owner_yt@pocketcircle.internal",
        name="Circle Creator",
        username=f"creator_{uuid.uuid4().hex[:6]}",
        pocket_id=str(uuid.uuid4().int % 9000000000 + 1000000000),
        password_hash=hash_password("Pass12345!"),
        is_email_verified=True,
    )
    member_admin = User(
        id=uuid.uuid4(),
        email="admin_yt@pocketcircle.internal",
        name="Circle Admin",
        username=f"admin_{uuid.uuid4().hex[:6]}",
        pocket_id=str(uuid.uuid4().int % 9000000000 + 1000000000),
        password_hash=hash_password("Pass12345!"),
        is_email_verified=True,
    )
    stranger = User(
        id=uuid.uuid4(),
        email="stranger_yt@pocketcircle.internal",
        name="External Stranger",
        username=f"stranger_{uuid.uuid4().hex[:6]}",
        pocket_id=str(uuid.uuid4().int % 9000000000 + 1000000000),
        password_hash=hash_password("Pass12345!"),
        is_email_verified=True,
    )
    db_session.add_all([owner, member_admin, stranger])
    await db_session.commit()

    owner_token = create_access_token(data={"sub": str(owner.id)})
    admin_token = create_access_token(data={"sub": str(member_admin.id)})
    stranger_token = create_access_token(data={"sub": str(stranger.id)})

    # 2. Create private group
    grp_private = Group(
        id=uuid.uuid4(),
        name="Private Vault",
        owner_id=owner.id,
        visibility="private",
    )
    db_session.add(grp_private)
    db_session.add(GroupMember(id=uuid.uuid4(), group_id=grp_private.id, user_id=owner.id, role="owner"))
    db_session.add(GroupMember(id=uuid.uuid4(), group_id=grp_private.id, user_id=member_admin.id, role="admin"))
    await db_session.commit()

    # Stranger tries to view private group -> 403
    resp = await client.get(
        f"/api/v1/groups/{grp_private.id}",
        cookies={"access_token": stranger_token},
    )
    assert resp.status_code == 403
    assert "not a member of this private circle" in resp.json()["detail"]

    # 3. Create unlisted group
    grp_unlisted = Group(
        id=uuid.uuid4(),
        name="Unlisted Event Pool",
        owner_id=owner.id,
        visibility="unlisted",
    )
    db_session.add(grp_unlisted)
    db_session.add(GroupMember(id=uuid.uuid4(), group_id=grp_unlisted.id, user_id=owner.id, role="owner"))
    db_session.add(GroupMember(id=uuid.uuid4(), group_id=grp_unlisted.id, user_id=member_admin.id, role="admin"))
    await db_session.commit()

    # Stranger accesses unlisted group via direct ID link -> 200, my_role is None
    resp_unlisted = await client.get(
        f"/api/v1/groups/{grp_unlisted.id}",
        cookies={"access_token": stranger_token},
    )
    assert resp_unlisted.status_code == 200
    assert resp_unlisted.json()["visibility"] == "unlisted"
    assert resp_unlisted.json()["my_role"] is None

    # Stranger tries to access sensitive financial overview of unlisted circle -> 403
    resp_overview = await client.get(
        f"/api/v1/groups/{grp_unlisted.id}/overview",
        cookies={"access_token": stranger_token},
    )
    assert resp_overview.status_code == 403
    assert "must be a member of this circle to view its financial ledger" in resp_overview.json()["detail"]

    # 4. Create public group & check discovery
    grp_public = Group(
        id=uuid.uuid4(),
        name="Open Community Fund",
        owner_id=owner.id,
        visibility="public",
    )
    db_session.add(grp_public)
    db_session.add(GroupMember(id=uuid.uuid4(), group_id=grp_public.id, user_id=owner.id, role="owner"))
    await db_session.commit()

    # Public group appears in /groups/public
    resp_pub_list = await client.get(
        "/api/v1/groups/public",
        cookies={"access_token": stranger_token},
    )
    assert resp_pub_list.status_code == 200
    pub_ids = [g["id"] for g in resp_pub_list.json()]
    assert str(grp_public.id) in pub_ids
    assert str(grp_unlisted.id) not in pub_ids
    assert str(grp_private.id) not in pub_ids

    # 5. Access control on changing visibility: Admin attempt is rejected with 403
    csrf_headers = {"Origin": "http://localhost:5173"}
    resp_admin_patch = await client.patch(
        f"/api/v1/groups/{grp_unlisted.id}",
        json={"visibility": "public"},
        cookies={"access_token": admin_token},
        headers=csrf_headers,
    )
    assert resp_admin_patch.status_code == 403
    assert "Only the group owner can change circle visibility" in resp_admin_patch.json()["detail"]

    # Owner can change visibility
    resp_owner_patch = await client.patch(
        f"/api/v1/groups/{grp_unlisted.id}",
        json={"visibility": "public"},
        cookies={"access_token": owner_token},
        headers=csrf_headers,
    )
    assert resp_owner_patch.status_code == 200
    assert resp_owner_patch.json()["visibility"] == "public"


@pytest.mark.asyncio
async def test_email_service_adapters():
    """
    Tests EmailDeliveryResult truthiness and ConsoleEmailAdapter dev enforcement.
    """
    res_ok = EmailDeliveryResult(success=True, status="provider_sent", provider="resend")
    assert bool(res_ok) is True

    res_fail = EmailDeliveryResult(success=False, status="failed", provider="resend", error="422")
    assert bool(res_fail) is False

    console_adapter = ConsoleEmailAdapter()
    result = await console_adapter.send_otp("test@example.com", "123456", "login")
    assert result.success is True
    assert result.status == "console_logged"
