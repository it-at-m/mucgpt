from unittest.mock import Mock, patch

import pytest
from alembic import command
from migrations import run_migrations
from migrations.settings import MigrationSettings, get_migration_settings


@pytest.fixture(autouse=True)
def clear_migration_settings_cache():
    get_migration_settings.cache_clear()
    yield
    get_migration_settings.cache_clear()


def test_migration_settings_require_only_database_configuration(monkeypatch) -> None:
    monkeypatch.setenv("MUCGPT_CORE_DB__HOST", "postgres")
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "mucgpt")
    monkeypatch.setenv("MUCGPT_CORE_DB__USER", "migrator")
    monkeypatch.setenv("MUCGPT_CORE_DB__PASSWORD", "secret")
    monkeypatch.setenv("MUCGPT_CORE_PROVIDERS", "not valid application configuration")

    settings = MigrationSettings()

    assert settings.database_url().render_as_string(hide_password=True) == (
        "postgresql+asyncpg://migrator:***@postgres:5432/mucgpt"
    )


def test_migration_settings_reject_incomplete_database_configuration() -> None:
    with pytest.raises(ValueError, match="db.host"):
        MigrationSettings(db={}).database_url()


def test_lock_timeout_allows_an_indefinite_wait(monkeypatch) -> None:
    monkeypatch.setenv("MIGRATION_LOCK_TIMEOUT", "0")

    assert run_migrations._nonnegative_int("MIGRATION_LOCK_TIMEOUT", 30) == 0


def test_alembic_config_escapes_special_characters_in_database_url(monkeypatch) -> None:
    monkeypatch.setenv("MUCGPT_CORE_DB__HOST", "postgres")
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "mucgpt")
    monkeypatch.setenv("MUCGPT_CORE_DB__USER", "migrator")
    monkeypatch.setenv("MUCGPT_CORE_DB__PASSWORD", "p@ss/w%rd")

    config = run_migrations._alembic_config(db_timeout=30, lock_timeout=30)

    assert config.get_main_option("sqlalchemy.url") == (
        "postgresql+asyncpg://migrator:p%40ss%2Fw%25rd@postgres:5432/mucgpt"
    )


def test_runner_retries_transient_connection_failures(monkeypatch) -> None:
    monkeypatch.setenv("MIGRATION_DB_RETRIES", "2")
    monkeypatch.setenv("MIGRATION_DB_RETRY_DELAY", "1")
    monkeypatch.setenv("MUCGPT_CORE_DB__HOST", "postgres")
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "mucgpt")
    monkeypatch.setenv("MUCGPT_CORE_DB__USER", "migrator")
    monkeypatch.setenv("MUCGPT_CORE_DB__PASSWORD", "secret")
    get_migration_settings.cache_clear()

    upgrade = Mock(side_effect=[OSError("not ready"), None])
    with (
        patch.object(command, "upgrade", upgrade),
        patch.object(run_migrations.time, "sleep") as sleep,
    ):
        run_migrations.run()

    assert upgrade.call_count == 2
    sleep.assert_called_once_with(1)


def test_runner_does_not_retry_non_transient_failures(monkeypatch) -> None:
    monkeypatch.setenv("MIGRATION_DB_RETRIES", "3")
    monkeypatch.setenv("MUCGPT_CORE_DB__HOST", "postgres")
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "mucgpt")
    monkeypatch.setenv("MUCGPT_CORE_DB__USER", "migrator")
    monkeypatch.setenv("MUCGPT_CORE_DB__PASSWORD", "secret")
    get_migration_settings.cache_clear()

    upgrade = Mock(side_effect=RuntimeError("bad revision"))
    with patch.object(command, "upgrade", upgrade), pytest.raises(RuntimeError):
        run_migrations.run()

    upgrade.assert_called_once()


def test_runner_check_only_does_not_apply_migrations(monkeypatch) -> None:
    monkeypatch.setenv("MIGRATION_CHECK_ONLY", "true")
    monkeypatch.setenv("MUCGPT_CORE_DB__HOST", "postgres")
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "mucgpt")
    monkeypatch.setenv("MUCGPT_CORE_DB__USER", "migrator")
    monkeypatch.setenv("MUCGPT_CORE_DB__PASSWORD", "secret")
    get_migration_settings.cache_clear()

    with (
        patch.object(command, "current") as current,
        patch.object(command, "upgrade") as upgrade,
    ):
        run_migrations.run()

    current.assert_called_once()
    upgrade.assert_not_called()
