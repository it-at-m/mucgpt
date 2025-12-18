import pytest
from fastapi.testclient import TestClient

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
    assert all("name" in tool and "description" in tool for tool in data["tools"])
