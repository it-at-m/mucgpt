"""Unit tests for the base Repository class."""

import pytest
import pytest_asyncio
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base
from src.database.repo import Repository

# Create a test model for testing the base repository
TestBase = declarative_base()


class MockModel(TestBase):
    __tablename__ = "test_models"

    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(String(255))


@pytest.mark.asyncio
class TestRepository:
    """Test cases for the base Repository class."""

    @pytest_asyncio.fixture(autouse=True)
    async def setup_test_tables(self, async_engine):
        """Setup test tables for the repository tests."""
        async with async_engine.begin() as conn:
            await conn.run_sync(TestBase.metadata.create_all)
        yield
        async with async_engine.begin() as conn:
            await conn.run_sync(TestBase.metadata.drop_all)

    async def test_create(self, db_session):
        """Test creating a new model instance."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        data = {"name": "Test Name", "description": "Test Description"}

        # Act
        result = await test_repo.create(**data)
        await db_session.commit()

        # Assert
        assert result.id is not None
        assert result.name == "Test Name"
        assert result.description == "Test Description"

    async def test_get_existing(self, db_session):
        """Test getting an existing model by ID."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        created = await test_repo.create(name="Test", description="Test Desc")
        await db_session.commit()

        # Act
        result = await test_repo.get(created.id)

        # Assert
        assert result is not None
        assert result.id == created.id
        assert result.name == "Test"

    async def test_get_non_existing(self, db_session):
        """Test getting a non-existing model returns None."""
        # Arrange
        test_repo = Repository(MockModel, db_session)

        # Act
        result = await test_repo.get(999)

        # Assert
        assert result is None

    async def test_get_all_empty(self, db_session):
        """Test getting all models when none exist."""
        # Arrange
        test_repo = Repository(MockModel, db_session)

        # Act
        result = await test_repo.get_all()

        # Assert
        assert result == []

    async def test_get_all_with_data(self, db_session):
        """Test getting all models when some exist."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        await test_repo.create(name="Test1", description="Desc1")
        await test_repo.create(name="Test2", description="Desc2")
        await db_session.commit()

        # Act
        result = await test_repo.get_all()

        # Assert
        assert len(result) == 2
        assert result[0].name == "Test1"
        assert result[1].name == "Test2"

    async def test_update_existing(self, db_session):
        """Test updating an existing model."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        created = await test_repo.create(name="Original", description="Original Desc")
        await db_session.commit()

        # Act
        result = await test_repo.update(
            created.id, name="Updated", description="Updated Desc"
        )
        await db_session.commit()

        # Assert
        assert result is not None
        assert result.id == created.id
        assert result.name == "Updated"
        assert result.description == "Updated Desc"

    async def test_update_partial(self, db_session):
        """Test updating only some fields of an existing model."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        created = await test_repo.create(name="Original", description="Original Desc")
        await db_session.commit()

        # Act
        result = await test_repo.update(created.id, name="Updated")
        await db_session.commit()

        # Assert
        assert result is not None
        assert result.name == "Updated"
        assert result.description == "Original Desc"  # Should remain unchanged

    async def test_update_non_existing(self, db_session):
        """Test updating a non-existing model returns None."""
        # Arrange
        test_repo = Repository(MockModel, db_session)

        # Act
        result = await test_repo.update(999, name="Updated")

        # Assert
        assert result is None

    async def test_delete_existing(self, db_session):
        """Test deleting an existing model."""
        # Arrange
        test_repo = Repository(MockModel, db_session)
        created = await test_repo.create(name="To Delete", description="Delete me")
        await db_session.commit()

        # Act
        result = await test_repo.delete(created.id)
        await db_session.commit()

        # Assert
        assert result is True
        assert await test_repo.get(created.id) is None

    async def test_delete_non_existing(self, db_session):
        """Test deleting a non-existing model returns False."""
        # Arrange
        test_repo = Repository(MockModel, db_session)

        # Act
        result = await test_repo.delete(999)

        # Assert
        assert result is False

    async def test_repository_maintains_session_state(self, db_session):
        """Test that repository operations maintain session state correctly."""
        # Arrange & Act
        test_repo = Repository(MockModel, db_session)
        created = await test_repo.create(name="Test", description="Test")
        await db_session.commit()
        fetched = await test_repo.get(created.id)

        # Assert
        # Due to session.refresh() in create(), the instances are the same
        assert created.id == fetched.id
        assert created.name == fetched.name
