import pytest

headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.mark.integration
def test_config_endpoint(test_client):
    """Test the /config endpoint returns application configuration."""
    response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "frontend" in data
    assert "version" in data
    assert "commit" in data
    assert "models" in data
    assert isinstance(data["models"], list)


@pytest.mark.integration
def test_health_check(test_client):
    """Test the /health endpoint returns OK."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.text == '"OK"'
