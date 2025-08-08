import pytest
from sqlalchemy import select
from src.api.api_models import (
    AssistantCreate,
    AssistantResponse,
    StatusResponse,
    SubscriptionResponse,
)
from src.config.settings import get_settings
from src.database.assistant_repo import AssistantRepository
from src.database.database_models import Subscription
from src.database.session import create_database_url, get_engine_and_factory

# Headers for authentication
headers = {
    "Authorization": "Bearer dummy_access_token",
}


# Helper function to create a new database session
async def create_new_session():
    """Create a new database session for testing across session boundaries."""

    settings = get_settings()
    database_url = str(create_database_url(settings))
    _, factory = get_engine_and_factory(database_url)
    return factory()


@pytest.mark.integration
def test_get_user_bots_empty(test_client):
    """Test getting bots for a user when they have none."""
    response = test_client.get("/user/bots", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert response_data == []


@pytest.mark.integration
def test_get_user_bots_success(test_client):
    """Test successfully getting bots owned by the authenticated user."""
    # Create a bot owned by the default test user "test_user_123"
    assistant_data = AssistantCreate(
        name="My Test Bot",
        system_prompt="A bot for testing.",
        owner_ids=["test_user_123"],
    )
    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = (
        create_response.json()
    )  # Create another bot not owned by the test user
    other_assistant_data = AssistantCreate(
        name="Other User's Bot",
        system_prompt="This bot is not mine.",
        owner_ids=["other_user_456"],  # test_user_123 will be auto-added as owner
    )
    create_response_other = test_client.post(
        "/bot/create", json=other_assistant_data.model_dump(), headers=headers
    )
    assert create_response_other.status_code == 200

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    # Validate response structure
    assert isinstance(user_bots, list)

    # Both bots should be returned since test_user_123 is auto-added as owner to all bots
    assert len(user_bots) == 2

    # Find the specific bot we're testing
    my_test_bot = None
    for bot in user_bots:
        if bot["latest_version"]["name"] == "My Test Bot":
            my_test_bot = bot
            break

    assert my_test_bot is not None, "Could not find 'My Test Bot' in response"

    # Validate using Pydantic models
    assistant_response = AssistantResponse.model_validate(my_test_bot)
    assert assistant_response.id == created_bot["id"]
    assert assistant_response.latest_version.name == "My Test Bot"
    assert "test_user_123" in assistant_response.owner_ids


@pytest.mark.integration
def test_get_user_bots_multiple_owned(test_client):
    """Test getting multiple bots owned by the same user."""
    # Create two bots for the same user
    bot1_data = AssistantCreate(
        name="Bot One", system_prompt="First bot.", owner_ids=["test_user_123"]
    )
    bot2_data = AssistantCreate(
        name="Bot Two", system_prompt="Second bot.", owner_ids=["test_user_123"]
    )

    test_client.post("/bot/create", json=bot1_data.model_dump(), headers=headers)
    test_client.post("/bot/create", json=bot2_data.model_dump(), headers=headers)

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    # Validate response structure
    assert isinstance(user_bots, list)
    assert len(user_bots) == 2

    # Validate each bot using Pydantic models
    for bot in user_bots:
        assistant_response = AssistantResponse.model_validate(bot)
        assert assistant_response.id is not None
        assert assistant_response.latest_version is not None
        assert "test_user_123" in assistant_response.owner_ids

    bot_names = {bot["latest_version"]["name"] for bot in user_bots}
    assert {"Bot One", "Bot Two"} == bot_names


@pytest.mark.integration
def test_get_user_bots_owner_filter_is_strict(test_client):
    """Test that users get bots where they are owners (including auto-added ownership)."""  # Create assistant with hierarchical access that matches the test user's department
    assistant_data = AssistantCreate(
        name="Hierarchical Bot",
        system_prompt="A bot accessible hierarchically.",
        owner_ids=["another_user"],
        hierarchical_access=["IT-Test-Department"],  # test_user_123 has this role
    )
    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200

    # User should get this bot because test_user_123 is auto-added as owner during creation
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert (
        len(response_data) == 1
    )  # Should contain the bot because test_user_123 is auto-added as owner

    # Validate that test_user_123 is indeed an owner
    assistant_response = AssistantResponse.model_validate(response_data[0])
    assert "test_user_123" in assistant_response.owner_ids
    assert "another_user" in assistant_response.owner_ids


@pytest.mark.integration
def test_get_user_bots_with_complex_data(test_client):
    """Test getting user bots with complex data structures."""
    # Create a bot with complex data (tools, examples, quick prompts, etc.)
    complex_assistant_data = AssistantCreate(
        name="Complex User Bot",
        description="A complex bot with various features",
        system_prompt="You are a complex assistant.",
        owner_ids=["test_user_123"],
        hierarchical_access=["IT", "MANAGEMENT"],
        temperature=0.8,
        max_output_tokens=2000,
        examples=[
            {"text": "Example 1", "value": "First example value"},
            {"text": "Example 2", "value": "Second example value"},
        ],
        quick_prompts=[
            {
                "label": "Summarize",
                "prompt": "Please summarize this",
                "tooltip": "Quick summary",
            }
        ],
        tags=["complex", "user-owned"],
        tools=[{"id": "WEB_SEARCH", "config": {"max_results": 10}}],
    )

    create_response = test_client.post(
        "/bot/create", json=complex_assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    assert len(user_bots) == 1

    # Validate complex data using Pydantic models
    assistant_response = AssistantResponse.model_validate(user_bots[0])
    assert assistant_response.latest_version.name == "Complex User Bot"
    assert (
        assistant_response.latest_version.description
        == "A complex bot with various features"
    )
    assert assistant_response.latest_version.temperature == 0.8
    assert assistant_response.latest_version.max_output_tokens == 2000
    assert len(assistant_response.latest_version.examples) == 2
    assert len(assistant_response.latest_version.quick_prompts) == 1
    assert assistant_response.latest_version.tags == ["complex", "user-owned"]
    assert set(assistant_response.hierarchical_access) == {"IT", "MANAGEMENT"}


@pytest.mark.integration
def test_get_user_bots_response_format(test_client):
    """Test that the response format is correct."""
    # Create a bot for testing
    assistant_data = AssistantCreate(
        name="Format Test Bot",
        system_prompt="You are a format test bot.",
        owner_ids=["test_user_123"],
    )

    test_client.post("bot/create", json=assistant_data.model_dump(), headers=headers)

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert len(response_data) == 1

    # Validate each bot structure
    bot = response_data[0]
    assistant_response = AssistantResponse.model_validate(bot)

    # Check that all required fields are present
    assert assistant_response.id is not None
    assert isinstance(assistant_response.id, str)
    assert assistant_response.created_at is not None
    assert assistant_response.updated_at is not None
    assert isinstance(assistant_response.hierarchical_access, list)
    assert isinstance(assistant_response.owner_ids, list)
    assert assistant_response.latest_version is not None

    # Check latest_version structure
    latest_version = assistant_response.latest_version
    assert latest_version.id is not None
    assert latest_version.version is not None
    assert latest_version.created_at is not None
    assert latest_version.name is not None
    assert latest_version.system_prompt is not None
    assert isinstance(latest_version.examples, list)
    assert isinstance(latest_version.quick_prompts, list)
    assert isinstance(latest_version.tags, list)


@pytest.mark.integration
def test_get_user_bots_with_unicode_content(test_client):
    """Test getting user bots with unicode characters."""
    assistant_data = AssistantCreate(
        name="Unicode Bot 🤖",
        description="Bot with émojis and spëcial characters: 中文",
        system_prompt="You are a helpful assistant. Vous êtes très utile! 您好!",
        owner_ids=["test_user_123"],
    )

    test_client.post("bot/create", json=assistant_data.model_dump(), headers=headers)

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    assert len(user_bots) == 1

    # Validate unicode content
    assistant_response = AssistantResponse.model_validate(user_bots[0])
    assert assistant_response.latest_version.name == "Unicode Bot 🤖"
    assert (
        assistant_response.latest_version.description
        == "Bot with émojis and spëcial characters: 中文"
    )
    assert (
        assistant_response.latest_version.system_prompt
        == "You are a helpful assistant. Vous êtes très utile! 您好!"
    )


@pytest.mark.integration
def test_get_user_bots_multiple_owners(test_client):
    """Test getting bots where user is one of multiple owners."""
    # Create a bot with multiple owners including the test user
    assistant_data = AssistantCreate(
        name="Multi-Owner Bot",
        system_prompt="You are a multi-owner bot.",
        owner_ids=["test_user_123", "other_user_456", "third_user_789"],
    )

    test_client.post("bot/create", json=assistant_data.model_dump(), headers=headers)

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    assert len(user_bots) == 1

    # Validate ownership
    assistant_response = AssistantResponse.model_validate(user_bots[0])
    assert "test_user_123" in assistant_response.owner_ids
    assert "other_user_456" in assistant_response.owner_ids
    assert "third_user_789" in assistant_response.owner_ids
    assert len(assistant_response.owner_ids) == 3


@pytest.mark.integration
def test_get_user_bots_empty_optional_fields(test_client):
    """Test getting bots with empty optional fields."""
    assistant_data = AssistantCreate(
        name="Minimal Bot",
        system_prompt="You are a minimal bot.",
        owner_ids=["test_user_123"],
        description="",
        examples=[],
        quick_prompts=[],
        tags=[],
        tools=[],
        hierarchical_access=[],
    )

    test_client.post("bot/create", json=assistant_data.model_dump(), headers=headers)

    # Get user's bots
    response = test_client.get("user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    assert len(user_bots) == 1

    # Validate empty fields
    assistant_response = AssistantResponse.model_validate(user_bots[0])
    assert assistant_response.latest_version.description == ""
    assert assistant_response.latest_version.examples == []
    assert assistant_response.latest_version.quick_prompts == []
    assert assistant_response.latest_version.tags == []
    assert assistant_response.hierarchical_access == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_user_bots_access_control_repo(test_client, test_db_session):
    """Test that users can only access bots they own when using repository-created data."""
    # Create assistants using repository directly to control ownership precisely

    assistant_repo = AssistantRepository(test_db_session)

    # Create assistant owned by test_user_123 (should be returned)
    assistant_owned = await assistant_repo.create(
        hierarchical_access=["IT-Test-Department"],
        owner_ids=["test_user_123"],
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_owned,
        name="My Owned Assistant",
        system_prompt="You are my owned assistant.",
        description="This bot is owned by test_user_123",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["owned"],
    )

    # Create assistant owned by different user (should NOT be returned)
    assistant_not_owned = await assistant_repo.create(
        hierarchical_access=["IT-Test-Department"],  # Same department access
        owner_ids=["other_user_456"],  # Different owner
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_not_owned,
        name="Not My Assistant",
        system_prompt="You are not my assistant.",
        description="This bot is owned by other_user_456",
        temperature=0.8,
        max_output_tokens=1500,
        examples=[],
        quick_prompts=[],
        tags=["not-owned"],
    )

    # Create assistant with multiple owners including test_user_123 (should be returned)
    assistant_co_owned = await assistant_repo.create(
        hierarchical_access=["IT-Test-Department"],
        owner_ids=["test_user_123", "other_user_456", "third_user_789"],
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_co_owned,
        name="Co-Owned Assistant",
        system_prompt="You are a co-owned assistant.",
        description="This bot has multiple owners including test_user_123",
        temperature=0.5,
        max_output_tokens=800,
        examples=[],
        quick_prompts=[],
        tags=["co-owned"],
    )

    # Create assistant with no owners (should NOT be returned)
    assistant_no_owners = await assistant_repo.create(
        hierarchical_access=["IT-Test-Department"],
        owner_ids=[],
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_no_owners,
        name="Orphaned Assistant",
        system_prompt="You are an orphaned assistant.",
        description="This bot has no owners",
        temperature=0.6,
        max_output_tokens=900,
        examples=[],
        quick_prompts=[],
        tags=["orphaned"],
    )

    await test_db_session.commit()

    # Get user's bots - should only return bots where test_user_123 is an owner
    response = test_client.get("/user/bots", headers=headers)
    assert response.status_code == 200

    user_bots = response.json()
    assert isinstance(user_bots, list)

    # Should return exactly 2 bots: assistant_owned and assistant_co_owned
    assert len(user_bots) == 2

    # Validate the returned bots
    returned_names = {bot["latest_version"]["name"] for bot in user_bots}
    assert "My Owned Assistant" in returned_names
    assert "Co-Owned Assistant" in returned_names
    assert "Not My Assistant" not in returned_names
    assert "Orphaned Assistant" not in returned_names

    # Verify ownership for each returned bot
    for bot in user_bots:
        assistant_response = AssistantResponse.model_validate(bot)
        assert "test_user_123" in assistant_response.owner_ids

        # Verify specific bots
        if assistant_response.latest_version.name == "My Owned Assistant":
            assert assistant_response.owner_ids == ["test_user_123"]
        elif assistant_response.latest_version.name == "Co-Owned Assistant":
            assert "test_user_123" in assistant_response.owner_ids
            assert "other_user_456" in assistant_response.owner_ids
            assert "third_user_789" in assistant_response.owner_ids
            assert len(assistant_response.owner_ids) == 3


@pytest.mark.integration
def test_subscribe_to_assistant_success(test_client):
    """Test successfully subscribing to an assistant."""
    # Create an assistant with hierarchical access that matches the test user's department
    assistant_data = AssistantCreate(
        name="Subscribe Test Bot",
        system_prompt="A bot for testing subscriptions.",
        owner_ids=["other_user_456"],  # Not owned by test_user_123
        hierarchical_access=["IT-Test-Department"],  # test_user_123 has this department
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )  # Validate successful subscription
    assert subscribe_response.status_code == 200

    # Validate StatusResponse model
    status_response = StatusResponse.model_validate(subscribe_response.json())
    assert (
        status_response.message == "Successfully subscribed to assistant"
    )  # Verify subscription was created by getting user subscriptions
    subscriptions_response = test_client.get("/user/subscriptions", headers=headers)
    assert subscriptions_response.status_code == 200

    subscriptions = subscriptions_response.json()
    assert len(subscriptions) == 1

    # Validate using SubscriptionResponse model
    subscription_response = SubscriptionResponse.model_validate(subscriptions[0])
    assert subscription_response.id == assistant_id
    assert subscription_response.name == "Subscribe Test Bot"


@pytest.mark.integration
def test_subscribe_to_assistant_already_subscribed(test_client):
    """Test subscribing to an assistant that the user is already subscribed to."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Already Subscribed Bot",
        system_prompt="Testing already subscribed scenario.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Subscribe to the assistant
    first_subscribe = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert first_subscribe.status_code == 200

    # Try to subscribe again
    second_subscribe = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )

    # Should return 409 Conflict
    assert second_subscribe.status_code == 409
    assert "Already subscribed" in second_subscribe.json()["detail"]


@pytest.mark.integration
def test_subscribe_to_nonexistent_assistant(test_client):
    """Test subscribing to an assistant that doesn't exist."""
    # Try to subscribe to a non-existent assistant
    nonexistent_id = "00000000-0000-0000-0000-000000000000"
    response = test_client.post(
        f"/user/subscriptions/{nonexistent_id}", headers=headers
    )

    # Should return 404 Not Found
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.integration
def test_subscribe_to_assistant_no_access(test_client):
    """Test subscribing to an assistant that the user doesn't have access to."""  # Create an assistant with hierarchical access that doesn't match test user's department
    assistant_data = AssistantCreate(
        name="No Access Bot",
        system_prompt="A bot user can't access.",
        owner_ids=["other_user_456"],
        hierarchical_access=["HR-Test"],  # test_user_123 doesn't have this department
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Try to subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )

    # Should return 403 Forbidden
    assert subscribe_response.status_code == 403
    assert "not allowed to access" in subscribe_response.json()["detail"].lower()


@pytest.mark.integration
def test_unsubscribe_from_assistant_success(test_client):
    """Test successfully unsubscribing from an assistant."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Unsubscribe Test Bot",
        system_prompt="A bot for testing unsubscribing.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200  # Verify subscription exists
    subscriptions_before = test_client.get(
        "/user/subscriptions", headers=headers
    ).json()
    assert len(subscriptions_before) == 1

    # Validate using SubscriptionResponse model
    subscription_response = SubscriptionResponse.model_validate(subscriptions_before[0])
    assert subscription_response.id == assistant_id
    assert subscription_response.name == "Unsubscribe Test Bot"

    # Unsubscribe from the assistant
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )  # Validate successful unsubscription
    assert unsubscribe_response.status_code == 200

    # Validate StatusResponse model
    status_response = StatusResponse.model_validate(unsubscribe_response.json())
    assert status_response.message == "Successfully unsubscribed from assistant"

    # Verify subscription was removed
    subscriptions_after = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(subscriptions_after) == 0


@pytest.mark.integration
def test_unsubscribe_from_nonexistent_subscription(test_client):
    """Test unsubscribing from an assistant that the user isn't subscribed to."""
    # Create an assistant but don't subscribe
    assistant_data = AssistantCreate(
        name="Not Subscribed Bot",
        system_prompt="A bot user isn't subscribed to.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Try to unsubscribe
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )

    # Should return 404 Not Found
    assert unsubscribe_response.status_code == 404
    assert "subscription not found" in unsubscribe_response.json()["detail"].lower()


@pytest.mark.integration
def test_get_user_subscriptions_empty(test_client):
    """Test getting user subscriptions when they have none."""
    # Get subscriptions without subscribing to anything
    response = test_client.get("/user/subscriptions", headers=headers)

    # Validate empty response
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.integration
def test_get_user_subscriptions_multiple(test_client):
    """Test getting multiple subscriptions."""  # Create multiple assistants
    assistant_names = ["Subscription Bot 1", "Subscription Bot 2", "Subscription Bot 3"]
    assistant_ids = []

    for name in assistant_names:
        assistant_data = AssistantCreate(
            name=name,
            system_prompt=f"A bot for testing multiple subscriptions: {name}",
            hierarchical_access=["IT-Test-Department"],
        )

        create_response = test_client.post(
            "/bot/create", json=assistant_data.model_dump(), headers=headers
        )
        assert create_response.status_code == 200
        assistant_ids.append(create_response.json()["id"])

    # Subscribe to the first and third assistants only
    test_client.post(f"/user/subscriptions/{assistant_ids[0]}", headers=headers)
    test_client.post(f"/user/subscriptions/{assistant_ids[2]}", headers=headers)

    # Get subscriptions
    response = test_client.get(
        "/user/subscriptions", headers=headers
    )  # Validate response
    assert response.status_code == 200
    subscriptions = response.json()
    assert len(subscriptions) == 2

    # Check that we have the correct assistants with simplified structure
    subscription_names = [sub["name"] for sub in subscriptions]
    assert "Subscription Bot 1" in subscription_names
    assert "Subscription Bot 2" not in subscription_names
    assert (
        "Subscription Bot 3" in subscription_names
    )  # Validate subscription objects using Pydantic model
    for subscription in subscriptions:
        # Parse with SubscriptionResponse model to ensure structure is correct
        subscription_response = SubscriptionResponse.model_validate(subscription)
        assert subscription_response.id in [assistant_ids[0], assistant_ids[2]]
        assert subscription_response.name in [
            "Subscription Bot 1",
            "Subscription Bot 3",
        ]

        # Also validate that only expected fields are present
        assert "id" in subscription
        assert "name" in subscription
        # Should NOT have complex fields like latest_version
        assert "latest_version" not in subscription
        assert "created_at" not in subscription
        assert "updated_at" not in subscription


@pytest.mark.integration
@pytest.mark.asyncio
async def test_subscription_lifecycle(test_client, test_db_session):
    """Test the full subscription lifecycle: create, subscribe, list, unsubscribe."""  # Create an assistant
    assistant_data = AssistantCreate(
        name="Lifecycle Test Bot",
        system_prompt="Testing the subscription lifecycle.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # 1. Verify no initial subscriptions
    initial_subs = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(initial_subs) == 0

    # 2. Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200  # 3. Verify subscription exists
    after_subscribe = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(after_subscribe) == 1

    # Validate using SubscriptionResponse model
    subscription_response = SubscriptionResponse.model_validate(after_subscribe[0])
    assert subscription_response.id == assistant_id
    assert subscription_response.name == "Lifecycle Test Bot"

    # Also validate that only expected fields are present
    assert "latest_version" not in after_subscribe[0]
    assert "created_at" not in after_subscribe[0]

    # 4. Attempting to subscribe again should fail
    duplicate_subscribe = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert duplicate_subscribe.status_code == 409  # 5. Unsubscribe from the assistant
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert unsubscribe_response.status_code == 200

    # 6. Verify subscription is removed
    after_unsubscribe = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(after_unsubscribe) == 0

    # 7. Attempting to unsubscribe again should fail
    duplicate_unsubscribe = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert duplicate_unsubscribe.status_code == 404


@pytest.mark.integration
def test_hierarchical_access_exact_match(test_client):
    """Test that user can access bot with exact department match."""
    # Create assistant with exact department match
    assistant_data = AssistantCreate(
        name="Exact Match Bot",
        system_prompt="Bot with exact department match.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Test-Department"],  # Exact match
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (has access)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_parent_department(test_client):
    """Test that user can access bot with parent department access."""
    # Create assistant with parent department access
    assistant_data = AssistantCreate(
        name="Parent Department Bot",
        system_prompt="Bot with parent department access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Test"],  # Parent of IT-Test-Department
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (has access through hierarchy)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_root_department(test_client):
    """Test that user can access bot with root department access."""
    # Create assistant with root department access
    assistant_data = AssistantCreate(
        name="Root Department Bot",
        system_prompt="Bot with root department access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT"],  # Root of IT hierarchy
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (has access through hierarchy)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_empty_access(test_client):
    """Test that user can access bot with empty hierarchical access (public)."""
    # Create assistant with empty hierarchical access (public)
    assistant_data = AssistantCreate(
        name="Public Bot",
        system_prompt="Bot with public access.",
        owner_ids=["other_user"],
        hierarchical_access=[""],  # Empty string means public access
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (public access)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_no_access_different_root(test_client):
    """Test that user cannot access bot from different root department."""
    # Create assistant with different root department
    assistant_data = AssistantCreate(
        name="HR Bot",
        system_prompt="Bot from HR department.",
        owner_ids=["other_user"],
        hierarchical_access=["HR"],  # Different root department
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should NOT be able to subscribe (no access)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 403


@pytest.mark.integration
def test_hierarchical_access_no_access_different_branch(test_client):
    """Test that user cannot access bot from different branch of IT."""
    # Create assistant with different IT branch
    assistant_data = AssistantCreate(
        name="IT Support Bot",
        system_prompt="Bot from IT Support branch.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Support"],  # Different branch under IT
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should NOT be able to subscribe (no access)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 403


@pytest.mark.integration
def test_hierarchical_access_no_access_child_department(test_client):
    """Test that user cannot access bot from child department they don't belong to."""
    # Create assistant with child department (more specific than user's department)
    assistant_data = AssistantCreate(
        name="Child Department Bot",
        system_prompt="Bot from child department.",
        owner_ids=["other_user"],
        hierarchical_access=[
            "IT-Test-Department-SubTeam"
        ],  # Child of user's department
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should NOT be able to subscribe (no access to child department)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 403


@pytest.mark.integration
def test_hierarchical_access_multiple_departments(test_client):
    """Test bot with multiple hierarchical access departments."""
    # Create assistant with multiple departments, one accessible, one not
    assistant_data = AssistantCreate(
        name="Multi Department Bot",
        system_prompt="Bot with multiple department access.",
        owner_ids=["other_user"],
        hierarchical_access=["HR", "IT-Test"],  # HR not accessible, IT-Test accessible
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (has access through IT-Test)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_mixed_valid_invalid(test_client):
    """Test bot with mix of valid and invalid hierarchical access paths."""
    # Create assistant with mixed access paths
    assistant_data = AssistantCreate(
        name="Mixed Access Bot",
        system_prompt="Bot with mixed access paths.",
        owner_ids=["other_user"],
        hierarchical_access=[
            "Finance",
            "IT-Test-Department",
            "Marketing",
        ],  # Only IT-Test-Department accessible
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should be able to subscribe (has access through IT-Test-Department)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200


@pytest.mark.integration
def test_hierarchical_access_case_sensitivity(test_client):
    """Test that hierarchical access is case sensitive."""
    # Create assistant with different case
    assistant_data = AssistantCreate(
        name="Case Sensitive Bot",
        system_prompt="Bot testing case sensitivity.",
        owner_ids=["other_user"],
        hierarchical_access=["it-test-department"],  # Different case
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should NOT be able to subscribe (case sensitive)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 403


@pytest.mark.integration
def test_get_user_bots_hierarchical_access_filtering(test_client):
    """Test that get user bots respects hierarchical access when user is not owner."""
    # Create bots with different hierarchical access levels
    accessible_bot = AssistantCreate(
        name="Accessible Bot",
        system_prompt="Bot user can access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT"],  # User has access
    )

    inaccessible_bot = AssistantCreate(
        name="Inaccessible Bot",
        system_prompt="Bot user cannot access.",
        owner_ids=["other_user"],
        hierarchical_access=["HR"],  # User has no access
    )

    # Create both bots
    accessible_response = test_client.post(
        "/bot/create", json=accessible_bot.model_dump(), headers=headers
    )
    assert accessible_response.status_code == 200

    inaccessible_response = test_client.post(
        "/bot/create", json=inaccessible_bot.model_dump(), headers=headers
    )
    assert inaccessible_response.status_code == 200

    # Get user's bots - should only return accessible bot (due to auto-ownership)
    response = test_client.get("/user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()

    # Both bots should be returned since test_user_123 is auto-added as owner
    # regardless of hierarchical access
    assert len(user_bots) == 2

    # Verify both bots are owned by test_user_123
    for bot in user_bots:
        assistant_response = AssistantResponse.model_validate(bot)
        assert "test_user_123" in assistant_response.owner_ids


@pytest.mark.integration
@pytest.mark.asyncio
async def test_hierarchical_access_subscription_vs_ownership(
    test_client, test_db_session
):
    """Test difference between hierarchical access for subscriptions vs ownership."""

    assistant_repo = AssistantRepository(test_db_session)

    # Create assistant with HR access (user cannot access) and no test_user_123 as owner
    assistant_hr = await assistant_repo.create(
        hierarchical_access=["HR"],
        owner_ids=["other_user_only"],  # Only other user as owner
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_hr,
        name="HR Only Bot",
        system_prompt="Bot only for HR.",
        description="This bot is only for HR department",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["hr-only"],
    )

    # Create assistant with IT access (user can access) and no test_user_123 as owner
    assistant_it = await assistant_repo.create(
        hierarchical_access=["IT"],
        owner_ids=["other_user_only"],  # Only other user as owner
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant_it,
        name="IT Accessible Bot",
        system_prompt="Bot accessible to IT.",
        description="This bot is accessible to IT department",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["it-accessible"],
    )

    await test_db_session.commit()

    # Get user's bots - should NOT return either bot (user is not owner)
    response = test_client.get("/user/bots", headers=headers)
    assert response.status_code == 200
    user_bots = response.json()
    assert len(user_bots) == 0  # User is not owner of either bot

    # Try to subscribe to HR bot - should fail (no hierarchical access)
    subscribe_hr_response = test_client.post(
        f"/user/subscriptions/{assistant_hr.id}", headers=headers
    )
    assert subscribe_hr_response.status_code == 403

    # Try to subscribe to IT bot - should succeed (has hierarchical access)
    subscribe_it_response = test_client.post(
        f"/user/subscriptions/{assistant_it.id}", headers=headers
    )
    assert subscribe_it_response.status_code == 200

    # Verify subscription was created
    subscriptions = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(subscriptions) == 1
    assert subscriptions[0]["name"] == "IT Accessible Bot"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_subscription_persists_after_commit(test_client, test_db_session):
    """Test that subscriptions persist in the database after transaction commit."""
    # Create an assistant for testing
    assistant_data = AssistantCreate(
        name="Subscription Persistence Bot",
        system_prompt="Testing that subscriptions persist after db commit.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Get subscriptions through API to verify it was created
    api_subscriptions = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(api_subscriptions) == 1
    assert (
        api_subscriptions[0]["id"] == assistant_id
    )  # Verify directly in the database that the subscription exists

    # Query the database directly to verify the subscription was committed
    result = await test_db_session.execute(
        select(Subscription).filter(
            Subscription.assistant_id == assistant_id,
            Subscription.lhmobjektID == "test_user_123",  # Default test user ID
        )
    )
    db_subscription = result.scalars().first()

    # Verify subscription exists in database
    assert db_subscription is not None
    assert db_subscription.assistant_id == assistant_id
    assert db_subscription.lhmobjektID == "test_user_123"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unsubscription_persists_after_commit(test_client, test_db_session):
    """Test that unsubscribing correctly removes the subscription from the database."""
    # Create an assistant for testing
    assistant_data = AssistantCreate(
        name="Unsubscribe Commit Test Bot",
        system_prompt="Testing that unsubscribing persists after db commit.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Check before unsubscribing
    result_before = await test_db_session.execute(
        select(Subscription).filter(
            Subscription.assistant_id == assistant_id,
            Subscription.lhmobjektID == "test_user_123",
        )
    )
    subscription_before = result_before.scalars().first()
    assert subscription_before is not None

    # Unsubscribe from the assistant
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert unsubscribe_response.status_code == 200

    # Check after unsubscribing - should be gone from database
    result_after = await test_db_session.execute(
        select(Subscription).filter(
            Subscription.assistant_id == assistant_id,
            Subscription.lhmobjektID == "test_user_123",
        )
    )
    subscription_after = result_after.scalars().first()
    assert subscription_after is None


@pytest.mark.integration
def test_subscription_count_in_assistant_response(test_client):
    """Test that subscription count is included in assistant responses."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Subscription Count Bot",
        system_prompt="Testing subscription count in responses.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Verify initial count is 0
    assert "subscriptions_count" in created_bot
    assert created_bot["subscriptions_count"] == 0

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Get user's bots and verify count is updated
    user_bots_response = test_client.get("/user/bots", headers=headers)
    assert user_bots_response.status_code == 200
    user_bots = user_bots_response.json()

    # Find our bot in the response
    our_bot = None
    for bot in user_bots:
        if bot["id"] == assistant_id:
            our_bot = bot
            break

    assert our_bot is not None
    assert "subscriptions_count" in our_bot
    assert our_bot["subscriptions_count"] == 1


@pytest.mark.integration
def test_subscription_count_decrements_on_unsubscribe(test_client):
    """Test that subscription count decrements when users unsubscribe."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Unsubscribe Count Bot",
        system_prompt="Testing subscription count decrement.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Verify count is 1
    user_bots_response = test_client.get("/user/bots", headers=headers)
    user_bots = user_bots_response.json()
    our_bot = next((bot for bot in user_bots if bot["id"] == assistant_id), None)
    assert our_bot["subscriptions_count"] == 1

    # Unsubscribe
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert unsubscribe_response.status_code == 200

    # Verify count is back to 0
    user_bots_response = test_client.get("/user/bots", headers=headers)
    user_bots = user_bots_response.json()
    our_bot = next((bot for bot in user_bots if bot["id"] == assistant_id), None)
    assert our_bot["subscriptions_count"] == 0


@pytest.mark.integration
def test_subscription_count_zero_for_new_assistants(test_client):
    """Test that new assistants start with zero subscription count."""
    # Create multiple assistants
    for i in range(3):
        assistant_data = AssistantCreate(
            name=f"New Assistant {i}",
            system_prompt=f"New assistant number {i}.",
            hierarchical_access=["IT-Test-Department"],
        )

        create_response = test_client.post(
            "/bot/create", json=assistant_data.model_dump(), headers=headers
        )
        assert create_response.status_code == 200
        created_bot = create_response.json()

        # Each new assistant should start with 0 subscriptions
        assert "subscriptions_count" in created_bot
        assert created_bot["subscriptions_count"] == 0

    # Verify in user bots list as well
    user_bots_response = test_client.get("/user/bots", headers=headers)
    user_bots = user_bots_response.json()
    assert len(user_bots) == 3

    for bot in user_bots:
        assert bot["subscriptions_count"] == 0


@pytest.mark.integration
@pytest.mark.asyncio
async def test_subscription_count_with_repository_operations(
    test_client, test_db_session
):
    """Test subscription count accuracy with direct repository operations."""
    from src.database.assistant_repo import AssistantRepository

    # Create assistant using repository directly
    assistant_repo = AssistantRepository(test_db_session)

    assistant = await assistant_repo.create(
        hierarchical_access=["IT-Test-Department"],
        owner_ids=["test_user_123"],
    )

    await assistant_repo.create_assistant_version(
        assistant=assistant,
        name="Repository Test Bot",
        system_prompt="Testing with repository operations.",
        description="Bot for testing subscription count with repository",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["test"],
    )  # Add subscription directly via repository
    await assistant_repo.create_subscription(
        assistant_id=assistant.id, lhmobjektID="test_user_123"
    )

    await test_db_session.commit()

    # Get user's bots via API and verify count
    user_bots_response = test_client.get("/user/bots", headers=headers)
    assert user_bots_response.status_code == 200
    user_bots = user_bots_response.json()

    our_bot = next((bot for bot in user_bots if bot["id"] == str(assistant.id)), None)
    assert our_bot is not None
    assert (
        our_bot["subscriptions_count"] == 1
    )  # Remove subscription directly via repository
    await assistant_repo.remove_subscription(
        assistant_id=assistant.id, lhmobjektID="test_user_123"
    )

    await test_db_session.commit()

    # Verify count is decremented
    user_bots_response = test_client.get("/user/bots", headers=headers)
    user_bots = user_bots_response.json()
    our_bot = next((bot for bot in user_bots if bot["id"] == str(assistant.id)), None)
    assert our_bot["subscriptions_count"] == 0


@pytest.mark.integration
def test_subscription_count_in_complex_bot_response(test_client):
    """Test that subscription count is included in complex bot responses."""
    # Create a complex bot
    complex_assistant_data = AssistantCreate(
        name="Complex Count Bot",
        description="A complex bot for testing subscription count",
        system_prompt="You are a complex assistant with subscription counting.",
        hierarchical_access=["IT-Test-Department"],
        temperature=0.8,
        max_output_tokens=2000,
        examples=[
            {"text": "Example 1", "value": "First example value"},
        ],
        quick_prompts=[
            {
                "label": "Summarize",
                "prompt": "Please summarize this",
                "tooltip": "Quick summary",
            }
        ],
        tags=["complex", "counting"],
        tools=[{"id": "WEB_SEARCH", "config": {"max_results": 10}}],
    )

    create_response = test_client.post(
        "/bot/create", json=complex_assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_bot = create_response.json()
    assistant_id = created_bot["id"]

    # Verify subscription count is present in complex response
    assert "subscriptions_count" in created_bot
    assert created_bot["subscriptions_count"] == 0

    # Subscribe and verify count in complex response
    test_client.post(f"/user/subscriptions/{assistant_id}", headers=headers)

    user_bots_response = test_client.get("/user/bots", headers=headers)
    user_bots = user_bots_response.json()
    our_bot = next((bot for bot in user_bots if bot["id"] == assistant_id), None)

    # Validate complex response structure with subscription count
    assistant_response = AssistantResponse.model_validate(our_bot)
    assert hasattr(assistant_response, "subscriptions_count")
    assert assistant_response.subscriptions_count == 1

    # Verify other complex fields are still present
    assert assistant_response.latest_version.temperature == 0.8
    assert len(assistant_response.latest_version.examples) == 1
    assert len(assistant_response.latest_version.quick_prompts) == 1
    assert assistant_response.latest_version.tags == ["complex", "counting"]


@pytest.mark.integration
def test_subscription_count_persists_across_requests(test_client):
    """Test that subscription count persists across multiple API requests."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Persistence Test Bot",
        system_prompt="Testing subscription count persistence.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/bot/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # Subscribe
    test_client.post(f"/user/subscriptions/{assistant_id}", headers=headers)

    # Make multiple requests and verify count is consistent
    for _ in range(3):
        user_bots_response = test_client.get("/user/bots", headers=headers)
        user_bots = user_bots_response.json()
        our_bot = next((bot for bot in user_bots if bot["id"] == assistant_id), None)
        assert our_bot is not None
        assert our_bot["subscriptions_count"] == 1
