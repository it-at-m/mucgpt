import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# Add the migrations directory to the Python path to find our models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import models for migrations from our dedicated models package
from migrations.models.base import Base

# Import settings to get database configuration
from migrations.settings import get_db_url

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Get script_location from environment if not already set
if not config.get_main_option("script_location"):
    script_location = os.getenv("MUCGPT_ASSISTANT_ALEMBIC_CONFIG_PATH", "./migrations")
    print(f"Setting script_location to: {script_location}", file=sys.stderr)
    config.set_main_option("script_location", script_location)


def get_database_url():
    """Get database URL from settings."""
    return get_db_url()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_database_url()

    # Get timeout settings from environment variables
    db_timeout = int(os.getenv("MIGRATION_DB_TIMEOUT", "30"))

    # Configure asyncpg connection parameters
    connect_args = {
        "timeout": db_timeout,
        "command_timeout": db_timeout,
    }

    # Set the connect_args in the configuration (must be a dict, not string)
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
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
