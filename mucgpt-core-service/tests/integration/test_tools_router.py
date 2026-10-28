import pytest
from fastapi.testclient import TestClient

from backend import api_app
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult

headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.mark.integration
def test_tools_list(test_client: TestClient):
    """Test the /v1/tools endpoint returns tool metadata."""
    response = test_client.get("/v1/tools", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert isinstance(data["tools"], list)
    assert data["tools"]
    assert all(
        "name" in tool
        and "description" in tool
        and "mcp_group" in tool
        and "access" in tool
        for tool in data["tools"]
    )


@pytest.mark.integration
def test_admin_tools_list_requires_administrator(test_client: TestClient):
    response = test_client.get("/v1/admin/tools", headers=headers)
    assert response.status_code == 403


@pytest.mark.integration
def test_admin_tools_list_returns_tool_access(test_client: TestClient):
    async def admin_user():
        return AuthenticationResult(
            token="dummy_access_token",
            user_id="test_admin",
            department="IT-Test-Department",
            is_admin=True,
        )

    api_app.dependency_overrides[authenticate_user] = admin_user
    response = test_client.get("/v1/admin/tools", headers=headers)
    assert response.status_code == 200
    assert all("access" in tool for tool in response.json()["tools"])
