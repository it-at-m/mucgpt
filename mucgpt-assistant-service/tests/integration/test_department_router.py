from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

# Headers for authentication
headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.fixture(autouse=True)
def mock_ldap_enabled(monkeypatch):
    """Ensure LDAP is 'enabled' for tests to bypass the check."""
    monkeypatch.setenv("MUCGPT_LDAP_ENABLED", "true")


@pytest.mark.integration
def test_get_directory(test_client, monkeypatch):
    """Test the /directory endpoint."""
    mock_tree = [{"shortname": "DEPT1", "name": "Department 1", "children": []}]

    # Mock the directory cache function
    mock_get_tree = AsyncMock(return_value=mock_tree)
    monkeypatch.setattr(
        "core.directory_cache.get_simplified_directory_tree", mock_get_tree
    )

    response = test_client.get("directory", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["shortname"] == "DEPT1"
    assert data[0]["name"] == "Department 1"


@pytest.mark.integration
def test_get_directory_children(test_client, monkeypatch):
    """Test the /directory/children endpoint."""
    mock_children = [{"shortname": "SUB1", "name": "Sub Department 1", "children": []}]

    # Mock the directory cache function
    mock_get_children = AsyncMock(return_value=mock_children)
    monkeypatch.setattr(
        "core.directory_cache.get_directory_children_by_path", mock_get_children
    )

    # Test with path parameters
    response = test_client.get("directory/children?path=DEPT1", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["shortname"] == "SUB1"
    mock_get_children.assert_called_once_with(["DEPT1"])


@pytest.mark.integration
def test_get_directory_children_not_found(test_client, monkeypatch):
    """Test the /directory/children endpoint with a non-existent path."""
    # Mock the directory cache function to raise 404
    mock_get_children = AsyncMock(
        side_effect=HTTPException(status_code=404, detail="Path segment not found")
    )
    monkeypatch.setattr(
        "core.directory_cache.get_directory_children_by_path", mock_get_children
    )

    response = test_client.get("directory/children?path=NONEXISTENT", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Path segment not found"
