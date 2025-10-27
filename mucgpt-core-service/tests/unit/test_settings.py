import os
from unittest.mock import patch

from src.config.settings import (
    Settings,
    get_langfuse_settings,
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
        import json

        models_json = json.dumps(
            [
                {
                    "type": "AZURE",
                    "llm_name": "test-model",
                    "endpoint": "https://test.example.com",
                    "api_key": "test-key",
                    "max_output_tokens": 1000,
                    "max_input_tokens": 2000,
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

    def teardown_method(self):
        """Clean up after each test."""
        # Clear the cache to ensure tests don't interfere with each other
        get_settings.cache_clear()
        get_sso_settings.cache_clear()
        get_langfuse_settings.cache_clear()
