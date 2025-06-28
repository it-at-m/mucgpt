import pytest

# Headers for authentication
headers = {
    "Authorization": "Bearer dummy_access_token",
}


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
