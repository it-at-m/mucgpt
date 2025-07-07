import pytest
from fastapi.testclient import TestClient

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult


@pytest.fixture
def override_authenticate_user():
    """Override the authentication dependency."""

    async def _get_test_user():
        return AuthenticationResult(
            lhm_object_id="test_user_123",
            name="Test User",
            email="test@example.com",
            department="IT-Test-Department",
            is_authenticated=True,
        )

    return _get_test_user


@pytest.fixture
def test_client(override_authenticate_user):
    """Create a test client with authentication and database overrides."""
    # Apply dependency overrides to the API app where authentication is used
    api_app.dependency_overrides[authenticate_user] = override_authenticate_user

    # Create test client using the backend which has the API mounted at /api/
    client = TestClient(api_app)

    yield client

    # Clear overrides after test
    api_app.dependency_overrides.clear()
