import json
import os
import tempfile
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from src.config.settings import (
    MCPTransport,
    Settings,
    enrich_model_metadata,
    get_langfuse_settings,
    get_mcp_settings,
    get_settings,
    get_sso_settings,
)


class TestSettings:
    """Test cases for the Settings class and environment variable handling."""

    def test_settings_default_values(self):
        """Test that settings load with default values when no env vars are set."""
        # Clear any existing environment variables
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.VERSION == ""
            assert settings.FRONTEND_VERSION == "unknown"
            assert settings.ASSISTANT_VERSION == "unknown"

    def test_settings_with_env_variables(self):
        """Test that settings respect environment variables."""
        test_version = "test-version-1.0.0"
        test_frontend_version = "frontend-2.0.0"
        test_assistant_version = "assistant-3.0.0"

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_VERSION": test_version,
                "MUCGPT_CORE_FRONTEND_VERSION": test_frontend_version,
                "MUCGPT_CORE_ASSISTANT_VERSION": test_assistant_version,
            },
        ):
            settings = Settings()
            assert settings.VERSION == test_version
            assert settings.FRONTEND_VERSION == test_frontend_version
            assert settings.ASSISTANT_VERSION == test_assistant_version

    def test_get_settings_cached(self):
        """Test that get_settings returns cached instance."""
        # Clear cache first
        get_settings.cache_clear()

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_VERSION": "cached-test-version",
            },
        ):
            settings1 = get_settings()
            settings2 = get_settings()  # Should be the same instance due to caching
            assert settings1 is settings2
            assert settings1.VERSION == "cached-test-version"

    def test_frontend_config_defaults(self):
        """Test frontend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.ENV_NAME == "MUCGPT"
            assert settings.ALTERNATIVE_LOGO is False
            assert settings.FRONTEND_VERSION == "unknown"
            assert settings.ASSISTANT_VERSION == "unknown"

    def test_backend_config_defaults(self):
        """Test backend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert len(settings.MODELS) == 0
            assert settings.UNAUTHORIZED_USER_REDIRECT_URL == ""

    def test_nested_env_variables(self):
        """Test that nested environment variables work correctly."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_ENV_NAME": "TEST_ENV",
                "MUCGPT_CORE_ALTERNATIVE_LOGO": "true",
            },
        ):
            settings = Settings()
            assert settings.ENV_NAME == "TEST_ENV"
            assert settings.ALTERNATIVE_LOGO is True

    def test_model_configuration_from_env(self):
        """Test model configuration from environment variables."""
        models_json = json.dumps(
            [
                {
                    "type": "AZURE",
                    "llm_name": "test-model",
                    "endpoint": "https://test.example.com",
                    "api_key": "test-key",
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
                    "description": "Test model",
                    "input_cost_per_token": 9e-8,
                    "output_cost_per_token": 3.6e-7,
                    "supports_function_calling": True,
                    "supports_reasoning": False,
                    "supports_vision": True,
                    "litellm_provider": "azure",
                    "inference_location": "azure/eu",
                    "knowledge_cut_off": "2023-09-01",
                }
            ]
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            settings = Settings()

            assert len(settings.MODELS) == 1
            model = settings.MODELS[0]
            assert model.type == "AZURE"
            assert model.llm_name == "test-model"
            assert str(model.endpoint) == "https://test.example.com/"
            assert model.api_key.get_secret_value() == "test-key"
            assert model.max_output_tokens == 1000
            assert model.max_input_tokens == 2000
            assert model.description == "Test model"
            assert model.input_cost_per_token == Decimal("9e-8")
            assert model.output_cost_per_token == Decimal("3.6e-7")
            assert model.supports_function_calling is True
            assert model.supports_reasoning is False
            assert model.supports_vision is True
            assert model.litellm_provider == "azure"
            assert model.inference_location == "azure/eu"
            assert model.knowledge_cut_off == "2023-09-01"
            assert model.model_info.auto_enrich_from_model_info_endpoint is True

    def test_model_configuration_enriched_from_info_endpoint(self):
        models_json = json.dumps(
            [
                {
                    "type": "OPENAI",
                    "llm_name": "gpt-4.1-nano",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            ]
        )

        info_payload = [
            {
                "model_name": "gpt-4.1-nano",
                "model_info": {
                    "max_output_tokens": 32768,
                    "max_input_tokens": 1048576,
                    "version": "2025-04-14",
                    "inference_location": "azure/datazone/eu",
                    "base_model": "azure/gpt-4.1-nano",
                    "supports_function_calling": True,
                    "supports_reasoning": True,
                    "supports_vision": True,
                    "input_cost_per_token": 9e-8,
                    "output_cost_per_token": 3.6e-7,
                    "litellm_provider": "azure",
                    "knowledge_cut_off": "2024-07-01",
                },
                "litellm_params": {
                    "input_cost_per_token": "9e-08",
                    "output_cost_per_token": "3.6e-07",
                },
            }
        ]

        with patch("src.config.settings._load_model_info", return_value=info_payload):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.MODELS[0]
                enrich_model_metadata(model)
                assert model.max_output_tokens == 32768
                assert model.max_input_tokens == 1048576
                assert "gpt-4.1-nano" in model.description
                assert model.supports_function_calling is True
                assert model.supports_reasoning is True
                assert model.supports_vision is True
                assert model.input_cost_per_token == Decimal("9e-8")
                assert model.output_cost_per_token == Decimal("3.6e-7")
                assert model.litellm_provider == "azure"
                assert model.inference_location == "azure/datazone/eu"
                assert model.knowledge_cut_off == "2024-07-01"
                assert model.model_info.auto_enrich_from_model_info_endpoint is True

    def test_model_configuration_missing_metadata_raises_without_info(self):
        models_json = json.dumps(
            [
                {
                    "type": "OPENAI",
                    "llm_name": "gpt-4o-mini",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            ]
        )

        with patch(
            "src.config.settings._load_model_info",
            side_effect=RuntimeError("network error"),
        ):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.MODELS[0]
                with pytest.raises(ValueError):
                    enrich_model_metadata(model)

    def test_model_configuration_auto_enrich_from_model_info_endpoint_disabled_requires_manual_data(
        self,
    ):
        models_json = json.dumps(
            [
                {
                    "type": "OPENAI",
                    "llm_name": "gpt-4o-mini",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "description": "Manual",
                    },
                }
            ]
        )

        with patch("src.config.settings._load_model_info") as mocked:
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                with pytest.raises(ValueError):
                    Settings()
        mocked.assert_not_called()

    def test_model_configuration_auto_enrich_from_model_info_endpoint_disabled_with_complete_data(
        self,
    ):
        models_json = json.dumps(
            [
                {
                    "type": "OPENAI",
                    "llm_name": "gpt-4o-mini",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "max_input_tokens": 2000,
                        "description": "Manual",
                        "supports_function_calling": False,
                    },
                }
            ]
        )

        with patch("src.config.settings._load_model_info") as mocked:
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.MODELS[0]
                assert model.max_output_tokens == 1000
                assert model.max_input_tokens == 2000
                assert model.description == "Manual"
                assert model.supports_function_calling is False
        mocked.assert_not_called()

    def test_sso_settings(self):
        """Test SSO settings configuration."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_SSO_ROLE": "custom-role",
            },
        ):
            get_sso_settings.cache_clear()
            sso_settings = get_sso_settings()
            assert sso_settings.ROLE == "custom-role"

    def test_sso_settings_default(self):
        """Test SSO settings default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_sso_settings.cache_clear()
            sso_settings = get_sso_settings()
            assert sso_settings.ROLE == "lhm-ab-mucgpt-user"

    def test_langfuse_settings(self):
        """Test Langfuse settings configuration."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_LANGFUSE_PUBLIC_KEY": "test-public-key",
                "MUCGPT_LANGFUSE_SECRET_KEY": "test-secret-key",
                "MUCGPT_LANGFUSE_HOST": "https://langfuse.example.com",
            },
        ):
            get_langfuse_settings.cache_clear()
            langfuse_settings = get_langfuse_settings()
            assert langfuse_settings.PUBLIC_KEY == "test-public-key"
            assert langfuse_settings.SECRET_KEY == "test-secret-key"
            assert langfuse_settings.HOST == "https://langfuse.example.com"

    def test_langfuse_settings_default(self):
        """Test Langfuse settings default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_langfuse_settings.cache_clear()
            langfuse_settings = get_langfuse_settings()
            assert langfuse_settings.PUBLIC_KEY is None
            assert langfuse_settings.SECRET_KEY is None
            assert langfuse_settings.HOST is None

    def test_mcp_settings(self):
        """Test MCP settings configuration."""
        mcp_json = json.dumps(
            {
                "test": {
                    "url": "https://example.com/mcp",
                    "forward_token": True,
                    "transport": MCPTransport.STREAMABLE_HTTP.value,
                }
            }
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_MCP_SOURCES": mcp_json,
                "MUCGPT_MCP_CACHE_TTL": "123",
            },
        ):
            get_mcp_settings.cache_clear()
            mcp_settings = get_mcp_settings()
            assert len(mcp_settings.SOURCES.keys()) == 1
            assert mcp_settings.SOURCES["test"].url == "https://example.com/mcp"
            assert (
                mcp_settings.SOURCES["test"].transport is MCPTransport.STREAMABLE_HTTP
            )
            assert mcp_settings.SOURCES["test"].forward_token
            assert mcp_settings.CACHE_TTL == 123

    def test_mcp_settings_default(self):
        """Test MCP settings default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_mcp_settings.cache_clear()
            mcp_settings = get_mcp_settings()
            assert mcp_settings.SOURCES is None
            assert mcp_settings.CACHE_TTL == 43200

    def test_yaml_configuration_loading(self):
        """Test that settings can be loaded from YAML configuration file."""
        yaml_content = """
VERSION: "yaml-test-1.0"
ENV_NAME: "YAML_TEST"
ALTERNATIVE_LOGO: true
MODELS:
  - type: "OPENAI"
    llm_name: "yaml-test-model"
    endpoint: "https://yaml.test.example.com"
    api_key: "yaml-test-key"
    model_info:
      auto_enrich_from_model_info_endpoint: false
      max_output_tokens: 2000
      max_input_tokens: 4000
      description: "YAML test model"
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            # Change to the temp directory so the config.yaml is found
            original_dir = os.getcwd()
            try:
                os.chdir(tmpdir)
                # Clear environment variables that might override
                with patch.dict(os.environ, {}, clear=True):
                    settings = Settings()
                    assert settings.VERSION == "yaml-test-1.0"
                    assert settings.ENV_NAME == "YAML_TEST"
                    assert settings.ALTERNATIVE_LOGO is True
                    assert len(settings.MODELS) == 1
                    model = settings.MODELS[0]
                    assert model.type == "OPENAI"
                    assert model.llm_name == "yaml-test-model"
                    assert model.max_output_tokens == 2000
                    assert model.max_input_tokens == 4000
                    assert model.description == "YAML test model"
            finally:
                os.chdir(original_dir)

    def test_env_variables_override_yaml(self):
        """Test that environment variables have priority over YAML configuration."""
        yaml_content = """
VERSION: "yaml-version"
ENV_NAME: "YAML_ENV"
"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            original_dir = os.getcwd()
            try:
                os.chdir(tmpdir)
                # Environment variables should override YAML
                with patch.dict(
                    os.environ,
                    {
                        "MUCGPT_CORE_VERSION": "env-version",
                    },
                ):
                    settings = Settings()
                    assert settings.VERSION == "env-version"  # From env
                    assert settings.ENV_NAME == "YAML_ENV"  # From YAML
            finally:
                os.chdir(original_dir)

    def teardown_method(self):
        """Clean up after each test."""
        # Clear the cache to ensure tests don't interfere with each other
        get_settings.cache_clear()
        get_sso_settings.cache_clear()
        get_langfuse_settings.cache_clear()
