from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

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
    assert "admin_role" in data
    assert "models" in data
    assert isinstance(data["models"], list)


@pytest.mark.integration
def test_config_endpoint_includes_admin_role(test_client):
    """admin_role is sourced from the configured SSO admin role."""
    mock_settings = Settings(sso={"admin_role": "custom-admin-role"})
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["admin_role"] == "custom-admin-role"


@pytest.mark.integration
def test_config_endpoint_includes_model_display_name(test_client):
    """Models expose their configured display_name next to the llm_name identifier."""
    mock_settings = Settings(
        providers={
            "gateway": {
                "type": "openai",
                "endpoint": "https://example.com/v1",
                "api_key": "key",
            }
        },
        models=[
            {
                "provider": "gateway",
                "llm_name": "gpt-5.6-terra",
                "display_name": "GPT-5.6 Terra",
                "max_output_tokens": 1000,
                "max_input_tokens": 2000,
                "description": "Test model",
                "auto_enrich_from_model_info_endpoint": False,
            },
            {
                "provider": "gateway",
                "llm_name": "mistral-large-3",
                "max_output_tokens": 1000,
                "max_input_tokens": 2000,
                "description": "Test model",
                "auto_enrich_from_model_info_endpoint": False,
            },
        ],
    )
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    models = {m["llm_name"]: m for m in response.json()["models"]}
    assert models["gpt-5.6-terra"]["display_name"] == "GPT-5.6 Terra"
    assert models["mistral-large-3"]["display_name"] is None


@pytest.mark.integration
def test_health_check(test_client):
    """Test the /health endpoint returns OK."""
    response = test_client.get("/health")
    assert response.status_code == 200
    assert response.text == '"OK"'


@pytest.mark.integration
def test_document_processing_enabled_when_parser_backend_set(test_client):
    """document_processing_enabled is True when PARSER_BACKEND is set to xberg."""
    mock_settings = Settings(
        parser_backend=ParserBackendType.XBERG,
        xberg_url="https://xberg.example.com",
    )
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["document_processing_enabled"] is True


@pytest.mark.integration
def test_document_processing_disabled_when_no_parser_backend(test_client):
    """document_processing_enabled is False when PARSER_BACKEND is 'none' (default)."""
    mock_settings = Settings(parser_backend=ParserBackendType.NONE)
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["document_processing_enabled"] is False


@pytest.mark.integration
def test_transcription_enabled_reflects_settings(test_client):
    """transcription_enabled follows the TRANSCRIPTION_ENABLED setting."""
    mock_settings = Settings(transcription_enabled=True)
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["transcription_enabled"] is True


@pytest.mark.integration
def test_transcription_disabled_by_default(test_client):
    """transcription_enabled is False by default."""
    mock_settings = Settings()
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["transcription_enabled"] is False


@pytest.mark.integration
def test_ai_act_compliance_check_enabled_reflects_settings(test_client):
    """ai_act_compliance_check_enabled follows the AI_ACT_COMPLIANCE_CHECK_ENABLED setting."""
    mock_settings = Settings(ai_act_compliance_check_enabled=True)
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["ai_act_compliance_check_enabled"] is True


@pytest.mark.integration
def test_ai_act_compliance_check_disabled_reflects_settings(test_client):
    """ai_act_compliance_check_enabled is False when the setting is disabled."""
    mock_settings = Settings(ai_act_compliance_check_enabled=False)
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["ai_act_compliance_check_enabled"] is False


@pytest.mark.integration
def test_transcription_default_model_reflects_settings(test_client: TestClient):
    """transcription_default_model follows the TRANSCRIPTION_DEFAULT_MODEL setting."""
    mock_settings = Settings(
        transcription_default_model="efederici/parakeet-tdt-0.6b-v3-onnx-int4"
    )
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert (
        response.json()["transcription_default_model"]
        == "efederici/parakeet-tdt-0.6b-v3-onnx-int4"
    )


@pytest.mark.integration
def test_transcription_default_model_none_by_default(test_client: TestClient):
    """transcription_default_model is None by default."""
    mock_settings = Settings()
    with patch("api.routers.system_router.settings", mock_settings):
        response = test_client.get("/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["transcription_default_model"] is None
