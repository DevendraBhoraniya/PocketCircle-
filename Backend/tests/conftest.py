import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from core.config import settings
from core.database import Base, get_db, engine
from main import app
from models.user import User  # Ensures all models in models/ are imported and registered
from services.email_service import EmailDeliveryResult, EmailService

# Mock external email delivery during tests so tests do not make real network calls
@pytest.fixture(autouse=True)
def mock_external_email(monkeypatch):
    mock_result = EmailDeliveryResult(
        success=True,
        status="console_logged",
        provider="mock",
    )
    monkeypatch.setattr(EmailService, "send_otp_email", AsyncMock(return_value=mock_result))

is_sqlite = "sqlite" in settings.DATABASE_URL

if is_sqlite:
    test_engine = engine
else:
    # Create a test engine with NullPool so that connections don't cross event loops across tests
    test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create schema in isolated SQLite environments; no-op for pre-migrated PostgreSQL."""
    if is_sqlite:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    else:
        yield


@pytest_asyncio.fixture
async def db_session():
    """
    Yields an AsyncSession wrapped in a transaction that is rolled back
    at the end of each test, keeping test data completely isolated.
    """
    async with test_engine.connect() as connection:
        trans = await connection.begin()
        session = AsyncSession(bind=connection, expire_on_commit=False)
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """
    Async HTTP client for testing FastAPI endpoints with overridden database session.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost:8000") as c:
        yield c
    app.dependency_overrides.clear()
