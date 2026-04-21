from unittest.mock import patch

import pytest

from config.settings import ParserBackendType, Settings

headers = {
    "Authorization": "Bearer dummy_access_token",
}


@pytest.mark.integration
def test_config_endpoint(test_client):
    """Test the /config endpoint returns application configuration."""
    response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "app_version" in data
    assert "core_version" in data
    assert "frontend_version" in data  # Note: typo in API model
    assert "assistant_version" in data
    assert "env_name" in data
    assert "alternative_logo" in data
    assert "models" in data
    assert isinstance(data["models"], list)


@pytest.mark.integration
def test_health_check(test_client):
    """Test the /health endpoint returns OK."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.text == '"OK"'


@pytest.mark.integration
def test_document_processing_enabled_when_parser_backend_set(test_client):
    """document_processing_enabled is True when PARSER_BACKEND is set to kreuzberg."""
    mock_settings = Settings(
        PARSER_BACKEND=ParserBackendType.KREUZBERG,
        KREUZBERG_URL="https://kreuzberg.example.com",
    )
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["document_processing_enabled"] is True


@pytest.mark.integration
def test_document_processing_disabled_when_no_parser_backend(test_client):
    """document_processing_enabled is False when PARSER_BACKEND is 'none' (default)."""
    mock_settings = Settings(PARSER_BACKEND=ParserBackendType.NONE)
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["document_processing_enabled"] is False
