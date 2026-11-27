from tests import container_runtime


class _PostgresContainer:
    def get_container_host_ip(self) -> str:
        return "127.0.0.1"

    def get_exposed_port(self, port: int) -> str:
        assert port == 5432
        return "54321"


def test_postgres_engine_url_encodes_credentials(monkeypatch) -> None:
    monkeypatch.setenv("MUCGPT_TEST_POSTGRES_USER", "admin user")
    monkeypatch.setenv("MUCGPT_TEST_POSTGRES_PASSWORD", "secret@value/with space")

    assert container_runtime.postgres_engine_url(_PostgresContainer()) == (
        "postgresql+asyncpg://admin+user:secret%40value%2Fwith+space@127.0.0.1:54321/postgres"
    )


def test_postgres_engine_url_preserves_default_credentials(monkeypatch) -> None:
    monkeypatch.delenv("MUCGPT_TEST_POSTGRES_USER", raising=False)
    monkeypatch.delenv("MUCGPT_TEST_POSTGRES_PASSWORD", raising=False)

    assert container_runtime.postgres_engine_url(_PostgresContainer()) == (
        "postgresql+asyncpg://admin:admin@127.0.0.1:54321/postgres"
    )
