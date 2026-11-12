import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

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
            assert redis.password is not None
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

    def test_redis_settings_loaded_from_lowercase_yaml(self, tmp_path, monkeypatch):
        """Test that a lowercase config.yaml populates the Redis settings."""
        (tmp_path / "config.yaml").write_text(
            "db:\n"
            "  host: localhost\n"
            "  name: test\n"
            "  user: test\n"
            "  password: test\n"
            "redis:\n"
            "  host: yaml-redis\n"
            "  port: 2222\n"
        )
        monkeypatch.chdir(tmp_path)
        with patch.dict(os.environ, {}, clear=True):
            get_settings.cache_clear()
            get_redis_settings.cache_clear()
            redis = get_redis_settings()
            assert redis.host == "yaml-redis"
            assert redis.port == 2222

    def test_yaml_config_beats_env_file(self, tmp_path, monkeypatch):
        """Test that config.yaml wins over .env for the same key."""
        (tmp_path / "config.yaml").write_text(
            "db:\n"
            "  host: localhost\n"
            "  name: test\n"
            "  user: test\n"
            "  password: test\n"
            "redis:\n"
            "  host: yaml-redis\n"
        )
        (tmp_path / ".env").write_text("MUCGPT_ASSISTANT_REDIS__HOST=dotenv-redis\n")
        monkeypatch.chdir(tmp_path)
        with patch.dict(os.environ, {}, clear=True):
            get_settings.cache_clear()
            get_redis_settings.cache_clear()
            redis = get_redis_settings()
            assert redis.host == "yaml-redis"

    def test_legacy_uppercase_sso_keys_fail_startup(self, tmp_path, monkeypatch):
        """Legacy uppercase SSO keys must abort startup, not be ignored."""

        (tmp_path / "config.yaml").write_text(
            "db:\n"
            "  host: localhost\n"
            "  name: test\n"
            "  user: test\n"
            "  password: test\n"
            "SSO:\n"
            "  ROLE: mucgpt-user\n"
        )
        monkeypatch.chdir(tmp_path)
        with patch.dict(os.environ, {}, clear=True):
            get_settings.cache_clear()
            with pytest.raises(ValidationError, match="'SSO' is no longer read"):
                get_settings()

    def test_legacy_uppercase_role_keys_fail_startup(self, tmp_path, monkeypatch):
        """Uppercase ROLE/ADMIN_ROLE under sso must abort startup, not be ignored."""

        (tmp_path / "config.yaml").write_text(
            "db:\n"
            "  host: localhost\n"
            "  name: test\n"
            "  user: test\n"
            "  password: test\n"
            "sso:\n"
            "  ROLE: mucgpt-user\n"
        )
        monkeypatch.chdir(tmp_path)
        with patch.dict(os.environ, {}, clear=True):
            get_settings.cache_clear()
            with pytest.raises(ValidationError, match="no longer read"):
                get_settings()

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
