"""Unit tests for the AssistantRepository class."""

import asyncio

import pytest
from src.api.api_models import CREATIVITY_HIGH
from src.database import path_matcher
from src.database.assistant_repo import AssistantRepository


@pytest.fixture
def sample_assistant_data():
    """Sample data for assistant creation and updates."""
    return {
        "hierarchical_access": ["ITM-KM"],
        "owner_ids": ["user1", "user2"],
        "is_visible": True,
    }


@pytest.fixture
def directory_index_multiple_paths(monkeypatch):
    """Provide a minimal directory index covering the departments used in the multi-path test.

    This avoids relying on the full LDAP-derived directory tree while still using the
    directory-index-based matcher (no legacy fallback).
    """

    tree = [
        {
            "shortname": "itm-km",
            "name": "ITM-KM",
            "children": [
                {"shortname": "itm-km-team1", "name": "ITM-KM-TEAM1", "children": []}
            ],
        },
        {"shortname": "HR-DEPT", "name": "HR-DEPT", "children": []},
        {"shortname": "finance", "name": "FINANCE", "children": []},
        {
            "shortname": "ORG",
            "name": "ORG",
            "children": [
                {
                    "shortname": "ORG-DEPT",
                    "name": "ORG-DEPT",
                    "children": [
                        {
                            "shortname": "ORG-DEPT-TEAM",
                            "name": "ORG-DEPT-TEAM",
                            "children": [
                                {
                                    "shortname": "ORG-DEPT-TEAM-GROUP-SUBGROUP",
                                    "name": "ORG-DEPT-TEAM-GROUP-SUBGROUP",
                                    "children": [],
                                }
                            ],
                        }
                    ],
                }
            ],
        },
    ]

    index = path_matcher._build_index(tree)

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    # Clear the cache to ensure the new tree is used
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return index


@pytest.fixture
def directory_index_deep_nesting(monkeypatch):
    """Directory index covering deeply nested ORG hierarchy."""

    tree = [
        {
            "shortname": "org",
            "name": "ORG",
            "children": [
                {
                    "shortname": "org-dept",
                    "name": "ORG-DEPT",
                    "children": [
                        {
                            "shortname": "org-dept-team",
                            "name": "ORG-DEPT-TEAM",
                            "children": [
                                {
                                    "shortname": "org-dept-team-group-subgroup",
                                    "name": "ORG-DEPT-TEAM-GROUP-SUBGROUP",
                                    "children": [],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
    ]

    index = path_matcher._build_index(tree)

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return index


@pytest.fixture
def directory_index_overlapping(monkeypatch):
    """Directory index for overlapping path prefixes (IT, IT-TEAM, IT-T)."""

    tree = [
        {
            "shortname": "it",
            "name": "IT",
            "children": [
                {
                    "shortname": "it-team",
                    "name": "IT-TEAM",
                    "children": [
                        {
                            "shortname": "it-team-member",
                            "name": "IT-TEAM-MEMBER",
                            "children": [],
                        }
                    ],
                }
            ],
        },
        {"shortname": "it-t", "name": "IT-T", "children": []},
    ]

    index = path_matcher._build_index(tree)

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return index


@pytest.fixture
def directory_index_special_characters(monkeypatch):
    """Directory index for paths with dots and special symbols."""

    tree = [
        {
            "shortname": "dept.123",
            "name": "DEPT.123",
            "children": [
                {
                    "shortname": "dept.123-subteam",
                    "name": "DEPT.123-SUBTEAM",
                    "children": [],
                }
            ],
        },
        {"shortname": "dept_special#", "name": "DEPT_SPECIAL#", "children": []},
    ]

    index = path_matcher._build_index(tree)

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return index


@pytest.fixture
def directory_index_many_paths(monkeypatch):
    """Directory index covering DEPT-0 .. DEPT-19 for large-path tests."""

    tree = [
        {"shortname": f"dept-{i}", "name": f"DEPT-{i}", "children": []}
        for i in range(20)
    ]

    index = path_matcher._build_index(tree)

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return index


@pytest.fixture(autouse=True)
def default_directory_tree(monkeypatch):
    """Default directory tree for all tests to prevent Redis calls."""
    tree = [
        {
            "shortname": "itm",
            "name": "ITM",
            "children": [
                {
                    "shortname": "itm-km",
                    "name": "ITM-KM",
                    "children": [
                        {
                            "shortname": "itm-km-di",
                            "name": "ITM-KM-DI",
                            "children": [],
                        },
                        {
                            "shortname": "itm-km-team1",
                            "name": "ITM-KM-TEAM1",
                            "children": [],
                        },
                    ],
                },
                {
                    "shortname": "itm-ab",
                    "name": "ITM-AB",
                    "children": [
                        {"shortname": "itm-ab-di", "name": "ITM-AB-DI", "children": []}
                    ],
                },
                {"shortname": "itm-test", "name": "ITM-TEST", "children": []},
                {"shortname": "itm-test1", "name": "ITM-TEST1", "children": []},
                {"shortname": "itm-test2", "name": "ITM-TEST2", "children": []},
                {"shortname": "itm-test3", "name": "ITM-TEST3", "children": []},
                {"shortname": "itm-temp", "name": "ITM-TEMP", "children": []},
                {"shortname": "itm-new", "name": "ITM-NEW", "children": []},
                {"shortname": "itm-old", "name": "ITM-OLD", "children": []},
            ],
        }
    ]

    async def _fake_get_tree():
        return tree

    monkeypatch.setattr(
        path_matcher.directory_cache, "get_simplified_directory_tree", _fake_get_tree
    )
    monkeypatch.setattr(
        path_matcher, "_INDEX_CACHE", {"index": None, "expires_at": None}
    )
    return tree


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
        assistant_repo = AssistantRepository(db_session)  # Act
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
            is_visible=sample_assistant_data["is_visible"],
        )
        await db_session.commit()  # Assert        assert assistant.id is not None
        assert (
            assistant.hierarchical_access
            == sample_assistant_data["hierarchical_access"]
        )
        assert assistant.is_visible == sample_assistant_data["is_visible"]
        # Use the safe method to check owners
        result = await assistant_repo.get_with_owners(assistant.id)
        assert len(result.owners) == 2
        owner_ids = [owner.user_id for owner in result.owners]
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
        owner_ids = [owner.user_id for owner in result.owners]
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
        owner_ids = [owner.user_id for owner in result.owners]
        assert "new_user1" in owner_ids
        assert "new_user2" in owner_ids
        assert "new_user3" in owner_ids

    async def test_update_assistant_updates_timestamp_on_owner_change(
        self, db_session, sample_assistant_data
    ):
        """Ensure updated_at is bumped when only owners change (no direct column writes)."""
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
            is_visible=True,
        )
        await db_session.commit()

        # Capture original timestamp
        original_updated_at = assistant.updated_at
        assert original_updated_at is not None

        # Small sleep to ensure clock tick difference (especially on fast systems)
        await asyncio.sleep(0.01)

        # Update only owners
        await assistant_repo.update(
            assistant_id=assistant.id,
            owner_ids=["new_owner_a", "new_owner_b"],
        )
        await db_session.commit()

        # Refresh and compare
        refreshed = await assistant_repo.get(assistant.id)
        assert refreshed.updated_at > original_updated_at, (
            f"updated_at not incremented. Before={original_updated_at}, After={refreshed.updated_at}"
        )
        # Sanity: ensure owners actually changed
        owners = await assistant_repo.get_with_owners(assistant.id)
        owner_ids = sorted([o.user_id for o in owners.owners])
        assert owner_ids == ["new_owner_a", "new_owner_b"]

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
            creativity=sample_assistant_version_data.creativity,
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
        assert version.creativity == sample_assistant_version_data.creativity

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
            creativity=sample_assistant_version_data.creativity,
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
            creativity=CREATIVITY_HIGH,
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
            creativity=sample_assistant_version_data.creativity,
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
        # Create some assistants to ensure the database isn't empty
        await assistant_repo.create(
            hierarchical_access=["ITM-TEST1"], owner_ids=["owner1"]
        )
        await assistant_repo.create(
            hierarchical_access=["ITM-TEST2"], owner_ids=["owner2"]
        )
        await db_session.commit()

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

    async def test_get_all_possible_assistants_with_multiple_access_paths(
        self, db_session, directory_index_multiple_paths
    ):
        """Test that assistants with multiple hierarchical access paths work correctly."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        # Assistant with multiple access paths
        assistant1 = await assistant_repo.create(
            hierarchical_access=["ITM-KM", "HR-DEPT", "FINANCE"]
        )
        # Assistant with single access path for comparison
        assistant2 = await assistant_repo.create(hierarchical_access=["MARKETING"])
        await db_session.commit()

        # Act - Test exact match on first path
        result1 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM"
            )
        )
        # Act - Test exact match on second path
        result2 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "HR-DEPT"
            )
        )
        # Act - Test hierarchical match on first path
        result3 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM-TEAM1"
            )
        )
        # Act - Test no match
        result4 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "IT-OTHER"
            )
        )

        # Assert
        assert len(result1) == 1
        assert len(result2) == 1
        assert len(result3) == 1
        assert len(result4) == 0
        assert assistant1.id in [a.id for a in result1]
        assert assistant1.id in [a.id for a in result2]
        assert assistant1.id in [a.id for a in result3]
        assert assistant2.id not in [a.id for a in result1]
        assert assistant2.id not in [a.id for a in result2]
        assert assistant2.id not in [a.id for a in result3]

    async def test_hierarchical_access_with_deep_nesting(
        self, db_session, directory_index_deep_nesting
    ):
        """Test hierarchical access with deeply nested department structures."""
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=["ORG"])
        assistant2 = await assistant_repo.create(hierarchical_access=["ORG-DEPT"])
        assistant3 = await assistant_repo.create(hierarchical_access=["ORG-DEPT-TEAM"])
        await db_session.commit()

        # Act - Test with deeply nested department
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ORG-DEPT-TEAM-GROUP-SUBGROUP"
            )
        )

        # Assert - All ancestors in the hierarchy should match
        assert len(result) == 3
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids  # ORG matches
        assert assistant2.id in assistant_ids  # ORG-DEPT matches
        assert assistant3.id in assistant_ids  # ORG-DEPT-TEAM matches

    async def test_hierarchical_access_with_overlapping_paths(
        self, db_session, directory_index_overlapping
    ):
        """Test hierarchical access with overlapping path prefixes."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=["IT"])
        assistant2 = await assistant_repo.create(hierarchical_access=["IT-TEAM"])
        # This one has a path that starts with the same chars but isn't hierarchically related
        assistant3 = await assistant_repo.create(hierarchical_access=["IT-T"])
        await db_session.commit()

        # Act - Test with department that should match assistant1 and assistant2 but not assistant3
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "IT-TEAM-MEMBER"
            )
        )

        # Assert - Only true hierarchical ancestors should match
        assert len(result) == 2
        assistant_ids = [a.id for a in result]
        assert assistant1.id in assistant_ids  # IT matches IT-TEAM-MEMBER
        assert assistant2.id in assistant_ids  # IT-TEAM matches IT-TEAM-MEMBER
        assert (
            assistant3.id not in assistant_ids
        )  # IT-T should not match IT-TEAM-MEMBER

    async def test_hierarchical_access_with_special_characters(
        self, db_session, directory_index_special_characters
    ):
        """Test hierarchical access with special characters in department names."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        # Create assistants with special characters in paths
        assistant1 = await assistant_repo.create(hierarchical_access=["DEPT.123"])
        assistant2 = await assistant_repo.create(hierarchical_access=["DEPT_SPECIAL#"])
        await db_session.commit()

        # Act - Test exact matches with special characters
        result1 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "DEPT.123"
            )
        )
        result2 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "DEPT_SPECIAL#"
            )
        )
        # Test hierarchical matches with special characters
        result3 = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "DEPT.123-SUBTEAM"
            )
        )

        # Assert
        assert len(result1) == 1
        assert len(result2) == 1
        assert len(result3) == 1
        assert assistant1.id in [a.id for a in result1]
        assert assistant2.id in [a.id for a in result2]
        assert assistant1.id in [a.id for a in result3]

    async def test_hierarchical_access_with_large_number_of_paths(
        self, db_session, directory_index_many_paths
    ):
        """Test hierarchical access with a large number of access paths."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        # Create an assistant with many access paths
        many_paths = [f"DEPT-{i}" for i in range(20)]  # 20 different departments
        assistant = await assistant_repo.create(hierarchical_access=many_paths)
        await db_session.commit()

        # Act - Test matching against various departments
        results = []
        for i in range(0, 20, 5):  # Test a sample of departments
            dept = f"DEPT-{i}"
            result = await assistant_repo.get_all_possible_assistants_for_user_with_department(
                dept
            )
            results.append((dept, result))

        # Assert - Each department should match
        for dept, result in results:
            assert len(result) == 1, f"Department {dept} should match"
            assert assistant.id in [a.id for a in result]

    # Subscription tests
    async def test_create_subscription(self, db_session):
        """Test creating a subscription for a user to an assistant."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "test_user"

        # Act
        subscription = await assistant_repo.create_subscription(assistant.id, user_id)
        await db_session.commit()

        # Assert
        assert subscription is not None
        assert subscription.assistant_id == assistant.id
        assert subscription.user_id == user_id

        # Verify using is_user_subscribed
        is_subscribed = await assistant_repo.is_user_subscribed(assistant.id, user_id)
        assert is_subscribed is True

    async def test_is_user_subscribed_when_not_subscribed(self, db_session):
        """Test that is_user_subscribed returns False when user is not subscribed."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "nonsubscribed_user"

        # Act
        is_subscribed = await assistant_repo.is_user_subscribed(assistant.id, user_id)

        # Assert
        assert is_subscribed is False

    async def test_remove_subscription(self, db_session):
        """Test removing a subscription."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "test_user"
        await assistant_repo.create_subscription(assistant.id, user_id)
        await db_session.commit()

        # Verify subscription exists
        is_subscribed_before = await assistant_repo.is_user_subscribed(
            assistant.id, user_id
        )
        assert is_subscribed_before is True

        # Act
        removed = await assistant_repo.remove_subscription(assistant.id, user_id)
        await db_session.commit()

        # Assert
        assert removed is True

        # Verify subscription is gone
        is_subscribed_after = await assistant_repo.is_user_subscribed(
            assistant.id, user_id
        )
        assert is_subscribed_after is False

    async def test_remove_nonexistent_subscription(self, db_session):
        """Test removing a subscription that doesn't exist."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "nonexistent_user"

        # Act
        removed = await assistant_repo.remove_subscription(assistant.id, user_id)
        await db_session.commit()

        # Assert
        assert removed is False

    async def test_get_user_subscriptions(self, db_session):
        """Test getting all assistants a user has subscribed to."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant1 = await assistant_repo.create(hierarchical_access=["ITM-TEST1"])
        assistant2 = await assistant_repo.create(hierarchical_access=["ITM-TEST2"])
        assistant3 = await assistant_repo.create(hierarchical_access=["ITM-TEST3"])
        await db_session.commit()

        user_id = "test_user"

        # Subscribe to two assistants
        await assistant_repo.create_subscription(assistant1.id, user_id)
        await assistant_repo.create_subscription(assistant3.id, user_id)
        await db_session.commit()

        # Act
        subscribed_assistants = await assistant_repo.get_user_subscriptions(user_id)

        # Assert
        assert len(subscribed_assistants) == 2

        assistant_ids = [a.id for a in subscribed_assistants]
        assert assistant1.id in assistant_ids
        assert assistant3.id in assistant_ids
        assert assistant2.id not in assistant_ids

    async def test_get_user_subscriptions_no_subscriptions(self, db_session):
        """Test getting subscriptions for a user with no subscriptions."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        await assistant_repo.create(hierarchical_access=["ITM-TEST1"])
        await db_session.commit()

        user_id = "user_with_no_subscriptions"

        # Act
        subscribed_assistants = await assistant_repo.get_user_subscriptions(user_id)

        # Assert
        assert len(subscribed_assistants) == 0

    async def test_multiple_users_subscribed_to_same_assistant(self, db_session):
        """Test multiple users subscribing to the same assistant."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id1 = "user1"
        user_id2 = "user2"

        # Act
        await assistant_repo.create_subscription(assistant.id, user_id1)
        await assistant_repo.create_subscription(assistant.id, user_id2)
        await db_session.commit()

        # Assert
        is_user1_subscribed = await assistant_repo.is_user_subscribed(
            assistant.id, user_id1
        )
        is_user2_subscribed = await assistant_repo.is_user_subscribed(
            assistant.id, user_id2
        )

        assert is_user1_subscribed is True
        assert is_user2_subscribed is True

        # Check get_user_subscriptions for both users
        user1_assistants = await assistant_repo.get_user_subscriptions(user_id1)
        user2_assistants = await assistant_repo.get_user_subscriptions(user_id2)

        assert len(user1_assistants) == 1
        assert len(user2_assistants) == 1
        assert user1_assistants[0].id == assistant.id
        assert user2_assistants[0].id == assistant.id

    async def test_create_assistant_with_visibility(self, db_session):
        """Test creating an assistant with specified visibility."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Act - Create assistant with is_visible=False
        assistant = await assistant_repo.create(
            hierarchical_access=["ITM-TEST"], is_visible=False
        )
        await db_session.commit()

        # Assert
        assert assistant.id is not None
        assert assistant.is_visible is False

        # Act - Create another assistant with default visibility (True)
        assistant_default = await assistant_repo.create(
            hierarchical_access=["ITM-TEST2"]
        )
        await db_session.commit()

        # Assert
        assert assistant_default.id is not None
        assert assistant_default.is_visible is True

    async def test_update_assistant_visibility(self, db_session):
        """Test updating assistant's visibility."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=["ITM-TEST"], is_visible=True
        )
        await db_session.commit()
        assert assistant.is_visible is True

        # Act - Update to hidden
        updated = await assistant_repo.update(assistant.id, is_visible=False)
        await db_session.commit()

        # Assert
        assert updated is not None
        assert updated.is_visible is False

        # Act - Update back to visible
        updated_again = await assistant_repo.update(assistant.id, is_visible=True)
        await db_session.commit()

        # Assert
        assert updated_again is not None
        assert updated_again.is_visible is True

    async def test_get_all_possible_assistants_respects_visibility(self, db_session):
        """Test that get_all_possible_assistants_for_user_with_department filters by visibility."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)

        # Create visible assistants
        visible_assistant1 = await assistant_repo.create(
            hierarchical_access=["ITM-KM"], is_visible=True
        )
        visible_assistant2 = await assistant_repo.create(
            hierarchical_access=[],  # Empty access = available to all departments
            is_visible=True,
        )

        # Create hidden assistants
        hidden_assistant1 = await assistant_repo.create(
            hierarchical_access=["ITM-KM"], is_visible=False
        )
        hidden_assistant2 = await assistant_repo.create(
            hierarchical_access=[],  # Empty access but hidden
            is_visible=False,
        )

        await db_session.commit()

        # Act - Test with department that matches all access patterns
        result = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM"
            )
        )

        # Assert - Only visible assistants should be returned
        assert len(result) == 2
        assistant_ids = [a.id for a in result]

        # Visible assistants should be included
        assert visible_assistant1.id in assistant_ids
        assert visible_assistant2.id in assistant_ids

        # Hidden assistants should be excluded
        assert hidden_assistant1.id not in assistant_ids
        assert hidden_assistant2.id not in assistant_ids

    async def test_update_assistant_multiple_properties_with_visibility(
        self, db_session
    ):
        """Test updating multiple assistant properties including visibility."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=["ITM-OLD"], owner_ids=["owner1"], is_visible=True
        )
        await db_session.commit()

        # Act - Update multiple properties
        updated = await assistant_repo.update(
            assistant_id=assistant.id,
            hierarchical_access=["ITM-NEW"],
            owner_ids=["owner2", "owner3"],
            is_visible=False,
        )
        await db_session.commit()

        # Assert - All properties should be updated
        assert updated is not None
        assert updated.hierarchical_access == ["ITM-NEW"]
        assert updated.is_visible is False

        # Check owners were updated too
        result = await assistant_repo.get_with_owners(updated.id)
        owner_ids = [owner.user_id for owner in result.owners]
        assert len(owner_ids) == 2
        assert "owner2" in owner_ids
        assert "owner3" in owner_ids
        assert "owner1" not in owner_ids

    async def test_update_assistant_only_visibility(
        self, db_session, sample_assistant_data
    ):
        """Test updating only assistant visibility without changing other properties."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(
            hierarchical_access=sample_assistant_data["hierarchical_access"],
            owner_ids=sample_assistant_data["owner_ids"],
            is_visible=True,
        )
        await db_session.commit()

        original_access = assistant.hierarchical_access.copy()

        # Get original owners for comparison
        original_assistant = await assistant_repo.get_with_owners(assistant.id)
        original_owner_ids = [owner.user_id for owner in original_assistant.owners]

        # Act - Update only visibility
        updated = await assistant_repo.update(
            assistant_id=assistant.id, is_visible=False
        )
        await db_session.commit()

        # Assert - Only visibility should change
        assert updated is not None
        assert updated.is_visible is False
        assert updated.hierarchical_access == original_access

        # Check owners remain unchanged
        updated_assistant = await assistant_repo.get_with_owners(updated.id)
        updated_owner_ids = [owner.user_id for owner in updated_assistant.owners]
        assert sorted(updated_owner_ids) == sorted(original_owner_ids)

    async def test_direct_access_to_hidden_assistant(self, db_session):
        """Test that hidden assistants can be accessed directly by ID."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        hidden_assistant = await assistant_repo.create(
            hierarchical_access=["ITM-KM"], is_visible=False
        )
        await db_session.commit()

        # Act - Direct access by ID
        result = await assistant_repo.get(hidden_assistant.id)

        # Act - Access through filtering (should be filtered out)
        filtered_results = (
            await assistant_repo.get_all_possible_assistants_for_user_with_department(
                "ITM-KM"
            )
        )

        # Assert
        # Direct access should work
        assert result is not None
        assert result.id == hidden_assistant.id
        assert result.is_visible is False

        # Filtering should exclude the assistant
        assert len(filtered_results) == 0

    # Subscription count tests
    async def test_create_subscription_increments_count(self, db_session):
        """Test creating a subscription increments the subscription count."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "test_user"

        # Verify initial count is 0
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 0

        # Act
        subscription = await assistant_repo.create_subscription(assistant.id, user_id)
        await db_session.commit()

        # Assert
        assert subscription is not None
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 1

    async def test_remove_subscription_decrements_count(self, db_session):
        """Test removing a subscription decrements the subscription count."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "test_user"
        await assistant_repo.create_subscription(assistant.id, user_id)
        await db_session.commit()

        # Verify count is 1
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 1

        # Act
        removed = await assistant_repo.remove_subscription(assistant.id, user_id)
        await db_session.commit()

        # Assert
        assert removed is True
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 0

    async def test_multiple_subscriptions_count_correctly(self, db_session):
        """Test that multiple subscriptions are counted correctly."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        # Act - Add multiple subscriptions
        await assistant_repo.create_subscription(assistant.id, "user1")
        await assistant_repo.create_subscription(assistant.id, "user2")
        await assistant_repo.create_subscription(assistant.id, "user3")
        await db_session.commit()

        # Assert
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 3

        # Remove one subscription
        await assistant_repo.remove_subscription(assistant.id, "user2")
        await db_session.commit()

        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 2

    async def test_duplicate_subscription_does_not_affect_count(self, db_session):
        """Test that attempting to create duplicate subscription doesn't affect count."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        user_id = "test_user"
        await assistant_repo.create_subscription(assistant.id, user_id)
        await db_session.commit()

        await db_session.refresh(assistant)
        initial_count = assistant.subscriptions_count
        assert initial_count == 1

        # Act - Try to create duplicate subscription
        try:
            await assistant_repo.create_subscription(assistant.id, user_id)
            await db_session.commit()
        except Exception:
            # Expected to fail due to unique constraint
            await db_session.rollback()

        # Assert
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 1  # Count should remain unchanged

    async def test_subscription_count_backfill_scenario(self, db_session):
        """Test scenario that simulates what happens after migration backfill."""
        # Arrange
        assistant_repo = AssistantRepository(db_session)
        assistant = await assistant_repo.create(hierarchical_access=["ITM-TEST"])
        await db_session.commit()

        # Simulate existing subscriptions (like after migration backfill)
        from sqlalchemy import insert
        from src.database.database_models import Subscription

        await db_session.execute(
            insert(Subscription).values(
                [
                    {"assistant_id": assistant.id, "user_id": "existing_user1"},
                    {"assistant_id": assistant.id, "user_id": "existing_user2"},
                ]
            )
        )
        assistant.subscriptions_count = 2
        await db_session.commit()

        # Act - Add new subscription (should increment via events)
        await assistant_repo.create_subscription(assistant.id, "new_user")
        await db_session.commit()

        # Assert
        await db_session.refresh(assistant)
        assert assistant.subscriptions_count == 3
