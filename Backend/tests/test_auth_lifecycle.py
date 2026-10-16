import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token, generate_refresh_token, hash_token
from models.user import User
from utils.generate_pocket_id import generate_unique_pocket_id


@pytest.mark.asyncio
async def test_pocket_id_is_ten_numeric_digits(db_session: AsyncSession):
    pocket_id = await generate_unique_pocket_id(db_session)
    assert len(pocket_id) == 10
    assert pocket_id.isdigit()


@pytest.mark.asyncio
async def test_token_creation_and_hashing():
    token = generate_refresh_token()
    assert len(token) > 20
    hashed = hash_token(token)
    assert len(hashed) == 64  # SHA-256 hex string


@pytest.mark.asyncio
async def test_auth_me_with_authenticated_user(client: AsyncClient, db_session: AsyncSession):
    # Create test user in isolated test transaction
    pocket_id = await generate_unique_pocket_id(db_session)
    test_user = User(
        id=uuid.uuid4(),
        google_sub=f"test_sub_{uuid.uuid4().hex[:10]}",
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        name="Test Authenticated User",
        username=f"testuser_{uuid.uuid4().hex[:6]}",
        pocket_id=pocket_id,
    )
    db_session.add(test_user)
    await db_session.flush()

    # Generate access token
    access_token = create_access_token({"sub": str(test_user.id)})

    # Request /auth/me with access_token cookie
    headers = {"Cookie": f"access_token={access_token}"}
    response = await client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Authenticated"
    assert data["user"]["email"] == test_user.email
    assert data["user"]["pocket_id"] == pocket_id


@pytest.mark.asyncio
async def test_logout_clears_cookies(client: AsyncClient):
    headers = {
        "Origin": "http://localhost:5173",
        "Cookie": "access_token=dummy_access; refresh_token=dummy_refresh",
    }
    response = await client.post("/auth/logout", headers=headers)
    assert response.status_code == 204
    # Check that Set-Cookie headers expire/clear access_token and refresh_token
    set_cookies = response.headers.get_list("set-cookie")
    assert any("access_token=" in c for c in set_cookies)
    assert any("refresh_token=" in c for c in set_cookies)
