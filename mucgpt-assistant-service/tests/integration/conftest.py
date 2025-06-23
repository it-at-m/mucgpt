"""Integration test configuration and fixtures."""

from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult
from database.database_models import Base
from database.session import get_db_session


@pytest.fixture
def mock_assistant():
    """Mock assistant database model."""
    assistant = MagicMock()
    assistant.id = 1
    assistant.created_at = "2025-06-23T10:00:00Z"
    assistant.updated_at = "2025-06-23T10:00:00Z"
    assistant.hierarchical_access = "IT"
    assistant.is_owner.return_value = True
    assistant.is_allowed_for_user.return_value = True

    # Mock owners relationship
    owner_mock = MagicMock()
    owner_mock.lhmobjektID = "test_user_123"
    assistant.owners = [owner_mock]

    return assistant


@pytest.fixture
def mock_assistant_version():
    """Mock assistant version database model."""
    version = MagicMock()
    version.id = 1
    version.version = 1
    version.created_at = "2025-06-23T10:00:00Z"
    version.name = "Test Assistant"
    version.description = "A test AI assistant"
    version.system_prompt = "You are a helpful test assistant."
    version.temperature = 0.7
    version.max_output_tokens = 1000
    version.examples = []
    version.quick_prompts = []
    version.tags = []
    version.tools = []

    return version


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_assistant_repo():
    """Mock assistant repository."""
    repo = AsyncMock()
    repo.create = AsyncMock()
    repo.update = AsyncMock()
    repo.delete = AsyncMock(return_value=True)
    repo.get = AsyncMock()
    repo.get_with_owners = AsyncMock()
    repo.get_latest_version = AsyncMock()
    repo.get_assistant_version = AsyncMock()
    repo.create_assistant_version = AsyncMock()
    repo.get_all_possible_assistants_for_user_with_department = AsyncMock()
    repo.get_assistants_by_owner = AsyncMock()
    return repo


# Test database fixtures
@pytest_asyncio.fixture(scope="function")
async def test_db_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    return engine


@pytest_asyncio.fixture(scope="function")
async def test_db_session(test_db_engine):
    """Create a test database session using the SQLite engine."""
    async with test_db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(test_db_engine, expire_on_commit=False)
    async with async_session() as session:
        yield session

    async with test_db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_db_engine.dispose()


# Dependency overrides for testing
@pytest.fixture
def override_get_db_session(test_db_session):
    """Override the database session dependency."""

    async def _get_test_db():
        yield test_db_session

    return _get_test_db


@pytest.fixture
def override_authenticate_user():
    """Override the authentication dependency."""

    async def _get_test_user():
        return AuthenticationResult(
            lhm_object_id="test_user_123",
            name="Test User",
            email="test@example.com",
            department="IT-Test-Department",
            is_authenticated=True,
        )

    return _get_test_user


@pytest.fixture
def test_client(override_get_db_session, override_authenticate_user):
    """Create a test client with authentication and database overrides."""
    # Apply dependency overrides
    api_app.dependency_overrides[get_db_session] = override_get_db_session
    api_app.dependency_overrides[authenticate_user] = override_authenticate_user

    # Create test client
    client = TestClient(api_app)

    yield client

    # Clear overrides after test
    api_app.dependency_overrides.clear()


# Add a fixture to mock database connection configuration
@pytest.fixture(autouse=True)
def mock_db_config():
    """Mock the database configuration to prevent actual DB connection attempts."""
    from unittest.mock import patch

    with patch("config.configuration.ConfigHelper.loadData") as mock_load_data:
        # Create a mock configuration that will be returned by loadData
        mock_config = MagicMock()
        mock_config.backend.db_config.db_user = "test_user"
        mock_config.backend.db_config.db_host = "localhost"
        mock_config.backend.db_config.db_name = "test_db"
        mock_config.backend.db_config.db_password = "test_password"
        mock_config.backend.sso_config.sso_issuer = (
            "http://localhost:8080/auth/realms/test"
        )
        mock_config.backend.sso_config.role = "test_role"

        mock_load_data.return_value = mock_config
        yield mock_load_data
