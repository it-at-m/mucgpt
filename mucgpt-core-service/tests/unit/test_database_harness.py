import asyncio
import os
import threading

import pytest
from tests import postgres


def test_postgres_server_config_reads_lifecycle_environment(monkeypatch) -> None:
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_HOST", "postgres.test")
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_PORT", "55432")
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_USER", "tester")
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_PASSWORD", "secret")

    config = postgres.PostgresServerConfig.from_environment()

    assert config == postgres.PostgresServerConfig(
        host="postgres.test", port=55432, user="tester", password="secret"
    )
    assert config.connection_args() == {
        "host": "postgres.test",
        "port": "55432",
        "user": "tester",
        "password": "secret",
    }


@pytest.mark.asyncio
async def test_isolated_database_drops_database_when_migration_fails(
    monkeypatch,
) -> None:
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_HOST", "postgres.test")
    dropped: list[str] = []

    async def create_database(_server, _database) -> None:
        return

    async def migrate_database(_server, _database) -> None:
        raise RuntimeError("migration failed")

    async def drop_database(_server, database) -> None:
        dropped.append(database)

    monkeypatch.setattr(postgres, "_create_database", create_database)
    monkeypatch.setattr(postgres, "migrate_database", migrate_database)
    monkeypatch.setattr(postgres, "_drop_database", drop_database)

    with pytest.raises(RuntimeError, match="migration failed"):
        async with postgres.isolated_postgres_database():
            pytest.fail("migration failure should prevent yielding a database")

    assert len(dropped) == 1
    assert dropped[0].startswith("lifecycle_test_")


@pytest.mark.asyncio
async def test_isolated_database_drops_database_when_creation_is_cancelled(
    monkeypatch,
) -> None:
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_HOST", "postgres.test")
    creation_started = asyncio.Event()
    finish_creation = asyncio.Event()
    dropped: list[str] = []

    async def create_database(_server, _database) -> None:
        creation_started.set()
        await finish_creation.wait()

    async def drop_database(_server, database) -> None:
        dropped.append(database)

    monkeypatch.setattr(postgres, "_create_database", create_database)
    monkeypatch.setattr(postgres, "_drop_database", drop_database)

    async def enter_database() -> None:
        async with postgres.isolated_postgres_database(migrate=False):
            pytest.fail("cancelled setup should not yield a database")

    task = asyncio.create_task(enter_database())
    await creation_started.wait()
    task.cancel()
    finish_creation.set()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert len(dropped) == 1


@pytest.mark.asyncio
async def test_isolated_database_completes_cleanup_after_repeated_cancellation(
    monkeypatch,
) -> None:
    monkeypatch.setenv("MUCGPT_LIFECYCLE_POSTGRES_HOST", "postgres.test")
    cleanup_started = asyncio.Event()
    finish_cleanup = asyncio.Event()
    dropped: list[str] = []

    async def create_database(_server, _database) -> None:
        return

    async def drop_database(_server, database) -> None:
        cleanup_started.set()
        await finish_cleanup.wait()
        dropped.append(database)

    monkeypatch.setattr(postgres, "_create_database", create_database)
    monkeypatch.setattr(postgres, "_drop_database", drop_database)

    async def use_database() -> None:
        async with postgres.isolated_postgres_database(migrate=False):
            return

    task = asyncio.create_task(use_database())
    await cleanup_started.wait()
    task.cancel()
    task.cancel()
    finish_cleanup.set()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert len(dropped) == 1


@pytest.mark.asyncio
async def test_migration_waits_for_worker_before_restoring_environment(
    monkeypatch,
) -> None:
    started = threading.Event()
    finish = threading.Event()
    worker_environment: dict[str, str | None] = {}
    monkeypatch.setenv("MUCGPT_CORE_DB__NAME", "outside")

    def upgrade(_config, _revision) -> None:
        worker_environment["database"] = os.getenv("MUCGPT_CORE_DB__NAME")
        started.set()
        finish.wait()

    monkeypatch.setattr(postgres.command, "upgrade", upgrade)

    task = asyncio.create_task(
        postgres.migrate_database(
            postgres.PostgresServerConfig(
                host="postgres.test", port=5432, user="tester", password="secret"
            ),
            "isolated_database",
        )
    )
    await asyncio.to_thread(started.wait)
    task.cancel()
    finish.set()

    with pytest.raises(asyncio.CancelledError):
        await task

    assert worker_environment == {"database": "isolated_database"}
    assert os.environ["MUCGPT_CORE_DB__NAME"] == "outside"
