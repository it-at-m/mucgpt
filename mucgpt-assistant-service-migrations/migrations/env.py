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

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_database_url():
    """Get database URL from environment variables."""
    # First try to get from DATABASE_URL environment variable
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    # If not available, build from individual environment variables
    db_user = os.getenv("MUCGPT_ASSISTANT_DB_USER")
    db_password = os.getenv("MUCGPT_ASSISTANT_DB_PASSWORD")
    db_host = os.getenv("MUCGPT_ASSISTANT_DB_HOST")
    db_port = os.getenv("MUCGPT_ASSISTANT_DB_PORT", "5432")
    db_name = os.getenv("MUCGPT_ASSISTANT_DB_NAME")

    if not all([db_user, db_password, db_host, db_name]):
        print("Error: Database environment variables not set", file=sys.stderr)
        sys.exit(1)

    return f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


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


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
