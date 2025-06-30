import pytest
from src.api.api_models import (
    AssistantCreate,
    AssistantResponse,
)

# Headers for authentication
headers = {
    "Authorization": "Bearer dummy_access_token",
}


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
    """Test that users get bots where they are owners (including auto-added ownership)."""
    # Bot is owned by another user, but test_user_123 will be auto-added as owner
    assistant_data = AssistantCreate(
        name="Hierarchical Bot",
        system_prompt="A bot accessible hierarchically.",
        owner_ids=["another_user"],
        hierarchical_access=["it-support"],  # test_user_123 has this role
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
    from src.database.assistant_repo import AssistantRepository

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
