import os
from unittest.mock import patch

from src.config.settings import get_redis_settings, get_settings


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
            assert redis.HOST == "env-redis-assistant"
            assert redis.PORT == 1111
            assert redis.USERNAME == "env-user"
            assert redis.PASSWORD.get_secret_value() == "env-pass"

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
            assert redis.HOST is None
            assert redis.PORT == 6379
            assert redis.USERNAME is None
            assert redis.PASSWORD is None

    def teardown_method(self):
        get_settings.cache_clear()
        get_redis_settings.cache_clear()
