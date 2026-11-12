"""Run assistant database migrations without loading application settings.

Environment variables:
    MIGRATION_REVISION: Target revision, default ``head``.
    MIGRATION_CHECK_ONLY: Connect and report the current revision without changes.
    MIGRATION_DB_TIMEOUT: Connection timeout in seconds, default 30.
    MIGRATION_DB_RETRIES: Number of transient connection attempts, default 1.
    MIGRATION_DB_RETRY_DELAY: Delay between attempts in seconds, default 5.
    MIGRATION_LOCK_TIMEOUT: Advisory lock wait timeout in seconds, default 30.
    MIGRATION_LOG_LEVEL: Python logging level, default INFO.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.exc import DBAPIError, OperationalError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

from migrations.logging_config import configure_logging
from migrations.settings import get_migration_settings

LOGGER = logging.getLogger("mucgpt.assistant.migrations")


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be at least 1")
    return value


def _nonnegative_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 0:
        raise ValueError(f"{name} must not be negative")
    return value


def _enabled(name: str) -> bool:
    return os.getenv(name, "").lower() in {"1", "true", "yes"}


def _configure_logging() -> None:
    level = getattr(logging, os.getenv("MIGRATION_LOG_LEVEL", "INFO").upper(), None)
    if not isinstance(level, int):
        raise ValueError("MIGRATION_LOG_LEVEL must be a valid logging level")
    configure_logging()
    LOGGER.setLevel(level)


def _alembic_config(db_timeout: int, lock_timeout: int) -> Config:
    root = Path(__file__).resolve().parent.parent
    config = Config(str(root / "alembic.ini"))
    config.set_main_option(
        "sqlalchemy.url",
        get_migration_settings().database_url().render_as_string(hide_password=False),
    )
    config.set_main_option("mucgpt.migration_db_timeout", str(db_timeout))
    config.set_main_option("mucgpt.migration_lock_timeout", str(lock_timeout))
    return config


def _is_transient_connection_error(error: BaseException) -> bool:
    if isinstance(error, ConnectionError | TimeoutError | OSError | OperationalError):
        return True
    if isinstance(error, DBAPIError):
        return bool(getattr(error, "connection_invalidated", False))
    return False


def run() -> None:
    _configure_logging()
    revision = os.getenv("MIGRATION_REVISION", "head")
    db_timeout = _positive_int("MIGRATION_DB_TIMEOUT", 30)
    retries = _positive_int("MIGRATION_DB_RETRIES", 1)
    retry_delay = _nonnegative_int("MIGRATION_DB_RETRY_DELAY", 5)
    lock_timeout = _positive_int("MIGRATION_LOCK_TIMEOUT", 30)
    database = get_migration_settings().db
    LOGGER.info(
        "Migration target=%s database=%s host=%s port=%s attempts=%s",
        revision,
        database.name,
        database.host,
        database.port,
        retries,
    )

    config = _alembic_config(db_timeout, lock_timeout)
    if _enabled("MIGRATION_CHECK_ONLY"):
        command.current(config, verbose=True)
        LOGGER.info("Migration preflight completed")
        return

    for attempt in range(1, retries + 1):
        try:
            command.upgrade(config, revision)
            LOGGER.info("Migration completed target=%s", revision)
            return
        except Exception as error:
            if not _is_transient_connection_error(error) or attempt == retries:
                LOGGER.exception("Migration failed on attempt %s/%s", attempt, retries)
                raise
            LOGGER.warning(
                "Transient database failure on attempt %s/%s; retrying in %ss: %s",
                attempt,
                retries,
                retry_delay,
                error.__class__.__name__,
            )
            time.sleep(retry_delay)


if __name__ == "__main__":
    try:
        run()
    except Exception:
        sys.exit(1)
