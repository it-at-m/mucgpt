"""Unit tests for the base Repository class."""

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from src.database.repo import Repository

# Create a test model for testing the base repository
TestBase = declarative_base()


class TestModel(TestBase):
    __tablename__ = "test_models"

    id = Column(Integer, primary_key=True)
    name = Column(String(100))
    description = Column(String(255))


class TestRepository:
    """Test cases for the base Repository class."""

    @pytest.fixture
    def test_repo(self, db_session):
        """Create a test repository instance."""
        # Create the test table
        TestModel.__table__.create(db_session.bind, checkfirst=True)
        return Repository(TestModel, db_session)

    def test_create(self, test_repo):
        """Test creating a new model instance."""
        # Arrange
        data = {"name": "Test Name", "description": "Test Description"}

        # Act
        result = test_repo.create(**data)

        # Assert
        assert result.id is not None
        assert result.name == "Test Name"
        assert result.description == "Test Description"

    def test_get_existing(self, test_repo):
        """Test getting an existing model by ID."""
        # Arrange
        created = test_repo.create(name="Test", description="Test Desc")

        # Act
        result = test_repo.get(created.id)

        # Assert
        assert result is not None
        assert result.id == created.id
        assert result.name == "Test"

    def test_get_non_existing(self, test_repo):
        """Test getting a non-existing model returns None."""
        # Act
        result = test_repo.get(999)

        # Assert
        assert result is None

    def test_get_all_empty(self, test_repo):
        """Test getting all models when none exist."""
        # Act
        result = test_repo.get_all()

        # Assert
        assert result == []

    def test_get_all_with_data(self, test_repo):
        """Test getting all models when some exist."""
        # Arrange
        test_repo.create(name="Test1", description="Desc1")
        test_repo.create(name="Test2", description="Desc2")

        # Act
        result = test_repo.get_all()

        # Assert
        assert len(result) == 2
        assert result[0].name == "Test1"
        assert result[1].name == "Test2"

    def test_update_existing(self, test_repo):
        """Test updating an existing model."""
        # Arrange
        created = test_repo.create(name="Original", description="Original Desc")

        # Act
        result = test_repo.update(
            created.id, name="Updated", description="Updated Desc"
        )

        # Assert
        assert result is not None
        assert result.id == created.id
        assert result.name == "Updated"
        assert result.description == "Updated Desc"

    def test_update_partial(self, test_repo):
        """Test updating only some fields of an existing model."""
        # Arrange
        created = test_repo.create(name="Original", description="Original Desc")

        # Act
        result = test_repo.update(created.id, name="Updated")

        # Assert
        assert result is not None
        assert result.name == "Updated"
        assert result.description == "Original Desc"  # Should remain unchanged

    def test_update_non_existing(self, test_repo):
        """Test updating a non-existing model returns None."""
        # Act
        result = test_repo.update(999, name="Updated")

        # Assert
        assert result is None

    def test_delete_existing(self, test_repo):
        """Test deleting an existing model."""
        # Arrange
        created = test_repo.create(name="To Delete", description="Delete me")

        # Act
        result = test_repo.delete(created.id)

        # Assert
        assert result is True
        assert test_repo.get(created.id) is None

    def test_delete_non_existing(self, test_repo):
        """Test deleting a non-existing model returns False."""
        # Act
        result = test_repo.delete(999)
        # Assert
        assert result is False

    def test_repository_maintains_session_state(self, test_repo):
        """Test that repository operations maintain session state correctly."""
        # Arrange & Act
        created = test_repo.create(name="Test", description="Test")
        fetched = test_repo.get(created.id)

        # Assert
        # Due to session.refresh() in create(), the instances are the same
        assert created.id == fetched.id
        assert created.name == fetched.name
