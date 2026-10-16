import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_readiness_endpoint(client: AsyncClient):
    response = await client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


@pytest.mark.asyncio
async def test_request_id_and_security_headers(client: AsyncClient):
    response = await client.get("/health")
    assert "x-request-id" in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-xss-protection"] == "1; mode=block"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_custom_request_id_propagation(client: AsyncClient):
    custom_id = "test-request-id-12345"
    response = await client.get("/health", headers={"X-Request-ID": custom_id})
    assert response.headers["x-request-id"] == custom_id


@pytest.mark.asyncio
async def test_csrf_origin_defense_blocks_unauthorized_origin(client: AsyncClient):
    # State-changing request with cookie and malicious origin
    headers = {"Origin": "http://evil-attacker.com", "Cookie": "access_token=some_token"}
    response = await client.post(
        "/friends/requests",
        headers=headers,
        json={"friend_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert response.status_code == 403
    data = response.json()
    assert data["error"]["code"] == "CSRF_ORIGIN_REJECTED"


@pytest.mark.asyncio
async def test_standard_error_envelope_on_404(client: AsyncClient):
    response = await client.get("/non-existent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"
    assert "message" in data["error"]
    assert "detail" in data


@pytest.mark.asyncio
async def test_standard_error_envelope_on_unauthenticated(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert data["error"]["message"] == "Not authenticated"


@pytest.mark.asyncio
async def test_api_versioning_support(client: AsyncClient):
    response_root = await client.get("/auth/me")
    response_v1 = await client.get("/api/v1/auth/me")
    assert response_root.status_code == 401
    assert response_v1.status_code == 401
    assert response_v1.json()["error"]["code"] == "UNAUTHORIZED"
