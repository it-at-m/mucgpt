"""Test configuration and fixtures."""

from dataclasses import dataclass, field
from typing import List

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.database.database_models import Base


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


@dataclass
class AssistantVersionTestData:
    """Type-safe container for assistant version test data."""

    name: str = "Test Assistant"
    system_prompt: str = "You are a helpful assistant"
    description: str = "A test assistant for unit testing"
    temperature: float = 0.7
    max_output_tokens: int = 1000
    examples: List[str] = field(default_factory=lambda: ["Example 1", "Example 2"])
    quick_prompts: List[str] = field(
        default_factory=lambda: ["Quick prompt 1", "Quick prompt 2"]
    )
    tags: List[str] = field(default_factory=lambda: ["tag1", "tag2"])

    def to_dict(self) -> dict:
        """Convert to dictionary for unpacking in function calls."""
        return {
            "name": self.name,
            "system_prompt": self.system_prompt,
            "description": self.description,
            "temperature": self.temperature,
            "max_output_tokens": self.max_output_tokens,
            "examples": self.examples.copy(),
            "quick_prompts": self.quick_prompts.copy(),
            "tags": self.tags.copy(),
        }


@pytest.fixture
def sample_assistant_version_data():
    """Sample AssistantVersion data with proper type safety."""
    return AssistantVersionTestData()
