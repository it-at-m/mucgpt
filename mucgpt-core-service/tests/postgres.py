"""Reusable helpers for isolated PostgreSQL integration databases.

The lifecycle tests use one disposable PostgreSQL server per test process and
one UUID-named database per test.  The configured server must therefore be a
dedicated test instance whose credentials may create and force-drop databases.
Never point ``MUCGPT_LIFECYCLE_POSTGRES_*`` at a shared or production server.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import psycopg
from alembic import command
from alembic.config import Config
from migrations.settings import get_migration_settings
from psycopg import sql
from psycopg.conninfo import make_conninfo

from config.settings import DBConfig, Settings


@dataclass(frozen=True)
class PostgresServerConfig:
    """Connection details for the disposable PostgreSQL test server."""

    host: str
    port: int
    user: str
    password: str

    @classmethod
    def from_environment(cls) -> PostgresServerConfig:
        """Read the lifecycle PostgreSQL server settings from the environment."""
        host = os.getenv("MUCGPT_LIFECYCLE_POSTGRES_HOST")
        if not host:
            raise RuntimeError(
                "MUCGPT_LIFECYCLE_POSTGRES_HOST is required for PostgreSQL tests"
            )
        return cls(
            host=host,
            port=int(os.getenv("MUCGPT_LIFECYCLE_POSTGRES_PORT", "5432")),
            user=os.getenv("MUCGPT_LIFECYCLE_POSTGRES_USER", "admin"),
            password=os.getenv("MUCGPT_LIFECYCLE_POSTGRES_PASSWORD", "admin"),
        )

    def connection_args(self) -> dict[str, str]:
        """Return psycopg connection arguments, excluding the database name."""
        return {
            "host": self.host,
            "port": str(self.port),
            "user": self.user,
            "password": self.password,
        }


@dataclass(frozen=True)
class IsolatedPostgresDatabase:
    """The generated database and configurations used by an integration test."""

    server: PostgresServerConfig
    name: str
    db_config: DBConfig
    settings: Settings

    @property
    def connection_args(self) -> dict[str, str]:
        """Return server connection arguments suitable for psycopg and pools."""
        return self.server.connection_args()


async def _create_database(server: PostgresServerConfig, database: str) -> None:
    async with await psycopg.AsyncConnection.connect(
        make_conninfo(**server.connection_args(), dbname="postgres"),
        autocommit=True,
    ) as connection:
        await connection.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database))
        )


async def _drop_database(server: PostgresServerConfig, database: str) -> None:
    async with await psycopg.AsyncConnection.connect(
        make_conninfo(**server.connection_args(), dbname="postgres"),
        autocommit=True,
    ) as connection:
        await connection.execute(
            sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database))
        )


async def _wait_for_task(task: asyncio.Task[object]) -> None:
    """Wait for a shielded task even if cancellation is requested again."""
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            continue
        except BaseException:
            return


async def migrate_database(server: PostgresServerConfig, database: str) -> None:
    """Apply the production Alembic migrations to an isolated database."""
    migration_env = {
        "MUCGPT_CORE_DB__HOST": server.host,
        "MUCGPT_CORE_DB__PORT": str(server.port),
        "MUCGPT_CORE_DB__NAME": database,
        "MUCGPT_CORE_DB__USER": server.user,
        "MUCGPT_CORE_DB__PASSWORD": server.password,
    }
    try:
        with patch.dict(os.environ, migration_env):
            get_migration_settings.cache_clear()
            migration = asyncio.create_task(
                asyncio.to_thread(
                    command.upgrade,
                    Config(str(Path(__file__).parents[1] / "alembic.ini")),
                    "head",
                )
            )
            try:
                await asyncio.shield(migration)
            except asyncio.CancelledError:
                await _wait_for_task(migration)
                migration.exception()
                raise
    finally:
        get_migration_settings.cache_clear()


@asynccontextmanager
async def isolated_postgres_database(
    *, prefix: str = "lifecycle_test_", migrate: bool = True
) -> AsyncGenerator[IsolatedPostgresDatabase]:
    """Create, optionally migrate, and always remove a test database.

    Cleanup is shielded from cancellation so a cancelled test cannot leave a
    database behind on the disposable PostgreSQL server.
    """
    server = PostgresServerConfig.from_environment()
    database = prefix + uuid4().hex
    creation = asyncio.create_task(_create_database(server, database))
    try:
        await asyncio.shield(creation)
    except asyncio.CancelledError:
        await _wait_for_task(creation)
        if not creation.cancelled() and creation.exception() is None:
            cleanup = asyncio.create_task(_drop_database(server, database))
            await _wait_for_task(cleanup)
            cleanup.result()
        raise
    try:
        if migrate:
            await migrate_database(server, database)
        db_config = DBConfig(
            host=server.host,
            port=server.port,
            name=database,
            user=server.user,
            password=server.password,
        )
        yield IsolatedPostgresDatabase(
            server=server,
            name=database,
            db_config=db_config,
            settings=Settings(db=db_config),
        )
    finally:
        cleanup = asyncio.create_task(_drop_database(server, database))
        try:
            await asyncio.shield(cleanup)
        except asyncio.CancelledError:
            # The shield keeps the drop task alive; wait for it before
            # propagating cancellation to the test.
            await _wait_for_task(cleanup)
            cleanup.result()
            raise
        finally:
            get_migration_settings.cache_clear()
