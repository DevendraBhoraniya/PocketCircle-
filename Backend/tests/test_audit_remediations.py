import asyncio
from datetime import datetime, timezone, timedelta
import uuid
from unittest.mock import AsyncMock

from fastapi import Request
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_current_user
from models.friendship import Friendship
from models.refresh_token import RefreshToken
from models.user import User
from tests.test_groups import create_test_user
from utils.generate_pocket_id import generate_unique_pocket_id


def test_item_1_user_cache_deleted_from_security():
    """Item 1: _user_cache is deleted from security module."""
    import core.security as sec

    assert not hasattr(sec, "_user_cache"), "_user_cache must be removed outright"
    assert not hasattr(sec, "USER_CACHE_TTL_SECONDS")
    # Invalidate helper remains callable as a backwards-compatible no-op
    sec.invalidate_user_cache("dummy-id")
    sec.invalidate_user_cache(None)


@pytest.mark.asyncio
async def test_item_1_get_current_user_reads_from_active_session_without_cache(
    db_session: AsyncSession,
):
    """Item 1: Authenticated user lookup queries the active database session and sees mutations."""
    user, headers = await create_test_user(db_session, "Cacheless User")
    req = Request(
        scope={
            "type": "http",
            "headers": [(b"cookie", headers["Cookie"].encode())],
        }
    )
    fetched1 = await get_current_user(req, db_session)
    assert fetched1.id == user.id

    # Mutate user name in session
    user.name = "Mutated Cacheless User"
    await db_session.flush()

    # Second fetch reflects updated state immediately because there is no stale in-memory cache
    fetched2 = await get_current_user(req, db_session)
    assert fetched2.name == "Mutated Cacheless User"


def test_item_2_generate_username_20_char_truncation():
    """Item 2: 20-character first name is truncated to <= 14 chars so prefix + '_' + 4-digit fits <= 20."""
    from utils.generate_user_name import generate_username

    long_name = "BartholomewAlexander Doe"
    username = generate_username(long_name)

    # 14 chars (bartholomewale) + 1 char ('_') + 4 digits = 19 <= 20
    assert len(username) <= 20
    assert username.startswith("bartholomewale_")
    assert len(username) == 19
    suffix = username.split("_")[-1]
    assert len(suffix) == 4
    assert suffix.isdigit()


@pytest.mark.asyncio
async def test_item_2_generate_unique_username_collision_handling(
    db_session: AsyncSession,
):
    """Item 2: Handles collisions gracefully and yields an available unique username."""
    from utils.generate_user_name import generate_unique_username

    name = "Unique Collision"
    u1 = await generate_unique_username(name, db_session)
    assert len(u1) <= 20

    # Insert user occupying u1
    user = User(
        id=uuid.uuid4(),
        email=f"coll_{uuid.uuid4().hex[:8]}@example.com",
        name=name,
        username=u1,
        pocket_id=await generate_unique_pocket_id(db_session),
    )
    db_session.add(user)
    await db_session.flush()

    # Second call detects collision and returns an available alternative
    u2 = await generate_unique_username(name, db_session)
    assert u2 != u1
    assert len(u2) <= 20


@pytest.mark.asyncio
async def test_item_6_google_login_uses_asyncio_to_thread(
    client: AsyncClient,
    monkeypatch,
):
    """Item 6: Google login uses asyncio.to_thread to avoid blocking the event loop."""
    called_in_thread = []
    original_to_thread = asyncio.to_thread

    def mock_verify_google_token(token: str):
        return {
            "sub": f"sub_thread_{uuid.uuid4().hex[:8]}",
            "email": f"thread_{uuid.uuid4().hex[:8]}@example.com",
            "name": "Threaded Worker User",
            "picture": "https://example.com/avatar.png",
        }

    async def mock_to_thread(func, *args, **kwargs):
        called_in_thread.append(func)
        return await original_to_thread(func, *args, **kwargs)

    monkeypatch.setattr(asyncio, "to_thread", mock_to_thread)
    monkeypatch.setattr("routes.auth.verify_google_token", mock_verify_google_token)

    res = await client.post(
        "/auth/google",
        json={"credential": "mock_google_id_token"},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 200
    assert mock_verify_google_token in called_in_thread


@pytest.mark.asyncio
async def test_item_7_unhandled_exception_logs_with_exc_info(monkeypatch):
    """Item 7: Unhandled exceptions are logged with exc_info."""
    from main import app
    from core.logging import logger

    logged_errors = []
    original_error = logger.error

    def mock_logger_error(msg, *args, **kwargs):
        logged_errors.append((msg, kwargs))
        original_error(msg, *args, **kwargs)

    monkeypatch.setattr(logger, "error", mock_logger_error)

    @app.get("/test-crash-trigger-item7")
    async def crash_endpoint():
        raise RuntimeError("Crash for logging verification")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://localhost:8000") as c:
        res = await c.get("/test-crash-trigger-item7")
        assert res.status_code == 500
        assert res.json()["error"]["code"] == "INTERNAL_SERVER_ERROR"

    assert any(
        "Crash for logging verification" in str(msg) and kwargs.get("exc_info") is not None
        for msg, kwargs in logged_errors
    )


@pytest.mark.asyncio
async def test_item_11_lifespan_disposes_engine(monkeypatch):
    """Item 11: Application lifespan context manager calls engine.dispose() on exit."""
    from core.startup import lifespan

    mock_engine = AsyncMock()
    monkeypatch.setattr("core.startup.engine", mock_engine)

    async with lifespan(None):
        pass

    mock_engine.dispose.assert_awaited_once()


@pytest.mark.asyncio
async def test_item_5_refresh_token_unique_index(
    db_session: AsyncSession,
):
    """Item 5: ix_refresh_tokens_token_hash prevents duplicate token hashes."""
    user, _ = await create_test_user(db_session, "Token User")
    token_hash = f"hash_{uuid.uuid4().hex}"
    expires = datetime.now(timezone.utc) + timedelta(days=30)

    rt1 = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires,
    )
    db_session.add(rt1)
    await db_session.flush()

    rt2 = RefreshToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires,
    )
    with pytest.raises(IntegrityError):
        async with db_session.begin_nested():
            db_session.add(rt2)
            await db_session.flush()


@pytest.mark.asyncio
async def test_item_8_reciprocal_friendship_unique_index_blocks_duplicate(
    db_session: AsyncSession,
):
    """Item 8: unique_friendship_pair functional unique index prevents reciprocal duplicate pairs."""
    user_a, _ = await create_test_user(db_session, "Friend A")
    user_b, _ = await create_test_user(db_session, "Friend B")

    f1 = Friendship(user_id=user_a.id, friend_id=user_b.id, status="pending")
    db_session.add(f1)
    await db_session.flush()

    # Reciprocal insert must fail on unique_friendship_pair
    f2 = Friendship(user_id=user_b.id, friend_id=user_a.id, status="pending")
    with pytest.raises(IntegrityError):
        async with db_session.begin_nested():
            db_session.add(f2)
            await db_session.flush()


@pytest.mark.asyncio
async def test_item_8_reciprocal_friend_request_race():
    """Item 8: Concurrent reciprocal friend requests result in 1 success (201) and 1 conflict (409)."""
    from core.config import settings
    if "sqlite" in settings.DATABASE_URL:
        pytest.skip("Concurrent HTTP transaction race requires multi-connection database (PostgreSQL)")

    from tests.conftest import TestSessionLocal

    from main import app
    from core.database import get_db

    async with TestSessionLocal() as s:
        user_a, headers_a = await create_test_user(s, "Race Alice")
        user_b, headers_b = await create_test_user(s, "Race Bob")
        await s.commit()

    async def per_request_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = per_request_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://localhost:8000") as c1, \
                   AsyncClient(transport=transport, base_url="http://localhost:8000") as c2:
            res_a, res_b = await asyncio.gather(
                c1.post(
                    "/friends/requests",
                    json={"friend_id": str(user_b.id)},
                    headers=headers_a,
                ),
                c2.post(
                    "/friends/requests",
                    json={"friend_id": str(user_a.id)},
                    headers=headers_b,
                ),
            )

        statuses = [res_a.status_code, res_b.status_code]
        assert 201 in statuses, f"Expected 201 in {statuses}"
        assert 409 in statuses, f"Expected 409 in {statuses}"
    finally:
        app.dependency_overrides.clear()
        async with TestSessionLocal() as s:
            await s.execute(text("DELETE FROM friendships WHERE user_id IN (:a, :b) OR friend_id IN (:a, :b)"), {"a": user_a.id, "b": user_b.id})
            await s.execute(text("DELETE FROM users WHERE id IN (:a, :b)"), {"a": user_a.id, "b": user_b.id})
            await s.commit()


@pytest.mark.asyncio
async def test_item_13_notifications_composite_index(
    db_session: AsyncSession,
):
    """Item 13: ix_notifications_recipient_read_created exists with created_at DESC."""
    bind = db_session.bind
    dialect_name = bind.dialect.name if bind else "postgresql"
    if dialect_name == "sqlite":
        res = await db_session.execute(
            text(
                "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'ix_notifications_recipient_read_created'"
            )
        )
        row = res.scalar_one_or_none()
        assert row is not None, "Index ix_notifications_recipient_read_created must exist in SQLite"
        assert "recipient_id" in row
        assert "is_read" in row
        assert "created_at" in row
        return

    res = await db_session.execute(
        text(
            "SELECT indexdef FROM pg_indexes WHERE tablename = 'notifications' AND indexname = 'ix_notifications_recipient_read_created'"
        )
    )
    row = res.scalar_one_or_none()
    assert row is not None, "Index ix_notifications_recipient_read_created must exist"
    assert "recipient_id" in row
    assert "is_read" in row
    assert "created_at DESC" in row


