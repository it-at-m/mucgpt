"""
Tests for subscription functionality in the AssistantRepository.
"""

import pytest
from sqlalchemy import select

from database.assistant_repo import AssistantRepository
from database.database_models import Subscription


@pytest.mark.asyncio
async def test_create_subscription(test_db_session):
    """Test creating a subscription."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(hierarchical_access=[], owner_ids=["owner1"])
    lhmobjektID = "user1"

    # Act
    subscription = await repo.create_subscription(assistant.id, lhmobjektID)

    # Assert
    assert subscription is not None
    assert subscription.assistant_id == assistant.id
    assert subscription.lhmobjektID == lhmobjektID

    # Verify in database
    result = await test_db_session.execute(
        select(Subscription).filter(
            Subscription.assistant_id == assistant.id,
            Subscription.lhmobjektID == lhmobjektID,
        )
    )
    db_subscription = result.scalars().first()
    assert db_subscription is not None


@pytest.mark.asyncio
async def test_is_user_subscribed(test_db_session):
    """Test checking if a user is subscribed to an assistant."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(hierarchical_access=[], owner_ids=["owner1"])
    lhmobjektID = "user1"
    await repo.create_subscription(assistant.id, lhmobjektID)

    # Act
    is_subscribed = await repo.is_user_subscribed(assistant.id, lhmobjektID)
    is_other_subscribed = await repo.is_user_subscribed(assistant.id, "other_user")

    # Assert
    assert is_subscribed is True
    assert is_other_subscribed is False


@pytest.mark.asyncio
async def test_remove_subscription(test_db_session):
    """Test removing a subscription."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(hierarchical_access=[], owner_ids=["owner1"])
    lhmobjektID = "user1"
    await repo.create_subscription(assistant.id, lhmobjektID)

    # Act
    removed = await repo.remove_subscription(assistant.id, lhmobjektID)

    # Assert
    assert removed is True
    is_subscribed = await repo.is_user_subscribed(assistant.id, lhmobjektID)
    assert is_subscribed is False


@pytest.mark.asyncio
async def test_get_user_subscriptions(test_db_session):
    """Test getting all assistants a user has subscribed to."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant1 = await repo.create(hierarchical_access=[], owner_ids=["owner1"])
    assistant2 = await repo.create(hierarchical_access=[], owner_ids=["owner2"])
    lhmobjektID = "user1"

    await repo.create_subscription(assistant1.id, lhmobjektID)
    await repo.create_subscription(assistant2.id, lhmobjektID)

    # Act
    subscribed_assistants = await repo.get_user_subscriptions(lhmobjektID)

    # Assert
    assert len(subscribed_assistants) == 2
    assert {a.id for a in subscribed_assistants} == {assistant1.id, assistant2.id}
