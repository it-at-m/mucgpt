import pytest
from src.api.api_models import (
    AssistantCreate,
    AssistantUpdate,
    ExampleModel,
    QuickPrompt,
    ToolBase,
)
from src.backend import api_app, testfunction

# Headers for authentication
headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.fixture
def sample_assistant_create():
    """Sample assistant creation data."""
    return AssistantCreate(
        name="Test Assistant",
        description="A test AI assistant",
        system_prompt="You are a helpful test assistant.",
        hierarchical_access="IT",
        temperature=0.7,
        max_output_tokens=1000,
        examples=[ExampleModel(text="Test Example", value="This is a test example")],
        quick_prompts=[
            QuickPrompt(
                label="Test Prompt",
                prompt="This is a test prompt",
                tooltip="Test tooltip",
            )
        ],
        tags=["test", "demo"],
        tools=[ToolBase(id="WEB_SEARCH", config={"max_results": 5})],
        owner_ids=["test_user_123"],
    )


@pytest.fixture
def sample_assistant_update():
    """Sample assistant update data."""
    return AssistantUpdate(
        version=1,
        name="Updated Test Assistant",
        description="An updated test AI assistant",
        temperature=0.8,
        tags=["test", "updated"],
    )


@pytest.mark.integration
def test_unknown_endpoint(test_client):
    """Test that unknown endpoints return 404."""
    response = test_client.post("unknownendpoint")
    assert response.status_code == 404


@pytest.mark.integration
def test_health_check(test_client):
    """Test the health check endpoint."""
    response = test_client.get("health")
    assert response.status_code == 200
    assert response.text == '"OK"'


def testfunctionoverride():
    """A test function to ensure the backend is running."""
    return "Override successful"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_auth_api(test_client):
    """Test the authentication API endpoint."""
    # Save original dependency
    original = api_app.dependency_overrides.get(testfunction)
    # Override test function
    api_app.dependency_overrides[testfunction] = testfunctionoverride

    try:
        response = test_client.get("test/textauth", headers=headers)
        assert response.status_code == 200
        assert response.text == '"Override successful"'
    finally:
        # Restore original dependency or remove override
        if original:
            api_app.dependency_overrides[testfunction] = original
        else:
            api_app.dependency_overrides.pop(testfunction, None)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_bot_success(sample_assistant_create, test_client):
    """Test successful assistant creation."""
    # Authentication is already handled by the test_client fixture
    response = test_client.post(
        "bot/create", json=sample_assistant_create.model_dump(), headers=headers
    )

    assert response.status_code == 200
    response_data = response.json()
    assert "id" in response_data
    assert "latest_version" in response_data
