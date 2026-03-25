import pytest

STORED_RESULT = "previously parsed content"


@pytest.fixture
def seeded_storage():
    """Seed the in-memory storage with a known entry before a test."""
    import api.routers.parsing_router as pr

    file_id = "00000000-0000-0000-0000-000000000001"
    pr.file_storage[file_id] = STORED_RESULT
    return file_id


@pytest.mark.integration
def test_get_file_found(seeded_storage, test_client):
    """GET /data/{file_id} should return the stored content for a known UUID."""
    response = test_client.get(f"/data/{seeded_storage}")

    assert response.status_code == 200
    assert response.json() == STORED_RESULT


@pytest.mark.integration
def test_get_file_not_found(test_client):
    """GET /data/{file_id} should return 404 for an unknown UUID."""
    response = test_client.get("/data/non-existent-uuid")

    assert response.status_code == 404
    assert "non-existent-uuid" in response.json()["detail"]
