import asyncio
import logging
import os
import sys
from typing import Any

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "app"))

from database.database_models import Base  # noqa: E402
from migrations.logging_config import configure_logging  # noqa: E402
from migrations.settings import get_migration_settings  # noqa: E402

config = context.config
configure_logging()
logger = logging.getLogger("mucgpt.assistant.migrations")

target_metadata = Base.metadata


def get_database_url() -> str:
    return get_migration_settings().database_url().render_as_string(hide_password=False)


def run_migrations_offline() -> None:
    schema = get_migration_settings().db.schema_name
    context.configure(
        url=get_database_url(),
        target_metadata=target_metadata,
        version_table_schema=schema,
        include_schemas=schema is not None,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    schema = get_migration_settings().db.schema_name
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=schema,
        include_schemas=schema is not None,
    )
    lock_timeout = config.get_main_option("mucgpt.migration_lock_timeout", "30")
    connection.execute(
        text("SELECT set_config('lock_timeout', :timeout, false)"),
        {"timeout": f"{lock_timeout}s"},
    )
    connection.execute(
        text("SELECT pg_advisory_lock(hashtext('mucgpt-assistant-migrations'))")
    )
    try:
        with context.begin_transaction():
            context.run_migrations()
    finally:
        try:
            connection.execute(
                text(
                    "SELECT pg_advisory_unlock(hashtext('mucgpt-assistant-migrations'))"
                )
            )
        except Exception:
            # A dead connection has already released its session-level lock.
            # Preserve the migration failure so the retry runner can classify it.
            logger.exception("Failed to release the assistant migration advisory lock")


async def run_async_migrations() -> None:
    configuration: dict[str, Any] = dict(
        config.get_section(config.config_ini_section, {})
    )
    schema = get_migration_settings().db.schema_name
    configuration["sqlalchemy.url"] = get_database_url()
    db_timeout = int(config.get_main_option("mucgpt.migration_db_timeout", "30"))
    connect_args: dict[str, Any] = {
        "timeout": db_timeout,
        "command_timeout": db_timeout,
    }
    if schema:
        connect_args["server_settings"] = {
            "search_path": f'"{schema.replace(chr(34), chr(34) * 2)}"',
        }
    configuration["sqlalchemy.connect_args"] = connect_args
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
