import pytest


@pytest.mark.integration
def test_health_check(test_client):
    """GET /health should return 200 OK."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.json() == "OK"
