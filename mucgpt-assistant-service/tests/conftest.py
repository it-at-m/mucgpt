"""Test configuration and fixtures."""

import os
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from src.database.database_models import AssistantVersion, Base

# Add the src directory to the Python path
# This will allow imports to work without the 'src.' prefix
root_dir = Path(__file__).parent.parent
src_dir = os.path.join(root_dir, "src")
if src_dir not in sys.path:
    sys.path.insert(0, str(src_dir))


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
        temperature=0.7,
        max_output_tokens=1000,
        examples=["Example 1", "Example 2"],
        quick_prompts=["Quick prompt 1", "Quick prompt 2"],
        tags=["tag1", "tag2"],
    )
