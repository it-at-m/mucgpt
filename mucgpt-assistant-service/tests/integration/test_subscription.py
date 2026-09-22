"""
Tests for subscription functionality in the AssistantRepository.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from api.exceptions import AssistantUnavailableForUseException
from database.assistant_repo import AssistantRepository
from database.database_models import Subscription


@pytest.mark.asyncio
async def test_create_subscription(test_db_session):
    """Test creating a subscription."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(
        name="Test Assistant", hierarchical_access=[], owner_ids=["owner1"]
    )
    user_id = "user1"

    # Act
    subscription = await repo.create_subscription(assistant.id, user_id)

    # Assert
    assert subscription is not None
    assert subscription.assistant_id == assistant.id
    assert subscription.user_id == user_id

    # Verify in database
    result = await test_db_session.execute(
        select(Subscription).filter(
            Subscription.assistant_id == assistant.id,
            Subscription.user_id == user_id,
        )
    )
    db_subscription = result.scalars().first()
    assert db_subscription is not None


@pytest.mark.asyncio
async def test_subscription_race_rechecks_latest_lifecycle_state(
    test_db_session: AsyncSession, test_db_engine: AsyncEngine
) -> None:
    """A stale active check in one session cannot bypass a lifecycle update."""
    setup_repo = AssistantRepository(test_db_session)
    assistant = await setup_repo.create(
        name="Race assistant", hierarchical_access=[], owner_ids=["owner1"]
    )
    await setup_repo.create_assistant_version(
        assistant,
        description="",
        system_prompt="Be helpful.",
        creativity="medium",
        state="active",
    )
    await test_db_session.commit()

    # Use a second session to model the subscriber's request transaction.
    from sqlalchemy.ext.asyncio import async_sessionmaker

    session_factory = async_sessionmaker(test_db_engine, expire_on_commit=False)
    async with session_factory() as subscriber_session:
        subscriber_repo = AssistantRepository(subscriber_session)
        stale_check = await subscriber_repo.get_latest_version(assistant.id)
        assert stale_check is not None
        assert stale_check.state == "active"

        await setup_repo.create_assistant_version(
            assistant,
            description="",
            system_prompt="Be helpful.",
            creativity="medium",
            state="pending_legal_review",
        )
        await test_db_session.commit()

        with pytest.raises(AssistantUnavailableForUseException) as error:
            await subscriber_repo.create_subscription(assistant.id, "user1")

        assert error.value.status_code == 451
        await subscriber_session.rollback()


@pytest.mark.asyncio
async def test_is_user_subscribed(test_db_session):
    """Test checking if a user is subscribed to an assistant."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(
        name="Test Assistant", hierarchical_access=[], owner_ids=["owner1"]
    )
    user_id = "user1"
    await repo.create_subscription(assistant.id, user_id)

    # Act
    is_subscribed = await repo.is_user_subscribed(assistant.id, user_id)
    is_other_subscribed = await repo.is_user_subscribed(assistant.id, "other_user")

    # Assert
    assert is_subscribed is True
    assert is_other_subscribed is False


@pytest.mark.asyncio
async def test_remove_subscription(test_db_session):
    """Test removing a subscription."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant = await repo.create(
        name="Test Assistant", hierarchical_access=[], owner_ids=["owner1"]
    )
    user_id = "user1"
    await repo.create_subscription(assistant.id, user_id)

    # Act
    removed = await repo.remove_subscription(assistant.id, user_id)

    # Assert
    assert removed is True
    is_subscribed = await repo.is_user_subscribed(assistant.id, user_id)
    assert is_subscribed is False


@pytest.mark.asyncio
async def test_get_user_subscriptions(test_db_session):
    """Test getting all assistants a user has subscribed to."""
    # Arrange
    repo = AssistantRepository(test_db_session)
    assistant1 = await repo.create(
        name="Assistant 1", hierarchical_access=[], owner_ids=["owner1"]
    )
    assistant2 = await repo.create(
        name="Assistant 2", hierarchical_access=[], owner_ids=["owner2"]
    )
    user_id = "user1"

    await repo.create_subscription(assistant1.id, user_id)
    await repo.create_subscription(assistant2.id, user_id)

    # Act
    subscribed_assistants = await repo.get_user_subscriptions(user_id)

    # Assert
    assert len(subscribed_assistants) == 2
    assert {a.id for a in subscribed_assistants} == {assistant1.id, assistant2.id}
