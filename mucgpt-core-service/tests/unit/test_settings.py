import os
from unittest.mock import patch

from config.settings import Settings, get_settings


class TestSettings:
    """Test cases for the Settings class and environment variable handling."""

    def test_settings_default_values(self):
        """Test that settings load with default values when no env vars are set."""
        # Clear any existing environment variables
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            # Check that version and commit have some default values
            assert settings.version is not None
            assert settings.commit is not None
            assert len(settings.version) > 0
            assert len(settings.commit) > 0

    def test_settings_with_env_variables(self):
        """Test that settings respect environment variables."""
        test_version = "test-version-1.0.0"
        test_commit = "abc123def456"

        with patch.dict(
            os.environ,
            {"MUCGPT_CORE_VERSION": test_version, "MUCGPT_CORE_COMMIT": test_commit},
        ):
            settings = Settings()

            assert settings.version == test_version
            assert settings.commit == test_commit

    def test_get_settings_cached(self):
        """Test that get_settings returns cached instance."""
        # Clear cache first
        get_settings.cache_clear()

        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_VERSION": "cached-test-version",
                "MUCGPT_CORE_COMMIT": "cached-test-commit",
            },
        ):
            settings1 = get_settings()
            settings2 = get_settings()

            # Should be the same instance due to caching
            assert settings1 is settings2
            assert settings1.version == "cached-test-version"
            assert settings1.commit == "cached-test-commit"

    def test_frontend_config_defaults(self):
        """Test frontend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            assert settings.frontend.labels.env_name == "MUCGPT"
            assert settings.frontend.alternative_logo is False

    def test_backend_config_defaults(self):
        """Test backend configuration defaults."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()

            assert settings.backend.enable_auth is False
            assert settings.backend.sso_config.role == "lhm-ab-mucgpt-user"
            assert len(settings.backend.models) == 0

    def test_nested_env_variables(self):
        """Test that nested environment variables work correctly."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_CORE_FRONTEND__LABELS__ENV_NAME": "TEST_ENV",
                "MUCGPT_CORE_FRONTEND__ALTERNATIVE_LOGO": "true",
                "MUCGPT_CORE_BACKEND__ENABLE_AUTH": "true",
                "MUCGPT_CORE_BACKEND__SSO_CONFIG__ROLE": "test-role",
            },
        ):
            settings = Settings()

            assert settings.frontend.labels.env_name == "TEST_ENV"
            assert settings.frontend.alternative_logo is True
            assert settings.backend.enable_auth is True
            assert settings.backend.sso_config.role == "test-role"

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
                "MUCGPT_CORE_BACKEND__MODELS": models_json,
            },
        ):
            settings = Settings()

            assert len(settings.backend.models) == 1
            model = settings.backend.models[0]
            assert model.type == "AZURE"
            assert model.llm_name == "test-model"
            assert str(model.endpoint) == "https://test.example.com/"
            assert model.api_key.get_secret_value() == "test-key"
            assert model.max_output_tokens == 1000
            assert model.max_input_tokens == 2000

    def teardown_method(self):
        """Clean up after each test."""
        # Clear the cache to ensure tests don't interfere with each other
        get_settings.cache_clear()
