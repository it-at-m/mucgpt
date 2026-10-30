import os
from unittest.mock import patch

from config.settings import get_redis_settings, get_settings


class TestRedisSettings:
    """Test cases for Redis configuration (nested under Settings)."""

    def test_redis_settings_via_nested_env(self):
        """Test that Redis settings can be configured via nested env vars."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_ASSISTANT_REDIS__HOST": "env-redis-assistant",
                "MUCGPT_ASSISTANT_REDIS__PORT": "1111",
                "MUCGPT_ASSISTANT_REDIS__USERNAME": "env-user",
                "MUCGPT_ASSISTANT_REDIS__PASSWORD": "env-pass",
                "MUCGPT_ASSISTANT_DB__HOST": "localhost",
                "MUCGPT_ASSISTANT_DB__NAME": "test",
                "MUCGPT_ASSISTANT_DB__USER": "test",
                "MUCGPT_ASSISTANT_DB__PASSWORD": "test",
            },
        ):
            get_settings.cache_clear()
            get_redis_settings.cache_clear()
            redis = get_redis_settings()
            assert redis.host == "env-redis-assistant"
            assert redis.port == 1111
            assert redis.username == "env-user"
            assert redis.password.get_secret_value() == "env-pass"

    def test_redis_settings_defaults(self):
        """Test Redis default values."""
        with patch.dict(
            os.environ,
            {
                "MUCGPT_ASSISTANT_DB__HOST": "localhost",
                "MUCGPT_ASSISTANT_DB__NAME": "test",
                "MUCGPT_ASSISTANT_DB__USER": "test",
                "MUCGPT_ASSISTANT_DB__PASSWORD": "test",
            },
            clear=True,
        ):
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


class TestSettings:
    def test_sso_role_defaults_are_unset(self):
        with patch.dict(
            os.environ,
            {
                "MUCGPT_ASSISTANT_DB__HOST": "localhost",
                "MUCGPT_ASSISTANT_DB__NAME": "test",
                "MUCGPT_ASSISTANT_DB__USER": "test",
                "MUCGPT_ASSISTANT_DB__PASSWORD": "test",
            },
            clear=True,
        ):
            get_settings.cache_clear()
            settings = get_settings()
            assert settings.sso.role is None
            assert settings.sso.admin_role is None

    def teardown_method(self):
        get_settings.cache_clear()
        get_redis_settings.cache_clear()
