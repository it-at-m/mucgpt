"""Test configuration and fixtures."""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core import directory_cache
from database.database_models import AssistantVersion, Base
from tests.shared_directory_tree import TEST_TREE


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine):
    """Create a database session for testing."""
    SessionLocal = async_sessionmaker(bind=async_engine, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session


@pytest.fixture
def sample_assistant_data():
    """Sample data for creating assistants."""
    return {"hierarchical_access": "ITM-KM", "owner_ids": ["user1", "user2"]}


@pytest.fixture
def sample_assistant_version_data():
    """Sample AssistantVersion instance with proper type safety."""
    return AssistantVersion(
        name="Test Assistant",
        system_prompt="You are a helpful assistant",
        description="A test assistant for unit testing",
        creativity="medium",
        examples=["Example 1", "Example 2"],
        quick_prompts=["Quick prompt 1", "Quick prompt 2"],
        tags=["tag1", "tag2"],
    )


@pytest.fixture(scope="session", autouse=True)
def mock_directory_cache():
    """Force directory cache to return a deterministic tree for access checks."""

    mp = pytest.MonkeyPatch()

    async def _get_tree():
        return TEST_TREE

    mp.setattr(directory_cache, "get_simplified_directory_tree", _get_tree)
    # Clear any cached index in path_matcher when the session ends to avoid bleed-over
    yield
    mp.undo()
    try:
        from database import path_matcher

        path_matcher._INDEX_CACHE["index"] = None
        path_matcher._INDEX_CACHE["expires_at"] = None
    except Exception:
        pass
