import json
import os
import tempfile
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from config.settings import (
    MCPTransport,
    ModelsConfig,
    ParserBackendType,
    Settings,
    enrich_model_metadata,
    get_mcp_settings,
    get_redis_settings,
    get_settings,
    get_sso_settings,
)


@pytest.mark.parametrize(
    ("capability_config", "expected"),
    [
        ({}, True),
        ({"supports_temperature": False}, False),
        ({"model_info": {"supports_temperature": False}}, False),
        (
            {
                "supports_temperature": False,
                "model_info": {"supports_temperature": True},
            },
            True,
        ),
    ],
)
def test_temperature_capability_configuration(capability_config, expected) -> None:
    config = ModelsConfig(
        type="openai",
        llm_name="test-model",
        endpoint="https://example.test",
        api_key="test",
        **capability_config,
    )

    assert config.model_info.supports_temperature is expected
    assert config.supports_temperature is expected


class TestSettings:
    """Test cases for the Settings class and environment variable handling."""

    def test_settings_default_values(self):
        """Test that settings load with default values when no env vars are set."""
        # Clear any existing environment variables
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.version == ""
            assert settings.app_version == "unknown"
            assert settings.frontend_version == "unknown"
            assert settings.assistant_version == "unknown"

    def test_settings_with_env_variables(self):
        """Test that settings respect environment variables."""
        test_version = "test-version-1.0.0"
        test_app_version = "app-1.0.0"
        test_frontend_version = "frontend-2.0.0"
        test_assistant_version = "assistant-3.0.0"

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_VERSION": test_version,
                "MUCGPT_CORE_APP_VERSION": test_app_version,
                "MUCGPT_CORE_FRONTEND_VERSION": test_frontend_version,
                "MUCGPT_CORE_ASSISTANT_VERSION": test_assistant_version,
            },
        ):
            settings = Settings()
            assert settings.version == test_version
            assert settings.app_version == test_app_version
            assert settings.frontend_version == test_frontend_version
            assert settings.assistant_version == test_assistant_version

    def test_settings_with_version_hash_parsing(self):
        """Test that version strings with @sha256 hashes are parsed correctly."""
        test_version = "0.7.1@sha256:b8cac6b90ec35795edcbd0c2a1ffe6805bbecede411d847b2eda7989e10c3816"
        test_app_version = "3.0.0@sha256:abcd1234"
        test_frontend_version = "1.2.3@sha256:abcd1234"
        test_assistant_version = "2.3.4@sha256:efgh5678"

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_VERSION": test_version,
                "MUCGPT_CORE_APP_VERSION": test_app_version,
                "MUCGPT_CORE_FRONTEND_VERSION": test_frontend_version,
                "MUCGPT_CORE_ASSISTANT_VERSION": test_assistant_version,
            },
        ):
            settings = Settings()
            # Should only parse the version part before the @ symbol
            assert settings.version == "0.7.1"
            assert settings.app_version == "3.0.0"
            assert settings.frontend_version == "1.2.3"
            assert settings.assistant_version == "2.3.4"

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
            assert settings1.version == "cached-test-version"

    def test_frontend_config_defaults(self):
        """Test frontend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.env_name == "MUCGPT"
            assert settings.alternative_logo is False
            assert settings.frontend_version == "unknown"
            assert settings.assistant_version == "unknown"

    def test_backend_config_defaults(self):
        """Test backend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert len(settings.models) == 0
            assert settings.unauthorized_user_redirect_url == ""

    def test_sso_role_defaults_are_unset(self):
        """Test SSO role defaults remain open unless explicitly configured."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.sso.role is None
            assert settings.sso.admin_role is None

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
            assert settings.env_name == "TEST_ENV"
            assert settings.alternative_logo is True

    def test_provider_configuration_from_env(self):
        """Test that provider connection settings come from per-field env vars."""
        providers_json = json.dumps(
            {
                "gateway": {"type": "openai", "endpoint": "https://yaml.test"},
                "azure": {"type": "azure", "endpoint": "https://azure.test"},
            }
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_PROVIDERS__GATEWAY__API_KEY": "env-key",
                "MUCGPT_CORE_PROVIDERS__AZURE__API_KEY": "azure-env-key",
                "MUCGPT_CORE_PROVIDERS__AZURE__API_VERSION": "2025-04-01-preview",
                "MUCGPT_CORE_MODELS": "[]",
            },
        ):
            get_settings.cache_clear()
            settings = Settings()

            assert settings.providers["gateway"].type == "openai"
            assert settings.providers["gateway"].api_key.get_secret_value() == "env-key"
            assert str(settings.providers["gateway"].endpoint) == "https://yaml.test/"
            assert settings.providers["azure"].type == "azure"
            assert (
                settings.providers["azure"].api_key.get_secret_value()
                == "azure-env-key"
            )
            assert settings.providers["azure"].api_version == "2025-04-01-preview"

    def test_provider_keys_must_be_lowercase(self):
        """Uppercase provider keys cannot be matched by env overrides.

        Env-var paths are lowercased by pydantic-settings, so uppercase keys
        can only appear via YAML or init values - the validator rejects them
        there.
        """
        with pytest.raises(ValidationError, match="lowercase"):
            Settings(
                providers={
                    "MYPROV": {
                        "type": "openai",
                        "endpoint": "https://example.test",
                        "api_key": "env-key",
                    }
                }
            )

    def test_model_resolves_provider_reference(self):
        """Model entries pull type/endpoint/api_key/api_version from their provider."""
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://gateway.test",
                    "api_key": "provider-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "test-model",
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
                    "description": "Test model",
                }
            ]
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            get_settings.cache_clear()
            settings = Settings()

            model = settings.models[0]
            assert model.provider == "gateway"
            assert model.type == "openai"
            assert str(model.endpoint) == "https://gateway.test/"
            assert model.api_key.get_secret_value() == "provider-key"
            assert model.llm_name == "test-model"

    def test_model_rejects_inline_provider_fields(self):
        """Inline type/endpoint/api_key on model entries are rejected (hard cut)."""
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "test-model",
                    "endpoint": "https://inline.test",
                    "api_key": "inline-key",
                }
            ]
        )
        with patch.dict(os.environ, {"MUCGPT_CORE_MODELS": models_json}):
            get_settings.cache_clear()
            with pytest.raises(ValidationError, match="provider-level fields"):
                Settings()

    def test_model_requires_provider_reference(self):
        """Model entries without a provider reference are rejected."""
        models_json = json.dumps([{"llm_name": "test-model"}])
        with patch.dict(os.environ, {"MUCGPT_CORE_MODELS": models_json}):
            get_settings.cache_clear()
            with pytest.raises(ValidationError, match="provider"):
                Settings()

    def test_model_rejects_unknown_provider(self):
        """Unknown provider references fail with the available providers listed."""
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://gateway.test",
                    "api_key": "k",
                }
            }
        )
        models_json = json.dumps([{"provider": "nope", "llm_name": "test-model"}])
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            get_settings.cache_clear()
            with pytest.raises(ValidationError, match="Unknown provider 'nope'"):
                Settings()

    def test_model_configuration_from_env(self):
        """Test model configuration from environment variables."""
        providers_json = json.dumps(
            {
                "test-azure": {
                    "type": "azure",
                    "endpoint": "https://test.example.com",
                    "api_key": "test-key",
                    "api_version": "2025-04-01-preview",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "test-azure",
                    "llm_name": "test-model",
                    "deployment": "test-deployment",
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
                    "display_name": "  Test Model  ",
                    "description": "Test model",
                    "short_description": "  Test summary  ",
                    "input_cost_per_token": 9e-8,
                    "output_cost_per_token": 3.6e-7,
                    "supports_reasoning": False,
                    "supports_temperature": False,
                    "knowledge_cut_off": "2023-09-01",
                }
            ]
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            settings = Settings()

            assert len(settings.models) == 1
            model = settings.models[0]
            assert model.type == "azure"
            assert model.llm_name == "test-model"
            assert str(model.endpoint) == "https://test.example.com/"
            assert model.api_key.get_secret_value() == "test-key"
            assert model.api_version == "2025-04-01-preview"
            assert model.max_output_tokens == 1000
            assert model.max_input_tokens == 2000
            assert model.display_name == "Test Model"
            assert model.description == "Test model"
            assert model.short_description == "Test summary"
            assert model.input_cost_per_token == Decimal("9e-8")
            assert model.output_cost_per_token == Decimal("3.6e-7")
            assert model.supports_reasoning is False
            assert model.supports_temperature is False
            assert model.knowledge_cut_off == "2023-09-01"
            assert model.model_info.auto_enrich_from_model_info_endpoint is True

    def test_model_configuration_enriched_from_info_endpoint(self):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4.1-nano",
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
                    "base_model": "azure/gpt-4.1-nano",
                    "display_name": "GPT-4.1 nano",
                    "description": "Small and fast model",
                    "short_description": "Fast everyday model",
                    "supports_reasoning": True,
                    "supported_reasoning_efforts": ["low", "Medium", "bogus", "high"],
                    "default_reasoning_effort": "low",
                    "input_cost_per_token": 9e-8,
                    "output_cost_per_token": 3.6e-7,
                    "knowledge_cut_off": "2024-07-01",
                },
                "litellm_params": {
                    "input_cost_per_token": "9e-08",
                    "output_cost_per_token": "3.6e-07",
                },
            }
        ]

        with patch("config.settings._load_model_info", return_value=info_payload):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.models[0]
                enrich_model_metadata(model)
                assert model.max_output_tokens == 32768
                assert model.max_input_tokens == 1048576
                assert model.description == "Small and fast model"
                assert model.display_name == "GPT-4.1 nano"
                assert model.short_description == "Fast everyday model"
                assert model.supports_reasoning is True
                assert model.input_cost_per_token == Decimal("9e-8")
                assert model.output_cost_per_token == Decimal("3.6e-7")
                assert model.knowledge_cut_off == "2024-07-01"
                assert model.model_info.supported_reasoning_efforts == [
                    "low",
                    "medium",
                    "high",
                ]
                assert model.model_info.default_reasoning_effort == "low"
                assert model.model_info.auto_enrich_from_model_info_endpoint is True

    def test_fallback_reasoning_effort_defaults_to_low_and_is_overridable(self):
        assert Settings().fallback_reasoning_effort == "low"
        with patch.dict(
            os.environ, {"MUCGPT_CORE_FALLBACK_REASONING_EFFORT": "medium"}
        ):
            assert Settings().fallback_reasoning_effort == "medium"
        with patch.dict(
            os.environ, {"MUCGPT_CORE_FALLBACK_REASONING_EFFORT": "extreme"}
        ):
            with pytest.raises(ValidationError):
                Settings()

    def test_configured_reasoning_efforts_win_over_info_endpoint(self):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-6",
                    "supported_reasoning_efforts": ["medium", "high"],
                    "default_reasoning_effort": "medium",
                }
            ]
        )
        info_payload = [
            {
                "model_name": "gpt-6",
                "model_info": {
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
                    "supported_reasoning_efforts": "low, medium",
                    "default_reasoning_effort": "low",
                },
            }
        ]

        with patch("config.settings._load_model_info", return_value=info_payload):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                model = Settings().models[0]
                enrich_model_metadata(model)

        assert model.model_info.supported_reasoning_efforts == ["medium", "high"]
        assert model.model_info.default_reasoning_effort == "medium"

    def test_reasoning_efforts_parsed_from_comma_separated_info(self):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-6",
                }
            ]
        )
        info_payload = [
            {
                "model_name": "gpt-6",
                "model_info": {
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
                    "supported_reasoning_efforts": "low, medium,high",
                    "default_reasoning_effort": "extreme",
                },
            }
        ]

        with patch("config.settings._load_model_info", return_value=info_payload):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                model = Settings().models[0]
                enrich_model_metadata(model)

        assert model.model_info.supported_reasoning_efforts == [
            "low",
            "medium",
            "high",
        ]
        assert model.model_info.default_reasoning_effort is None

    def test_model_configuration_missing_metadata_raises_without_info(self):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                }
            ]
        )

        with patch(
            "config.settings._load_model_info",
            side_effect=RuntimeError("network error"),
        ):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.models[0]
                with pytest.raises(ValueError):
                    enrich_model_metadata(model)

    def test_model_configuration_auto_enrich_from_model_info_endpoint_disabled_requires_manual_data(
        self,
    ):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "description": "Manual",
                    },
                }
            ]
        )

        with patch("config.settings._load_model_info") as mocked:
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                with pytest.raises(ValueError):
                    Settings()
        mocked.assert_not_called()

    def test_model_configuration_auto_enrich_from_model_info_endpoint_disabled_with_complete_data(
        self,
    ):
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "max_input_tokens": 2000,
                        "description": "Manual",
                        "supports_reasoning": False,
                    },
                }
            ]
        )

        with patch("config.settings._load_model_info") as mocked:
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PROVIDERS": providers_json,
                    "MUCGPT_CORE_MODELS": models_json,
                },
            ):
                settings = Settings()
                model = settings.models[0]
                assert model.max_output_tokens == 1000
                assert model.max_input_tokens == 2000
                assert model.description == "Manual"
                assert model.supports_reasoning is False
        mocked.assert_not_called()

    def test_model_context_usage_thresholds_default(self):
        """Context usage thresholds default to 75/90 when not configured."""
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "max_input_tokens": 2000,
                        "description": "Manual",
                    },
                }
            ]
        )

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            settings = Settings()
            model = settings.models[0]
            assert model.context_warning_threshold_percent == 75
            assert model.context_critical_threshold_percent == 90

    def test_model_context_usage_thresholds_configurable_per_model(self):
        """Context usage thresholds can be overridden per model."""
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "max_input_tokens": 2000,
                        "description": "Manual",
                        "context_warning_threshold_percent": 60,
                        "context_critical_threshold_percent": 80,
                    },
                }
            ]
        )

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            settings = Settings()
            model = settings.models[0]
            assert model.context_warning_threshold_percent == 60
            assert model.context_critical_threshold_percent == 80

    def test_model_context_usage_thresholds_reject_warning_above_critical(self):
        """The warning threshold must stay below the critical threshold."""
        providers_json = json.dumps(
            {
                "gateway": {
                    "type": "openai",
                    "endpoint": "https://exampleproxy/v1",
                    "api_key": "proxy-key",
                }
            }
        )
        models_json = json.dumps(
            [
                {
                    "provider": "gateway",
                    "llm_name": "gpt-4o-mini",
                    "model_info": {
                        "auto_enrich_from_model_info_endpoint": False,
                        "max_output_tokens": 1000,
                        "max_input_tokens": 2000,
                        "description": "Manual",
                        "context_warning_threshold_percent": 90,
                        "context_critical_threshold_percent": 75,
                    },
                }
            ]
        )

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PROVIDERS": providers_json,
                "MUCGPT_CORE_MODELS": models_json,
            },
        ):
            with pytest.raises(ValidationError):
                Settings()

    def test_sso_settings(self):
        """Test SSO settings configuration via nested env vars."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_SSO__ROLE": "custom-role",
            },
        ):
            get_sso_settings.cache_clear()
            get_settings.cache_clear()
            sso_settings = get_sso_settings()
            assert sso_settings.role == "custom-role"

    def test_sso_settings_default(self):
        """Test SSO settings default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_sso_settings.cache_clear()
            get_settings.cache_clear()
            sso_settings = get_sso_settings()
            assert sso_settings.role is None

    def test_mcp_settings(self):
        """Test MCP settings configuration via nested env vars."""
        mcp_json = json.dumps(
            {
                "test": {
                    "url": "https://example.com/mcp",
                    "forward_token": True,
                    "forward_auth_override": "Basic dXNlcjpwYXNz",
                    "transport": MCPTransport.STREAMABLE_HTTP.value,
                    "headers": {
                        "x-api-key": "sk-1234",
                        "X-Test": "true",
                    },
                }
            }
        )
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_MCP__SOURCES": mcp_json,
                "MUCGPT_CORE_MCP__CACHE_TTL": "123",
            },
        ):
            get_mcp_settings.cache_clear()
            get_settings.cache_clear()
            mcp_settings = get_mcp_settings()
            assert len(mcp_settings.sources.keys()) == 1
            assert mcp_settings.sources["test"].url == "https://example.com/mcp"
            assert (
                mcp_settings.sources["test"].transport is MCPTransport.STREAMABLE_HTTP
            )
            assert mcp_settings.sources["test"].forward_token
            assert (
                mcp_settings.sources["test"].forward_auth_override.get_secret_value()
                == "Basic dXNlcjpwYXNz"
            )
            assert (
                mcp_settings.sources["test"].headers["x-api-key"].get_secret_value()
                == "sk-1234"
            )
            assert (
                mcp_settings.sources["test"].headers["X-Test"].get_secret_value()
                == "true"
            )
            assert mcp_settings.cache_ttl == 123

    def test_mcp_settings_forward_auth_override_requires_forward_token(self):
        """forward_auth_override must not be configured without forward_token=true."""
        mcp_json = json.dumps(
            {
                "test": {
                    "url": "https://example.com/mcp",
                    "forward_token": False,
                    "forward_auth_override": "Basic dXNlcjpwYXNz",
                    "transport": MCPTransport.STREAMABLE_HTTP.value,
                }
            }
        )

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_MCP__SOURCES": mcp_json,
            },
        ):
            get_mcp_settings.cache_clear()
            get_settings.cache_clear()
            with pytest.raises(ValueError):
                get_mcp_settings()

    def test_mcp_settings_default(self):
        """Test MCP settings default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_mcp_settings.cache_clear()
            get_settings.cache_clear()
            mcp_settings = get_mcp_settings()
            assert mcp_settings.sources is None
            assert mcp_settings.cache_ttl == 43200

    def test_yaml_configuration_loading(self, monkeypatch):
        """Test that settings can be loaded from YAML configuration file."""
        yaml_content = """
version: "yaml-test-1.0"
env_name: "YAML_TEST"
alternative_logo: true
sso:
  role: "yaml-test-role"
redis:
  host: "yaml-redis-host"
  port: 9999
mcp:
  cache_ttl: 999
providers:
  gateway:
    type: "openai"
    endpoint: "https://yaml.test.example.com"
    api_key: "yaml-test-key"
models:
  - provider: "gateway"
    llm_name: "yaml-test-model"
    model_info:
      auto_enrich_from_model_info_endpoint: false
      max_output_tokens: 2000
      max_input_tokens: 4000
      description: "YAML test model"
"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            # Change to the temp directory so the config.yaml is found
            monkeypatch.chdir(tmpdir)
            # Clear environment variables that might override
            with patch.dict(os.environ, {}, clear=True):
                settings = Settings()
                assert settings.version == "yaml-test-1.0"
                assert settings.env_name == "YAML_TEST"
                assert settings.alternative_logo is True
                # Verify nested configs loaded from YAML
                assert settings.sso.role == "yaml-test-role"
                assert settings.redis.host == "yaml-redis-host"
                assert settings.redis.port == 9999
                assert settings.mcp.cache_ttl == 999
                # Verify models
                assert len(settings.models) == 1
                model = settings.models[0]
                assert model.type == "openai"
                assert model.llm_name == "yaml-test-model"
                assert model.max_output_tokens == 2000
                assert model.max_input_tokens == 4000
                assert model.description == "YAML test model"

    def test_env_variables_override_yaml(self, monkeypatch):
        """Test that environment variables have priority over YAML configuration."""
        yaml_content = """
version: "yaml-version"
env_name: "YAML_ENV"
"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            monkeypatch.chdir(tmpdir)
            # Environment variables should override YAML
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_VERSION": "env-version",
                },
            ):
                settings = Settings()
                assert settings.version == "env-version"  # From env
                assert settings.env_name == "YAML_ENV"  # From YAML

    def teardown_method(self):
        """Clean up after each test."""
        # Clear the cache to ensure tests don't interfere with each other
        get_settings.cache_clear()
        get_sso_settings.cache_clear()
        get_mcp_settings.cache_clear()
        get_redis_settings.cache_clear()


class TestPromptPoolSettings:
    """Test nested prompt-pool configuration."""

    def test_defaults(self):
        with patch.dict(os.environ, {}, clear=True):
            prompts = Settings().prompts

        assert prompts.folders == []

    def test_environment_configuration(self):
        prompt_config = json.dumps(
            {
                "folders": [
                    {
                        "name": "custom",
                        "prompts": [{"name": "example", "label": "staging"}],
                    }
                ]
            }
        )
        with patch.dict(
            os.environ,
            {"MUCGPT_CORE_PROMPTS": prompt_config},
            clear=True,
        ):
            prompts = Settings().prompts

        assert prompts.folders[0].name == "custom"
        assert prompts.folders[0].prompts[0].name == "example"
        assert prompts.folders[0].prompts[0].label == "staging"

    def test_yaml_configuration(self, monkeypatch):
        yaml_content = """
prompts:
  folders:
    - name: "yaml-folder"
      prompts:
        - name: "yaml-prompt"
          label: "latest"
"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            (Path(tmpdir) / "config.yaml").write_text(yaml_content)
            monkeypatch.chdir(tmpdir)
            with patch.dict(os.environ, {}, clear=True):
                prompts = Settings().prompts

        assert prompts.folders[0].name == "yaml-folder"
        assert prompts.folders[0].prompts[0].name == "yaml-prompt"
        assert prompts.folders[0].prompts[0].label == "latest"


class TestParserSettings:
    """Test cases for parsing / XBerg configuration."""

    def test_parser_backend_default(self):
        """PARSER_BACKEND defaults to 'none'."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.parser_backend == ParserBackendType.NONE

    def test_xberg_url_and_timeout_defaults(self):
        """XBERG_URL defaults to empty string and XBERG_TIMEOUT to 120.0."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.xberg_url == ""
            assert settings.xberg_timeout == 120.0


class TestComplianceCacheSettings:
    """Test cases for compliance cache configuration."""

    def test_compliance_cache_ttl_default_and_positive_value(self):
        """COMPLIANCE_CACHE_TTL_SECONDS defaults correctly and allows positive values."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.compliance_cache_ttl_seconds == 1800

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_COMPLIANCE_CACHE_TTL_SECONDS": "300",
            },
        ):
            settings = Settings()
            assert settings.compliance_cache_ttl_seconds == 300

    def test_compliance_cache_ttl_rejects_zero_and_negative(self):
        """COMPLIANCE_CACHE_TTL_SECONDS must be strictly positive."""
        for invalid_ttl in ("0", "-1"):
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_COMPLIANCE_CACHE_TTL_SECONDS": invalid_ttl,
                },
            ):
                with pytest.raises(ValueError):
                    Settings()

    def test_parser_backend_xberg_via_env(self):
        """PARSER_BACKEND can be set to 'xberg' via environment variable."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PARSER_BACKEND": "xberg",
                "MUCGPT_CORE_XBERG_URL": "https://xberg.example.com",
                "MUCGPT_CORE_XBERG_TIMEOUT": "60.5",
            },
        ):
            settings = Settings()
            assert settings.parser_backend == ParserBackendType.XBERG
            assert settings.xberg_url == "https://xberg.example.com"
            assert settings.xberg_timeout == 60.5

    def test_parser_backend_none_via_env(self):
        """PARSER_BACKEND can be explicitly set to 'none' via environment variable."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PARSER_BACKEND": "none",
            },
        ):
            settings = Settings()
            assert settings.parser_backend == ParserBackendType.NONE

    def test_parser_backend_invalid_value_raises(self):
        """An invalid PARSER_BACKEND value raises a validation error."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_PARSER_BACKEND": "invalid_backend",
            },
        ):
            with pytest.raises(Exception):
                Settings()

    def test_parser_settings_from_yaml(self, monkeypatch):
        """Parsing settings can be loaded from a YAML configuration file."""
        yaml_content = """
parser_backend: "xberg"
xberg_url: "https://yaml-xberg.example.com"
xberg_timeout: 30.0
"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            monkeypatch.chdir(tmpdir)
            with patch.dict(os.environ, {}, clear=True):
                settings = Settings()
                assert settings.parser_backend == ParserBackendType.XBERG
                assert settings.xberg_url == "https://yaml-xberg.example.com"
                assert settings.xberg_timeout == 30.0

    def test_env_overrides_yaml_for_parser(self, monkeypatch):
        """Environment variables override YAML for parsing settings."""
        yaml_content = """
parser_backend: "xberg"
xberg_url: "https://yaml-xberg.example.com"
xberg_timeout: 30.0
"""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            config_path = Path(tmpdir) / "config.yaml"
            config_path.write_text(yaml_content)

            monkeypatch.chdir(tmpdir)
            with patch.dict(
                os.environ,
                {
                    "MUCGPT_CORE_PARSER_BACKEND": "none",
                    "MUCGPT_CORE_XBERG_TIMEOUT": "999.9",
                },
            ):
                settings = Settings()
                assert settings.parser_backend == ParserBackendType.NONE
                assert settings.xberg_timeout == 999.9
                assert (
                    settings.xberg_url == "https://yaml-xberg.example.com"
                )  # from YAML

    def teardown_method(self):
        get_settings.cache_clear()


class TestTranscriptionSettings:
    """Test cases for browser transcription feature flag configuration."""

    def test_transcription_enabled_default(self):
        """TRANSCRIPTION_ENABLED defaults to False."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.transcription_enabled is False

    def test_transcription_enabled_via_env(self):
        """TRANSCRIPTION_ENABLED can be enabled via environment variable."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_TRANSCRIPTION_ENABLED": "true",
            },
        ):
            settings = Settings()
            assert settings.transcription_enabled is True

    def teardown_method(self):
        get_settings.cache_clear()


class TestAiActComplianceCheckSettings:
    """Test cases for AI Act compliance check frontend feature flag configuration."""

    def test_ai_act_compliance_check_enabled_default(self):
        """AI_ACT_COMPLIANCE_CHECK_ENABLED defaults to True."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
            assert settings.ai_act_compliance_check_enabled is True

    def test_ai_act_compliance_check_enabled_via_env(self):
        """AI_ACT_COMPLIANCE_CHECK_ENABLED can be disabled via environment variable."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_AI_ACT_COMPLIANCE_CHECK_ENABLED": "false",
            },
        ):
            settings = Settings()
            assert settings.ai_act_compliance_check_enabled is False

    def teardown_method(self):
        get_settings.cache_clear()


class TestRedisSettings:
    """Test cases for Redis configuration (nested under Settings)."""

    def test_redis_settings_via_nested_env(self):
        """Test that Redis settings can be configured via nested env vars."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_REDIS__HOST": "env-redis-host",
                "MUCGPT_CORE_REDIS__PORT": "1234",
                "MUCGPT_CORE_REDIS__USERNAME": "env-user",
                "MUCGPT_CORE_REDIS__PASSWORD": "env-pass",
            },
        ):
            get_settings.cache_clear()
            get_redis_settings.cache_clear()
            redis = get_redis_settings()
            assert redis.host == "env-redis-host"
            assert redis.port == 1234
            assert redis.username.get_secret_value() == "env-user"
            assert redis.password.get_secret_value() == "env-pass"

    def test_redis_settings_defaults(self):
        """Test Redis default values."""
        with patch.dict(os.environ, {}, clear=True):
            get_settings.cache_clear()
            get_redis_settings.cache_clear()
            redis = get_redis_settings()
            assert redis.host is None
            assert redis.port == 6379
            assert redis.username is None
            assert redis.password is None

    def teardown_method(self):
        get_settings.cache_clear()
        get_redis_settings.cache_clear()
