"""Unit tests for the AssistantRepository class."""

import pytest
from src.database.assistant_repo import AssistantRepository


@pytest.fixture
def sample_assistant_data():
    """Sample data for assistant creation and updates."""
    return {
        "hierarchical_access": ["ITM-KM"],
        "owner_ids": ["user1", "user2"],
    }


@pytest.mark.asyncio
class TestAssistantRepository:
    """Test cases for the AssistantRepository class."""

    async def test_create_assistant_without_owners(self, db_session):
        """Test creating an assistant without owners."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Act
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        # Assert
        assert assistant.id is not None
        assert assistant.hierarchical_access == [
            "ITM-TEST"
        ]  # Use the safe method to check owners count
        owners_count = await assistant_repo.get_owners_count(assistant.id)
        assert owners_count == 0

    async def test_create_assistant_with_owners(
        self, db_session, sample_assistant_data
    ):
        """Test creating an assistant with owners."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Act
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()  # Assert
        assert assistant.id is not None
        assert (
            assistant.hierarchical_access
            == sample_assistant_data["hierarchical_access"]
        )
        # Use the safe method to check owners
        result = await assistant_repo.get_with_owners(assistant.id)
        assert len(result.owners) == 2
        owner_ids = [owner.lhmobjektID for owner in result.owners]
        assert "user1" in owner_ids
        assert "user2" in owner_ids

    async def test_create_assistant_with_new_and_existing_owners(self, db_session):
        """Test creating an assistant with mix of new and existing owners."""  # Arrange
        assistant_repo = AssistantRepository(db_session)
        await assistant_repo.create(
            hierarchical_access=["ITM-TEMP"], owner_ids=["existing_user"]
        )
        await db_session.commit()

        # Act
        assistant = await assistant_repo.create(
            hierarchical_access=["ITM-TEST"], owner_ids=["existing_user", "new_user"]
        )
        await db_session.commit()  # Assert
        result = await assistant_repo.get_with_owners(assistant.id)
        assert len(result.owners) == 2
        owner_ids = [owner.lhmobjektID for owner in result.owners]
        assert "existing_user" in owner_ids
        assert "new_user" in owner_ids

    async def test_update_assistant_hierarchical_access(
        self, db_session, sample_assistant_data
    ):
        """Test updating assistant's hierarchical access."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()  # Act
        updated = await assistant_repo.update(
            assistant.id, hierarchical_access=["ITM-NEW"]
        )
        await db_session.commit()

        # Assert
        assert updated is not None
        assert updated.hierarchical_access == ["ITM-NEW"]

    async def test_update_assistant_owners(self, db_session, sample_assistant_data):
        """Test updating assistant's owners."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        # Act
        updated = await assistant_repo.update(
            assistant.id,
            owner_ids=["new_user1", "new_user2", "new_user3"],
        )
        await db_session.commit()

        # Assert
        assert updated is not None
        result = await assistant_repo.get_with_owners(updated.id)
        assert len(result.owners) == 3
        owner_ids = [owner.lhmobjektID for owner in result.owners]
        assert "new_user1" in owner_ids
        assert "new_user2" in owner_ids
        assert "new_user3" in owner_ids

    async def test_update_assistant_clear_owners(
        self, db_session, sample_assistant_data
    ):
        """Test clearing assistant's owners."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        # Act
        updated = await assistant_repo.update(assistant.id, owner_ids=[])
        await db_session.commit()  # Assert
        assert updated is not None
        owners_count = await assistant_repo.get_owners_count(updated.id)
        assert owners_count == 0

    async def test_update_non_existing_assistant(self, db_session):
        """Test updating a non-existing assistant returns None."""  # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Act
        result = await assistant_repo.update(999, hierarchical_access=["TEST"])

        # Assert
        assert result is None

    async def test_create_assistant_version(
        self, db_session, sample_assistant_data, sample_assistant_version_data
    ):
        """Test creating a new assistant version."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        # Act
        version = await assistant_repo.create_assistant_version(
            assistant=assistant,
            name=sample_assistant_version_data.name,
            system_prompt=sample_assistant_version_data.system_prompt,
            description=sample_assistant_version_data.description,
            temperature=sample_assistant_version_data.temperature,
            max_output_tokens=sample_assistant_version_data.max_output_tokens,
            examples=sample_assistant_version_data.examples,
            quick_prompts=sample_assistant_version_data.quick_prompts,
            tags=sample_assistant_version_data.tags,
        )
        await db_session.commit()

        # Assert
        assert version is not None
        assert version.version == 1
        assert version.assistant_id == assistant.id
        assert version.name == sample_assistant_version_data.name
        assert version.system_prompt == sample_assistant_version_data.system_prompt
        assert version.temperature == sample_assistant_version_data.temperature

    async def test_create_multiple_assistant_versions(
        self, db_session, sample_assistant_data, sample_assistant_version_data
    ):
        """Test creating multiple versions increments version number."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        # Act
        version1 = await assistant_repo.create_assistant_version(
            assistant=assistant,
            name=sample_assistant_version_data.name,
            system_prompt=sample_assistant_version_data.system_prompt,
            description=sample_assistant_version_data.description,
            temperature=sample_assistant_version_data.temperature,
            max_output_tokens=sample_assistant_version_data.max_output_tokens,
            examples=sample_assistant_version_data.examples,
            quick_prompts=sample_assistant_version_data.quick_prompts,
            tags=sample_assistant_version_data.tags,
        )
        await db_session.commit()

        version2 = await assistant_repo.create_assistant_version(
            assistant=assistant,
            name="Updated Assistant",
            system_prompt="Updated system prompt",
            description="Updated description",
            temperature=0.8,
            max_output_tokens=2000,
            examples=["Updated example"],
            quick_prompts=["Updated prompt"],
            tags=["updated"],
        )
        await db_session.commit()

        # Assert
        assert version1.version == 1
        assert version2.version == 2
        assert version1.assistant_id == assistant.id
        assert version2.assistant_id == assistant.id

    async def test_get_assistant_version(
        self, db_session, sample_assistant_data, sample_assistant_version_data
    ):
        """Test getting a specific assistant version."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        created_version = await assistant_repo.create_assistant_version(
            assistant=assistant,
            name=sample_assistant_version_data.name,
            system_prompt=sample_assistant_version_data.system_prompt,
            description=sample_assistant_version_data.description,
            temperature=sample_assistant_version_data.temperature,
            max_output_tokens=sample_assistant_version_data.max_output_tokens,
            examples=sample_assistant_version_data.examples,
            quick_prompts=sample_assistant_version_data.quick_prompts,
            tags=sample_assistant_version_data.tags,
        )
        await db_session.commit()

        # Act
        result = await assistant_repo.get_assistant_version(assistant.id, 1)

        # Assert
        assert result is not None
        assert result.id == created_version.id
        assert result.version == 1
        assert result.name == sample_assistant_version_data.name

    async def test_get_non_existing_assistant_version(
        self, db_session, sample_assistant_data
    ):
        """Test getting a non-existing assistant version returns None."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
        )
        await db_session.commit()

        # Act
        result = await assistant_repo.get_assistant_version(assistant.id, 999)

        # Assert
        assert result is None

    async def test_get_assistants_by_owner(self, db_session):
        """Test getting assistants by owner."""  # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(
            hierarchical_access=["ITM-TEST1"], owner_ids=["owner1", "owner2"]
        )
        assistant2 = await assistant_repo.create(
            hierarchical_access=["ITM-TEST2"], owner_ids=["owner1"]
        )
        assistant3 = await assistant_repo.create(
            hierarchical_access=["ITM-TEST3"], owner_ids=["owner3"]
        )
        await db_session.commit()

        # Act
        result = await assistant_repo.get_assistants_by_owner("owner1")

        # Assert
        assert len(result) == 2
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids
        assert assistant2.id in assistant_ids
        assert assistant3.id not in assistant_ids

    async def test_get_assistants_by_non_existing_owner(self, db_session):
        """Test getting assistants by non-existing owner returns empty list."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Act
        result = await assistant_repo.get_assistants_by_owner(
            "non_existing_owner"
        )  # Assert
        assert result == []

    async def test_get_all_possible_assistants_for_user_with_department_exact_match(
        self, db_session
    ):
        """Test getting assistants for exact department match."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=["ITM-KM"])
        assistant2 = await assistant_repo.create(hierarchical_access=["ITM-AB"])
        assistant3 = await assistant_repo.create(hierarchical_access=[])
        await db_session.commit()

        # Act
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM"
            )
        )  # Assert
        assert len(result) == 2  # ITM-KM and empty access
        assistant_ids = [a.id for a in result]

        assert assistant1.id in assistant_ids
        assert assistant3.id in assistant_ids
        assert assistant2.id not in assistant_ids

    async def test_get_all_possible_assistants_for_user_with_department_hierarchical(
        self, db_session
    ):
        """Test getting assistants for hierarchical department access."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=["ITM"])
        assistant2 = await assistant_repo.create(hierarchical_access=["ITM-KM"])
        assistant3 = await assistant_repo.create(hierarchical_access=["ITM-AB"])
        await db_session.commit()

        # Act
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM-DI"
            )
        )  # Assert
        assert len(result) == 2  # ITM and ITM-KM
        assistant_ids = [a.id for a in result]

        assert assistant1.id in assistant_ids
        assert assistant2.id in assistant_ids
        assert assistant3.id not in assistant_ids

    async def test_get_all_possible_assistants_for_user_with_department_no_access(
        self, db_session
    ):
        """Test getting assistants when user has no access."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        _assistant1 = await assistant_repo.create(hierarchical_access=["ITM-KM"])
        _assistant2 = await assistant_repo.create(hierarchical_access=["ITM-AB"])
        await db_session.commit()

        # Act
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "DIFFERENT-DEPT"
            )
        )  # Assert
        assert len(result) == 0

    async def test_get_all_possible_assistants_includes_null_hierarchical_access(
        self, db_session
    ):
        """Test that assistants with null/empty hierarchical_access are always included."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=[])
        assistant2 = await assistant_repo.create(hierarchical_access=None)
        assistant3 = await assistant_repo.create(hierarchical_access=["ITM-SPECIFIC"])
        await db_session.commit()

        # Act
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ANY-DEPT"
            )
        )

        # Assert
        assert len(result) == 2  # Empty and None access assistants
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids
        assert assistant2.id in assistant_ids
        assert assistant3.id not in assistant_ids
