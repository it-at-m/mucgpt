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
