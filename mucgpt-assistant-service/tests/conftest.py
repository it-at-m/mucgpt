"""Test configuration and fixtures."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.database.database_models import AssistantVersion, Base


@pytest.fixture
def in_memory_db():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(in_memory_db):
    """Create a database session for testing."""
    SessionLocal = sessionmaker(bind=in_memory_db)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


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
