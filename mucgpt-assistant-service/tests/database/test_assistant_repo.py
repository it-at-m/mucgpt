"""Unit tests for the AssistantRepository class."""

import pytest
from src.database.assistant_repo import AssistantRepository
from src.database.database_models import Assistant, AssistantVersion, Owner


class TestAssistantRepository:
    """Test cases for the AssistantRepository class."""

    @pytest.fixture
    def assistant_repo(self, db_session):
        """Create an AssistantRepository instance."""
        return AssistantRepository(db_session)

    @pytest.fixture
    def sample_assistant(self, assistant_repo, sample_assistant_data):
        """Create a sample assistant for testing."""
        return assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )

    def test_create_assistant_without_owners(self, assistant_repo):
        """Test creating an assistant without owners."""
        # Act
        assistant = assistant_repo.create(hierarchical_access="ITM-TEST")

        # Assert
        assert assistant.id is not None
        assert assistant.hierarchical_access == "ITM-TEST"
        assert len(assistant.owners) == 0

    def test_create_assistant_with_owners(self, assistant_repo, sample_assistant_data):
        """Test creating an assistant with owners."""
        # Act
        assistant = assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )

        # Assert
        assert assistant.id is not None
        assert assistant.hierarchical_access == "ITM-KM"
        assert len(assistant.owners) == 2
        owner_ids = [owner.lhmobjektID for owner in assistant.owners]
        assert "user1" in owner_ids
        assert "user2" in owner_ids

    def test_create_assistant_with_new_and_existing_owners(
        self, assistant_repo, db_session
    ):
        """Test creating an assistant with mix of new and existing owners."""
        # Arrange - Create an existing owner
        existing_owner = Owner(lhmobjektID="existing_user")
        db_session.add(existing_owner)
        db_session.commit()

        # Act
        assistant = assistant_repo.create(
            hierarchical_access="ITM-TEST", owner_ids=["existing_user", "new_user"]
        )

        # Assert
        assert len(assistant.owners) == 2
        owner_ids = [owner.lhmobjektID for owner in assistant.owners]
        assert "existing_user" in owner_ids
        assert "new_user" in owner_ids

    def test_update_assistant_hierarchical_access(
        self, assistant_repo, sample_assistant
    ):
        """Test updating assistant's hierarchical access."""
        # Act
        updated = assistant_repo.update(
            sample_assistant.id, hierarchical_access="ITM-NEW"
        )

        # Assert
        assert updated is not None
        assert updated.hierarchical_access == "ITM-NEW"

    def test_update_assistant_owners(self, assistant_repo, sample_assistant):
        """Test updating assistant's owners."""
        # Act
        updated = assistant_repo.update(
            sample_assistant.id, owner_ids=["new_user1", "new_user2", "new_user3"]
        )

        # Assert
        assert updated is not None
        assert len(updated.owners) == 3
        owner_ids = [owner.lhmobjektID for owner in updated.owners]
        assert "new_user1" in owner_ids
        assert "new_user2" in owner_ids
        assert "new_user3" in owner_ids

    def test_update_assistant_clear_owners(self, assistant_repo, sample_assistant):
        """Test clearing assistant's owners."""
        # Act
        updated = assistant_repo.update(sample_assistant.id, owner_ids=[])

        # Assert
        assert updated is not None
        assert len(updated.owners) == 0

    def test_update_non_existing_assistant(self, assistant_repo):
        """Test updating a non-existing assistant returns None."""
        # Act
        result = assistant_repo.update(999, hierarchical_access="TEST")
        # Assert
        assert result is None

    def test_create_assistant_version(
        self, assistant_repo, sample_assistant, sample_assistant_version_data
    ):
        """Test creating a new assistant version."""
        # Act
        version = assistant_repo.create_assistant_version(
            assistant=sample_assistant, **sample_assistant_version_data.to_dict()
        )  # Assert
        assert version is not None
        assert version.version == 1
        assert version.assistant_id == sample_assistant.id
        assert version.name == sample_assistant_version_data.name
        assert version.system_prompt == sample_assistant_version_data.system_prompt
        assert version.temperature == sample_assistant_version_data.temperature

    def test_create_multiple_assistant_versions(
        self, assistant_repo, sample_assistant, sample_assistant_version_data
    ):
        """Test creating multiple versions increments version number."""
        # Act
        version1 = assistant_repo.create_assistant_version(
            assistant=sample_assistant, **sample_assistant_version_data.to_dict()
        )

        # Create a new AssistantVersion instance with modified name
        version2_data = AssistantVersion(
            name="Updated Assistant",
            system_prompt=sample_assistant_version_data.system_prompt,
            description=sample_assistant_version_data.description,
            temperature=sample_assistant_version_data.temperature,
            max_output_tokens=sample_assistant_version_data.max_output_tokens,
            examples=sample_assistant_version_data.examples,
            quick_prompts=sample_assistant_version_data.quick_prompts,
            tags=sample_assistant_version_data.tags,
        )
        version2 = assistant_repo.create_assistant_version(
            assistant=sample_assistant, **version2_data.to_dict()
        )

        # Assert
        assert version1.version == 1
        assert version2.version == 2
        assert version2.name == "Updated Assistant"

    def test_get_assistant_version(
        self, assistant_repo, sample_assistant, sample_assistant_version_data
    ):
        """Test getting a specific assistant version."""
        # Arrange
        created_version = assistant_repo.create_assistant_version(
            assistant=sample_assistant, **sample_assistant_version_data.to_dict()
        )

        # Act
        retrieved_version = assistant_repo.get_assistant_version(sample_assistant.id, 1)

        # Assert
        assert retrieved_version is not None
        assert retrieved_version.id == created_version.id
        assert retrieved_version.version == 1

    def test_get_non_existing_assistant_version(self, assistant_repo, sample_assistant):
        """Test getting a non-existing assistant version returns None."""
        # Act
        result = assistant_repo.get_assistant_version(sample_assistant.id, 999)

        # Assert
        assert result is None

    def test_get_assistants_by_owner(self, assistant_repo, db_session):
        """Test getting assistants by owner."""
        # Arrange
        assistant1 = assistant_repo.create(
            hierarchical_access="ITM-1", owner_ids=["user1", "user2"]
        )
        assistant2 = assistant_repo.create(
            hierarchical_access="ITM-2", owner_ids=["user2", "user3"]
        )
        assistant_repo.create(hierarchical_access="ITM-3", owner_ids=["user3"])

        # Act
        user2_assistants = assistant_repo.get_assistants_by_owner("user2")

        # Assert
        assert len(user2_assistants) == 2
        assistant_ids = [a.id for a in user2_assistants]
        assert assistant1.id in assistant_ids
        assert assistant2.id in assistant_ids

    def test_get_assistants_by_non_existing_owner(self, assistant_repo):
        """Test getting assistants by non-existing owner returns empty list."""
        # Act
        result = assistant_repo.get_assistants_by_owner("non_existing_user")

        # Assert
        assert result == []

    def test_get_all_possible_assistants_for_user_with_department_exact_match(
        self, assistant_repo
    ):
        """Test getting assistants with exact department match."""
        # Arrange
        assistant1 = assistant_repo.create(hierarchical_access="ITM-KM")
        assistant2 = assistant_repo.create(hierarchical_access="ITM-AB")
        assistant3 = assistant_repo.create(hierarchical_access="")  # Available to all

        # Act
        result = assistant_repo.get_all_possible_assistants_for_user_with_department(
            "ITM-KM"
        )

        # Assert
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids
        assert assistant3.id in assistant_ids  # Available to all
        assert assistant2.id not in assistant_ids

    def test_get_all_possible_assistants_for_user_with_department_hierarchical(
        self, assistant_repo
    ):
        """Test getting assistants with hierarchical department access."""
        # Arrange
        assistant1 = assistant_repo.create(hierarchical_access="ITM")
        assistant2 = assistant_repo.create(hierarchical_access="ITM-KM")
        assistant3 = assistant_repo.create(hierarchical_access="ITM-AB")

        # Act - User from ITM-KM-DI should access ITM and ITM-KM assistants
        result = assistant_repo.get_all_possible_assistants_for_user_with_department(
            "ITM-KM-DI"
        )

        # Assert
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids
        assert assistant2.id in assistant_ids
        assert assistant3.id not in assistant_ids

    def test_get_all_possible_assistants_for_user_with_department_no_access(
        self, assistant_repo
    ):
        """Test getting assistants when user has no hierarchical access."""
        # Arrange
        assistant1 = assistant_repo.create(hierarchical_access="ITM-KM")
        assistant2 = assistant_repo.create(hierarchical_access="ITM-AB")
        assistant3 = assistant_repo.create(hierarchical_access="")

        # Act - User from different department
        result = assistant_repo.get_all_possible_assistants_for_user_with_department(
            "FINANCE"
        )

        # Assert
        assistant_ids = [a.id for a in result]
        assert assistant1.id not in assistant_ids
        assert assistant2.id not in assistant_ids
        assert assistant3.id in assistant_ids  # Only the one available to all

    def test_get_all_possible_assistants_includes_null_hierarchical_access(
        self, assistant_repo, db_session
    ):
        """Test that assistants with NULL hierarchical_access are included for any user."""
        # Arrange - Create assistant with NULL hierarchical_access
        assistant = Assistant()  # No hierarchical_access set (None)
        db_session.add(assistant)
        db_session.commit()

        # Act
        result = assistant_repo.get_all_possible_assistants_for_user_with_department(
            "ANY-DEPT"
        )  # Assert
        assistant_ids = [a.id for a in result]
        assert assistant.id in assistant_ids

    def test_latest_version_property(
        self, assistant_repo, sample_assistant, sample_assistant_version_data
    ):
        """Test that latest_version property returns the most recent version."""
        # Arrange
        assistant_repo.create_assistant_version(
            sample_assistant, **sample_assistant_version_data.to_dict()
        )

        # Create a new AssistantVersion instance with modified name
        version2_data = AssistantVersion(
            name="Version 2",
            system_prompt=sample_assistant_version_data.system_prompt,
            description=sample_assistant_version_data.description,
            temperature=sample_assistant_version_data.temperature,
            max_output_tokens=sample_assistant_version_data.max_output_tokens,
            examples=sample_assistant_version_data.examples,
            quick_prompts=sample_assistant_version_data.quick_prompts,
            tags=sample_assistant_version_data.tags,
        )
        version2 = assistant_repo.create_assistant_version(
            sample_assistant, **version2_data.to_dict()
        )

        # Act
        latest = sample_assistant.latest_version

        # Assert
        assert latest is not None
        assert latest.id == version2.id
        assert latest.version == 2

    def test_is_owner_method(self, assistant_repo, sample_assistant):
        """Test the is_owner method on Assistant model."""
        # Act & Assert
        assert sample_assistant.is_owner("user1") is True
        assert sample_assistant.is_owner("user2") is True
        assert sample_assistant.is_owner("user3") is False

    def test_is_allowed_for_user_method(self, assistant_repo):
        """Test the is_allowed_for_user method on Assistant model."""
        # Arrange
        assistant1 = assistant_repo.create(hierarchical_access="ITM-KM")
        assistant2 = assistant_repo.create(hierarchical_access="")

        # Act & Assert
        assert assistant1.is_allowed_for_user("ITM-KM") is True
        assert assistant1.is_allowed_for_user("ITM-KM-DI") is True
        assert assistant1.is_allowed_for_user("ITM-AB") is False

        assert assistant2.is_allowed_for_user("ANY-DEPT") is True
        assert assistant2.is_allowed_for_user("ITM-KM") is True
