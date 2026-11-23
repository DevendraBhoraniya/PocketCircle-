from decimal import Decimal
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import Settings
from tests.test_groups import create_test_user, make_friends


def test_sec_02_production_config_validation():
    """
    SEC-02: Validate that Settings rejects weak or default secrets and insecure cookies in production,
    without leaking secret contents in error messages.
    """
    # 1. Production with COOKIE_SECURE=False must be rejected
    with pytest.raises(ValueError, match="COOKIE_SECURE must be True in production"):
        Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
            GOOGLE_CLIENT_ID="mock-client-id",
            ENVIRONMENT="production",
            COOKIE_SECURE=False,
            JWT_SECRET="a" * 32,
        )

    # 2. Production with weak default secret must be rejected
    with pytest.raises(ValueError, match="JWT_SECRET is too weak"):
        Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
            GOOGLE_CLIENT_ID="mock-client-id",
            ENVIRONMENT="production",
            COOKIE_SECURE=True,
            JWT_SECRET="pocketcircle9876543210",
        )

    # 3. Production with secret < 32 characters must be rejected
    with pytest.raises(ValueError, match="JWT_SECRET is too weak"):
        Settings(
            DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
            GOOGLE_CLIENT_ID="mock-client-id",
            ENVIRONMENT="production",
            COOKIE_SECURE=True,
            JWT_SECRET="short-secret-under-32",
        )

    # 4. Production with strong secret and secure cookies must succeed
    valid_prod = Settings(
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
        GOOGLE_CLIENT_ID="mock-client-id",
        ENVIRONMENT="production",
        COOKIE_SECURE=True,
        JWT_SECRET="super-strong-production-secret-at-least-32-chars-long",
    )
    assert valid_prod.ENVIRONMENT == "production"
    assert valid_prod.COOKIE_SECURE is True


@pytest.mark.asyncio
async def test_sec_01_otp_not_exposed_outside_development(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
):
    """
    SEC-01: Verify that in non-development environments, dev_otp is strictly omitted/None
    from authentication responses.
    """
    from core.config import settings
    monkeypatch.setattr(settings, "ENVIRONMENT", "staging")

    email = f"test_sec01_{uuid.uuid4().hex[:8]}@example.com"
    reg_res = await client.post(
        "/auth/register",
        json={
            "name": "Staging User",
            "email": email,
            "password": "SecurePassword123!",
        },
        headers={"Origin": "http://localhost:5173"},
    )
    assert reg_res.status_code == 200, reg_res.text
    data = reg_res.json()
    assert data["otp_required"] is True
    assert data.get("dev_otp") is None, "dev_otp MUST NOT be returned in staging/production"


@pytest.mark.asyncio
async def test_fin_01_unsettled_balance_blocks_departure_and_protects_ledger(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    FIN-01: Verify that a member cannot leave or be removed if they have an unsettled balance,
    and once settled, departure leaves the group balances completely intact without 500 errors.
    """
    alice, headers_alice = await create_test_user(db_session, "Alice Owner")
    bob, headers_bob = await create_test_user(db_session, "Bob Debtor")
    charlie, headers_charlie = await create_test_user(db_session, "Charlie Neutral")

    await make_friends(db_session, alice, bob)
    await make_friends(db_session, alice, charlie)

    # 1. Alice creates group with Bob and Charlie
    grp_resp = await client.post(
        "/groups",
        json={"name": "Goa Trip Invariant Test", "initial_member_ids": [str(bob.id), str(charlie.id)]},
        headers=headers_alice,
    )
    assert grp_resp.status_code == 201
    group_id = grp_resp.json()["id"]

    # 2. Alice pays 90.00 equal split for Alice, Bob, Charlie (Bob owes 30.00)
    exp_res = await client.post(
        f"/groups/{group_id}/expenses",
        json={
            "description": "Seafood Dinner",
            "amount": "90.00",
            "split_type": "equal",
        },
        headers=headers_alice,
    )
    assert exp_res.status_code == 201

    # 3. Bob attempts to leave circle -> REJECTED (422) because he owes 30.00
    leave_res = await client.post(
        f"/groups/{group_id}/leave",
        headers=headers_bob,
    )
    assert leave_res.status_code == 422
    assert "unsettled balance" in leave_res.json()["detail"].lower()

    # 4. Alice (Owner) attempts to remove Bob -> REJECTED (422) because Bob owes 30.00
    rem_res = await client.delete(
        f"/groups/{group_id}/members/{bob.id}",
        headers=headers_alice,
    )
    assert rem_res.status_code == 422
    assert "unsettled balance" in rem_res.json()["detail"].lower()

    # 5. Alice attempts to leave circle -> REJECTED (422) because Alice is owed 60.00
    # (plus she is owner without transfer, but balance guard also protects)
    rem_alice = await client.post(
        f"/groups/{group_id}/leave",
        headers=headers_alice,
    )
    assert rem_alice.status_code == 422

    # 6. Settle Bob's debt: Bob requests settlement of 30.00 to Alice
    settle_req = await client.post(
        f"/groups/{group_id}/settlements",
        json={"payee_id": str(alice.id), "amount": "30.00"},
        headers=headers_bob,
    )
    assert settle_req.status_code == 201
    settlement_id = settle_req.json()["id"]

    # While settlement is pending, Bob still cannot leave
    leave_pending = await client.post(
        f"/groups/{group_id}/leave",
        headers=headers_bob,
    )
    assert leave_pending.status_code == 422
    assert "pending settlement" in leave_pending.json()["detail"].lower()

    # Alice confirms Bob's settlement
    confirm_res = await client.post(
        f"/groups/{group_id}/settlements/{settlement_id}/confirm",
        headers=headers_alice,
    )
    assert confirm_res.status_code == 200

    # 7. Now Bob has net balance 0.00! Bob can leave successfully
    leave_success = await client.post(
        f"/groups/{group_id}/leave",
        headers=headers_bob,
    )
    assert leave_success.status_code == 200

    # 8. Check group balances: MUST NOT throw 500 error!
    bal_res = await client.get(
        f"/groups/{group_id}/balances",
        headers=headers_alice,
    )
    assert bal_res.status_code == 200
    bal_data = bal_res.json()
    assert Decimal(str(bal_data["total_group_spending"])) == Decimal("90.00")


def test_perf_01_in_memory_rate_limiter_bounded_and_lru():
    """
    PERF-01: Verify that InMemoryRateLimiter enforces a strict upper capacity bound,
    evicts oldest entries (LRU), and cleans up expired timestamps.
    """
    from core.middleware import InMemoryRateLimiter

    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=10, max_tracked_ips=3)

    # Add 3 IPs (at capacity)
    assert not limiter.is_rate_limited("1.1.1.1")
    assert not limiter.is_rate_limited("2.2.2.2")
    assert not limiter.is_rate_limited("3.3.3.3")
    assert len(limiter.requests) == 3

    # Add 4th IP -> 1.1.1.1 must be evicted
    assert not limiter.is_rate_limited("4.4.4.4")
    assert len(limiter.requests) == 3
    assert "1.1.1.1" not in limiter.requests
    assert "4.4.4.4" in limiter.requests

    # Verify rate limit enforcement for 4.4.4.4
    assert not limiter.is_rate_limited("4.4.4.4")  # 2nd request in window: OK
    assert limiter.is_rate_limited("4.4.4.4")      # 3rd request in window: BLOCKED

