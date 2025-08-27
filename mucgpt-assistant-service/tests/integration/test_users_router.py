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
def test_get_user_assistants_empty(test_client):
    """Test getting assistants for a user when they have none."""
    response = test_client.get("/user/assistants", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert response_data == []


@pytest.mark.integration
def test_get_user_assistants_success(test_client):
    """Test successfully getting assistants owned by the authenticated user."""
    # Create a assistant owned by the default test user "test_user_123"
    assistant_data = AssistantCreate(
        name="My Test Assistant",
        system_prompt="A assistant for testing.",
        owner_ids=["test_user_123"],
    )
    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = (
        create_response.json()
    )  # Create another assistant not owned by the test user
    other_assistant_data = AssistantCreate(
        name="Other User's Assistant",
        system_prompt="This assistant is not mine.",
        owner_ids=["other_user_456"],  # test_user_123 will be auto-added as owner
    )
    create_response_other = test_client.post(
        "/assistant/create", json=other_assistant_data.model_dump(), headers=headers
    )
    assert create_response_other.status_code == 200

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    # Validate response structure
    assert isinstance(user_assistants, list)

    # Both assistants should be returned since test_user_123 is auto-added as owner to all assistants
    assert len(user_assistants) == 2

    # Find the specific assistant we're testing
    my_test_assistant = None
    for assistant in user_assistants:
        if assistant["latest_version"]["name"] == "My Test Assistant":
            my_test_assistant = assistant
            break

    assert my_test_assistant is not None, (
        "Could not find 'My Test Assistant' in response"
    )

    # Validate using Pydantic models
    assistant_response = AssistantResponse.model_validate(my_test_assistant)
    assert assistant_response.id == created_assistant["id"]
    assert assistant_response.latest_version.name == "My Test Assistant"
    assert "test_user_123" in assistant_response.owner_ids


@pytest.mark.integration
def test_get_user_assistants_multiple_owned(test_client):
    """Test getting multiple assistants owned by the same user."""
    # Create two assistants for the same user
    assistant1_data = AssistantCreate(
        name="Assistant One",
        system_prompt="First assistant.",
        owner_ids=["test_user_123"],
    )
    assistant2_data = AssistantCreate(
        name="Assistant Two",
        system_prompt="Second assistant.",
        owner_ids=["test_user_123"],
    )

    test_client.post(
        "/assistant/create", json=assistant1_data.model_dump(), headers=headers
    )
    test_client.post(
        "/assistant/create", json=assistant2_data.model_dump(), headers=headers
    )

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    # Validate response structure
    assert isinstance(user_assistants, list)
    assert len(user_assistants) == 2

    # Validate each assistant using Pydantic models
    for assistant in user_assistants:
        assistant_response = AssistantResponse.model_validate(assistant)
        assert assistant_response.id is not None
        assert assistant_response.latest_version is not None
        assert "test_user_123" in assistant_response.owner_ids

    assistant_names = {
        assistant["latest_version"]["name"] for assistant in user_assistants
    }
    assert {"Assistant One", "Assistant Two"} == assistant_names


@pytest.mark.integration
def test_get_user_assistants_owner_filter_is_strict(test_client):
    """Test that users get assistants where they are owners (including auto-added ownership)."""  # Create assistant with hierarchical access that matches the test user's department
    assistant_data = AssistantCreate(
        name="Hierarchical Assistant",
        system_prompt="A assistant accessible hierarchically.",
        owner_ids=["another_user"],
        hierarchical_access=["IT-Test-Department"],  # test_user_123 has this role
    )
    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200

    # User should get this assistant because test_user_123 is auto-added as owner during creation
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert (
        len(response_data) == 1
    )  # Should contain the assistant because test_user_123 is auto-added as owner

    # Validate that test_user_123 is indeed an owner
    assistant_response = AssistantResponse.model_validate(response_data[0])
    assert "test_user_123" in assistant_response.owner_ids
    assert "another_user" in assistant_response.owner_ids


@pytest.mark.integration
def test_get_user_assistants_with_complex_data(test_client):
    """Test getting user assistants with complex data structures."""
    # Create a assistant with complex data (tools, examples, quick prompts, etc.)
    complex_assistant_data = AssistantCreate(
        name="Complex User Assistant",
        description="A complex assistant with various features",
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
        "/assistant/create", json=complex_assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    assert len(user_assistants) == 1

    # Validate complex data using Pydantic models
    assistant_response = AssistantResponse.model_validate(user_assistants[0])
    assert assistant_response.latest_version.name == "Complex User Assistant"
    assert (
        assistant_response.latest_version.description
        == "A complex assistant with various features"
    )
    assert assistant_response.latest_version.temperature == 0.8
    assert assistant_response.latest_version.max_output_tokens == 2000
    assert len(assistant_response.latest_version.examples) == 2
    assert len(assistant_response.latest_version.quick_prompts) == 1
    assert assistant_response.latest_version.tags == ["complex", "user-owned"]
    assert set(assistant_response.hierarchical_access) == {"IT", "MANAGEMENT"}


@pytest.mark.integration
def test_get_user_assistants_response_format(test_client):
    """Test that the response format is correct."""
    # Create a assistant for testing
    assistant_data = AssistantCreate(
        name="Format Test Assistant",
        system_prompt="You are a format test assistant.",
        owner_ids=["test_user_123"],
    )

    test_client.post(
        "assistant/create", json=assistant_data.model_dump(), headers=headers
    )

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200

    # Validate response structure
    response_data = response.json()
    assert isinstance(response_data, list)
    assert len(response_data) == 1

    # Validate each assistant structure
    assistant = response_data[0]
    assistant_response = AssistantResponse.model_validate(assistant)

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
def test_get_user_assistants_with_unicode_content(test_client):
    """Test getting user assistants with unicode characters."""
    assistant_data = AssistantCreate(
        name="Unicode Assistant 🤖",
        description="Assistant with émojis and spëcial characters: 中文",
        system_prompt="You are a helpful assistant. Vous êtes très utile! 您好!",
        owner_ids=["test_user_123"],
    )

    test_client.post(
        "assistant/create", json=assistant_data.model_dump(), headers=headers
    )

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    assert len(user_assistants) == 1

    # Validate unicode content
    assistant_response = AssistantResponse.model_validate(user_assistants[0])
    assert assistant_response.latest_version.name == "Unicode Assistant 🤖"
    assert (
        assistant_response.latest_version.description
        == "Assistant with émojis and spëcial characters: 中文"
    )
    assert (
        assistant_response.latest_version.system_prompt
        == "You are a helpful assistant. Vous êtes très utile! 您好!"
    )


@pytest.mark.integration
def test_get_user_assistants_multiple_owners(test_client):
    """Test getting assistants where user is one of multiple owners."""
    # Create a assistant with multiple owners including the test user
    assistant_data = AssistantCreate(
        name="Multi-Owner Assistant",
        system_prompt="You are a multi-owner assistant.",
        owner_ids=["test_user_123", "other_user_456", "third_user_789"],
    )

    test_client.post(
        "assistant/create", json=assistant_data.model_dump(), headers=headers
    )

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    assert len(user_assistants) == 1

    # Validate ownership
    assistant_response = AssistantResponse.model_validate(user_assistants[0])
    assert "test_user_123" in assistant_response.owner_ids
    assert "other_user_456" in assistant_response.owner_ids
    assert "third_user_789" in assistant_response.owner_ids
    assert len(assistant_response.owner_ids) == 3


@pytest.mark.integration
def test_get_user_assistants_empty_optional_fields(test_client):
    """Test getting assistants with empty optional fields."""
    assistant_data = AssistantCreate(
        name="Minimal Assistant",
        system_prompt="You are a minimal assistant.",
        owner_ids=["test_user_123"],
        description="",
        examples=[],
        quick_prompts=[],
        tags=[],
        tools=[],
        hierarchical_access=[],
    )

    test_client.post(
        "assistant/create", json=assistant_data.model_dump(), headers=headers
    )

    # Get user's assistants
    response = test_client.get("user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    assert len(user_assistants) == 1

    # Validate empty fields
    assistant_response = AssistantResponse.model_validate(user_assistants[0])
    assert assistant_response.latest_version.description == ""
    assert assistant_response.latest_version.examples == []
    assert assistant_response.latest_version.quick_prompts == []
    assert assistant_response.latest_version.tags == []
    assert assistant_response.hierarchical_access == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_user_assistants_access_control_repo(test_client, test_db_session):
    """Test that users can only access assistants they own when using repository-created data."""
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
        description="This assistant is owned by test_user_123",
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
        description="This assistant is owned by other_user_456",
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
        description="This assistant has multiple owners including test_user_123",
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
        description="This assistant has no owners",
        temperature=0.6,
        max_output_tokens=900,
        examples=[],
        quick_prompts=[],
        tags=["orphaned"],
    )

    await test_db_session.commit()

    # Get user's assistants - should only return assistants where test_user_123 is an owner
    response = test_client.get("/user/assistants", headers=headers)
    assert response.status_code == 200

    user_assistants = response.json()
    assert isinstance(user_assistants, list)

    # Should return exactly 2 assistants: assistant_owned and assistant_co_owned
    assert len(user_assistants) == 2

    # Validate the returned assistants
    returned_names = {
        assistant["latest_version"]["name"] for assistant in user_assistants
    }
    assert "My Owned Assistant" in returned_names
    assert "Co-Owned Assistant" in returned_names
    assert "Not My Assistant" not in returned_names
    assert "Orphaned Assistant" not in returned_names

    # Verify ownership for each returned assistant
    for assistant in user_assistants:
        assistant_response = AssistantResponse.model_validate(assistant)
        assert "test_user_123" in assistant_response.owner_ids

        # Verify specific assistants
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
        name="Subscribe Test Assistant",
        system_prompt="A assistant for testing subscriptions.",
        owner_ids=["other_user_456"],  # Not owned by test_user_123
        hierarchical_access=["IT-Test-Department"],  # test_user_123 has this department
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

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
    assert subscription_response.name == "Subscribe Test Assistant"


@pytest.mark.integration
def test_subscribe_to_assistant_already_subscribed(test_client):
    """Test subscribing to an assistant that the user is already subscribed to."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Already Subscribed Assistant",
        system_prompt="Testing already subscribed scenario.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

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
        name="No Access Assistant",
        system_prompt="A assistant user can't access.",
        owner_ids=["other_user_456"],
        hierarchical_access=["HR-Test"],  # test_user_123 doesn't have this department
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

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
        name="Unsubscribe Test Assistant",
        system_prompt="A assistant for testing unsubscribing.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

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
    assert subscription_response.name == "Unsubscribe Test Assistant"

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
        name="Not Subscribed Assistant",
        system_prompt="A assistant user isn't subscribed to.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

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
    assistant_names = [
        "Subscription Assistant 1",
        "Subscription Assistant 2",
        "Subscription Assistant 3",
    ]
    assistant_ids = []

    for name in assistant_names:
        assistant_data = AssistantCreate(
            name=name,
            system_prompt=f"A assistant for testing multiple subscriptions: {name}",
            hierarchical_access=["IT-Test-Department"],
        )

        create_response = test_client.post(
            "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    assert "Subscription Assistant 1" in subscription_names
    assert "Subscription Assistant 2" not in subscription_names
    assert (
        "Subscription Assistant 3" in subscription_names
    )  # Validate subscription objects using Pydantic model
    for subscription in subscriptions:
        # Parse with SubscriptionResponse model to ensure structure is correct
        subscription_response = SubscriptionResponse.model_validate(subscription)
        assert subscription_response.id in [assistant_ids[0], assistant_ids[2]]
        assert subscription_response.name in [
            "Subscription Assistant 1",
            "Subscription Assistant 3",
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
        name="Lifecycle Test Assistant",
        system_prompt="Testing the subscription lifecycle.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    assert subscription_response.name == "Lifecycle Test Assistant"

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
    """Test that user can access assistant with exact department match."""
    # Create assistant with exact department match
    assistant_data = AssistantCreate(
        name="Exact Match Assistant",
        system_prompt="Assistant with exact department match.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Test-Department"],  # Exact match
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user can access assistant with parent department access."""
    # Create assistant with parent department access
    assistant_data = AssistantCreate(
        name="Parent Department Assistant",
        system_prompt="Assistant with parent department access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Test"],  # Parent of IT-Test-Department
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user can access assistant with root department access."""
    # Create assistant with root department access
    assistant_data = AssistantCreate(
        name="Root Department Assistant",
        system_prompt="Assistant with root department access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT"],  # Root of IT hierarchy
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user can access assistant with empty hierarchical access (public)."""
    # Create assistant with empty hierarchical access (public)
    assistant_data = AssistantCreate(
        name="Public Assistant",
        system_prompt="Assistant with public access.",
        owner_ids=["other_user"],
        hierarchical_access=[""],  # Empty string means public access
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user cannot access assistant from different root department."""
    # Create assistant with different root department
    assistant_data = AssistantCreate(
        name="HR Assistant",
        system_prompt="Assistant from HR department.",
        owner_ids=["other_user"],
        hierarchical_access=["HR"],  # Different root department
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user cannot access assistant from different branch of IT."""
    # Create assistant with different IT branch
    assistant_data = AssistantCreate(
        name="IT Support Assistant",
        system_prompt="Assistant from IT Support branch.",
        owner_ids=["other_user"],
        hierarchical_access=["IT-Support"],  # Different branch under IT
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test that user cannot access assistant from child department they don't belong to."""
    # Create assistant with child department (more specific than user's department)
    assistant_data = AssistantCreate(
        name="Child Department Assistant",
        system_prompt="Assistant from child department.",
        owner_ids=["other_user"],
        hierarchical_access=[
            "IT-Test-Department-SubTeam"
        ],  # Child of user's department
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test assistant with multiple hierarchical access departments."""
    # Create assistant with multiple departments, one accessible, one not
    assistant_data = AssistantCreate(
        name="Multi Department Assistant",
        system_prompt="Assistant with multiple department access.",
        owner_ids=["other_user"],
        hierarchical_access=["HR", "IT-Test"],  # HR not accessible, IT-Test accessible
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
    """Test assistant with mix of valid and invalid hierarchical access paths."""
    # Create assistant with mixed access paths
    assistant_data = AssistantCreate(
        name="Mixed Access Assistant",
        system_prompt="Assistant with mixed access paths.",
        owner_ids=["other_user"],
        hierarchical_access=[
            "Finance",
            "IT-Test-Department",
            "Marketing",
        ],  # Only IT-Test-Department accessible
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
        name="Case Sensitive Assistant",
        system_prompt="Assistant testing case sensitivity.",
        owner_ids=["other_user"],
        hierarchical_access=["it-test-department"],  # Different case
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # User should NOT be able to subscribe (case sensitive)
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 403


@pytest.mark.integration
def test_get_user_assistants_hierarchical_access_filtering(test_client):
    """Test that get user assistants respects hierarchical access when user is not owner."""
    # Create assistants with different hierarchical access levels
    accessible_assistant = AssistantCreate(
        name="Accessible Assistant",
        system_prompt="Assistant user can access.",
        owner_ids=["other_user"],
        hierarchical_access=["IT"],  # User has access
    )

    inaccessible_assistant = AssistantCreate(
        name="Inaccessible Assistant",
        system_prompt="Assistant user cannot access.",
        owner_ids=["other_user"],
        hierarchical_access=["HR"],  # User has no access
    )

    # Create assistanth assistants
    accessible_response = test_client.post(
        "/assistant/create", json=accessible_assistant.model_dump(), headers=headers
    )
    assert accessible_response.status_code == 200

    inaccessible_response = test_client.post(
        "/assistant/create", json=inaccessible_assistant.model_dump(), headers=headers
    )
    assert inaccessible_response.status_code == 200

    # Get user's assistants - should only return accessible assistant (due to auto-ownership)
    response = test_client.get("/user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()

    # Both assistants should be returned since test_user_123 is auto-added as owner
    # regardless of hierarchical access
    assert len(user_assistants) == 2

    # Verify both assistants are owned by test_user_123
    for assistant in user_assistants:
        assistant_response = AssistantResponse.model_validate(assistant)
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
        name="HR Only Assistant",
        system_prompt="Assistant only for HR.",
        description="This assistant is only for HR department",
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
        name="IT Accessible Assistant",
        system_prompt="Assistant accessible to IT.",
        description="This assistant is accessible to IT department",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["it-accessible"],
    )

    await test_db_session.commit()

    # Get user's assistants - should NOT return either assistant (user is not owner)
    response = test_client.get("/user/assistants", headers=headers)
    assert response.status_code == 200
    user_assistants = response.json()
    assert len(user_assistants) == 0  # User is not owner of either assistant

    # Try to subscribe to HR assistant - should fail (no hierarchical access)
    subscribe_hr_response = test_client.post(
        f"/user/subscriptions/{assistant_hr.id}", headers=headers
    )
    assert subscribe_hr_response.status_code == 403

    # Try to subscribe to IT assistant - should succeed (has hierarchical access)
    subscribe_it_response = test_client.post(
        f"/user/subscriptions/{assistant_it.id}", headers=headers
    )
    assert subscribe_it_response.status_code == 200

    # Verify subscription was created
    subscriptions = test_client.get("/user/subscriptions", headers=headers).json()
    assert len(subscriptions) == 1
    assert subscriptions[0]["name"] == "IT Accessible Assistant"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_subscription_persists_after_commit(test_client, test_db_session):
    """Test that subscriptions persist in the database after transaction commit."""
    # Create an assistant for testing
    assistant_data = AssistantCreate(
        name="Subscription Persistence Assistant",
        system_prompt="Testing that subscriptions persist after db commit.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
            Subscription.user_id == "test_user_123",  # Default test user ID
        )
    )
    db_subscription = result.scalars().first()

    # Verify subscription exists in database
    assert db_subscription is not None
    assert db_subscription.assistant_id == assistant_id
    assert db_subscription.user_id == "test_user_123"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_unsubscription_persists_after_commit(test_client, test_db_session):
    """Test that unsubscribing correctly removes the subscription from the database."""
    # Create an assistant for testing
    assistant_data = AssistantCreate(
        name="Unsubscribe Commit Test Assistant",
        system_prompt="Testing that unsubscribing persists after db commit.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
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
            Subscription.user_id == "test_user_123",
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
            Subscription.user_id == "test_user_123",
        )
    )
    subscription_after = result_after.scalars().first()
    assert subscription_after is None


@pytest.mark.integration
def test_subscription_count_in_assistant_response(test_client):
    """Test that subscription count is included in assistant responses."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Subscription Count Assistant",
        system_prompt="Testing subscription count in responses.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

    # Verify initial count is 0
    assert "subscriptions_count" in created_assistant
    assert created_assistant["subscriptions_count"] == 0

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Get user's assistants and verify count is updated
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    assert user_assistants_response.status_code == 200
    user_assistants = user_assistants_response.json()

    # Find our assistant in the response
    our_assistant = None
    for assistant in user_assistants:
        if assistant["id"] == assistant_id:
            our_assistant = assistant
            break

    assert our_assistant is not None
    assert "subscriptions_count" in our_assistant
    assert our_assistant["subscriptions_count"] == 1


@pytest.mark.integration
def test_subscription_count_decrements_on_unsubscribe(test_client):
    """Test that subscription count decrements when users unsubscribe."""
    # Create an assistant
    assistant_data = AssistantCreate(
        name="Unsubscribe Count Assistant",
        system_prompt="Testing subscription count decrement.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

    # Subscribe to the assistant
    subscribe_response = test_client.post(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert subscribe_response.status_code == 200

    # Verify count is 1
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    user_assistants = user_assistants_response.json()
    our_assistant = next(
        (assistant for assistant in user_assistants if assistant["id"] == assistant_id),
        None,
    )
    assert our_assistant["subscriptions_count"] == 1

    # Unsubscribe
    unsubscribe_response = test_client.delete(
        f"/user/subscriptions/{assistant_id}", headers=headers
    )
    assert unsubscribe_response.status_code == 200

    # Verify count is back to 0
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    user_assistants = user_assistants_response.json()
    our_assistant = next(
        (assistant for assistant in user_assistants if assistant["id"] == assistant_id),
        None,
    )
    assert our_assistant["subscriptions_count"] == 0


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
            "/assistant/create", json=assistant_data.model_dump(), headers=headers
        )
        assert create_response.status_code == 200
        created_assistant = create_response.json()

        # Each new assistant should start with 0 subscriptions
        assert "subscriptions_count" in created_assistant
        assert created_assistant["subscriptions_count"] == 0

    # Verify in user assistants list as well
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    user_assistants = user_assistants_response.json()
    assert len(user_assistants) == 3

    for assistant in user_assistants:
        assert assistant["subscriptions_count"] == 0


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
        name="Repository Test Assistant",
        system_prompt="Testing with repository operations.",
        description="Assistant for testing subscription count with repository",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[],
        quick_prompts=[],
        tags=["test"],
    )  # Add subscription directly via repository
    await assistant_repo.create_subscription(
        assistant_id=assistant.id, user_id="test_user_123"
    )

    await test_db_session.commit()

    # Get user's assistants via API and verify count
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    assert user_assistants_response.status_code == 200
    user_assistants = user_assistants_response.json()

    our_assistant = next(
        (
            user_assistant
            for user_assistant in user_assistants
            if user_assistant["id"] == str(assistant.id)
        ),
        None,
    )
    assert our_assistant is not None
    assert (
        our_assistant["subscriptions_count"] == 1
    )  # Remove subscription directly via repository
    await assistant_repo.remove_subscription(
        assistant_id=assistant.id, user_id="test_user_123"
    )

    await test_db_session.commit()

    # Verify count is decremented
    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    user_assistants = user_assistants_response.json()
    our_assistant = next(
        (
            user_assistant
            for user_assistant in user_assistants
            if user_assistant["id"] == str(assistant.id)
        ),
        None,
    )
    assert our_assistant["subscriptions_count"] == 0


@pytest.mark.integration
def test_subscription_count_in_complex_assistant_response(test_client):
    """Test that subscription count is included in complex assistant responses."""
    # Create a complex assistant
    complex_assistant_data = AssistantCreate(
        name="Complex Count Assistant",
        description="A complex assistant for testing subscription count",
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
        "/assistant/create", json=complex_assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    created_assistant = create_response.json()
    assistant_id = created_assistant["id"]

    # Verify subscription count is present in complex response
    assert "subscriptions_count" in created_assistant
    assert created_assistant["subscriptions_count"] == 0

    # Subscribe and verify count in complex response
    test_client.post(f"/user/subscriptions/{assistant_id}", headers=headers)

    user_assistants_response = test_client.get("/user/assistants", headers=headers)
    user_assistants = user_assistants_response.json()
    our_assistant = next(
        (assistant for assistant in user_assistants if assistant["id"] == assistant_id),
        None,
    )

    # Validate complex response structure with subscription count
    assistant_response = AssistantResponse.model_validate(our_assistant)
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
        name="Persistence Test Assistant",
        system_prompt="Testing subscription count persistence.",
        hierarchical_access=["IT-Test-Department"],
    )

    create_response = test_client.post(
        "/assistant/create", json=assistant_data.model_dump(), headers=headers
    )
    assert create_response.status_code == 200
    assistant_id = create_response.json()["id"]

    # Subscribe
    test_client.post(f"/user/subscriptions/{assistant_id}", headers=headers)

    # Make multiple requests and verify count is consistent
    for _ in range(3):
        user_assistants_response = test_client.get("/user/assistants", headers=headers)
        user_assistants = user_assistants_response.json()
        our_assistant = next(
            (
                assistant
                for assistant in user_assistants
                if assistant["id"] == assistant_id
            ),
            None,
        )
        assert our_assistant is not None
        assert our_assistant["subscriptions_count"] == 1
