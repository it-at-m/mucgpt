"""Runtime-path tests for database session handling.

test_session.py covers the URL/parsing logic; these tests exercise the real
bodies of get_engine_and_factory_direct, get_db_session and
validate_database_connection with a mocked async engine.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import exc

from config.settings import DBConfig, Settings
from database import session as db_session_module
from database.session import (
    get_db_session,
    get_engine_and_factory_direct,
    validate_database_connection,
)


@pytest.fixture(autouse=True)
def _reset_engine_cache():
    db_session_module._engine_cache = None
    db_session_module._factory_cache = None
    yield
    db_session_module._engine_cache = None
    db_session_module._factory_cache = None


def _make_settings(schema: str | None = None) -> Settings:
    return Settings(
        db=DBConfig(
            host="db-host",
            port=5432,
            name="assistants",
            user="admin",
            password="secret'#",
            schema=schema,
        )
    )


class TestGetEngineAndFactoryDirect:
    def test_builds_engine_from_direct_connection_parameters(self, monkeypatch):
        create_async_engine = MagicMock()
        monkeypatch.setattr(db_session_module, "create_async_engine", create_async_engine)

        engine, factory = get_engine_and_factory_direct(_make_settings())

        create_async_engine.assert_called_once()
        kwargs = create_async_engine.call_args.kwargs
        assert create_async_engine.call_args.args[0] == "postgresql+asyncpg://"
        assert kwargs["connect_args"] == {
            "host": "db-host",
            "port": 5432,
            "database": "assistants",
            "user": "admin",
            "password": "secret'#",
        }
        assert kwargs["pool_pre_ping"] is True
        assert engine is create_async_engine.return_value
        assert factory is not None

    def test_schema_sets_search_path(self, monkeypatch):
        create_async_engine = MagicMock()
        monkeypatch.setattr(db_session_module, "create_async_engine", create_async_engine)

        get_engine_and_factory_direct(_make_settings(schema="assistant_schema"))

        connect_args = create_async_engine.call_args.kwargs["connect_args"]
        assert connect_args["server_settings"] == {
            "search_path": "assistant_schema"
        }

    def test_caches_engine_and_factory(self, monkeypatch):
        create_async_engine = MagicMock()
        monkeypatch.setattr(db_session_module, "create_async_engine", create_async_engine)

        first = get_engine_and_factory_direct(_make_settings())
        second = get_engine_and_factory_direct(_make_settings())

        assert first == second
        assert create_async_engine.call_count == 1

    def test_creation_failure_is_reraised(self, monkeypatch):
        monkeypatch.setattr(
            db_session_module,
            "create_async_engine",
            MagicMock(side_effect=RuntimeError("no driver")),
        )

        with pytest.raises(RuntimeError, match="no driver"):
            get_engine_and_factory_direct(_make_settings())


class _FakeSessionCM:
    """Async context manager yielding the session mock, like async_sessionmaker."""

    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, *exc_info):
        return False


def _fake_session() -> tuple[MagicMock, MagicMock]:
    """A fake session plus the factory yielding it as async context manager."""
    session = MagicMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    factory = MagicMock(return_value=_FakeSessionCM(session))
    return factory, session


def _fake_query_result(row) -> MagicMock:
    result = MagicMock()
    result.fetchone = MagicMock(return_value=row)
    return result


async def _consume(agen):
    """Enter and exit the get_db_session async generator dependency."""
    session = await agen.__anext__()
    await agen.aclose()
    return session


class TestGetDbSession:
    @pytest.mark.asyncio
    async def test_yields_session_and_closes(self, monkeypatch):
        factory, session = _fake_session()
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        session = await _consume(get_db_session(_make_settings()))

        session.close.assert_awaited_once()
        session.rollback.assert_not_called()

    @pytest.mark.asyncio
    async def test_rolls_back_on_sqlalchemy_error_and_reraises(self, monkeypatch):
        factory, session = _fake_session()
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        agen = get_db_session(_make_settings())
        await agen.__anext__()
        with pytest.raises(exc.SQLAlchemyError):
            await agen.athrow(exc.SQLAlchemyError("constraint violated"))

        session.rollback.assert_awaited_once()
        session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_rolls_back_on_unexpected_error_and_reraises(self, monkeypatch):
        factory, session = _fake_session()
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        agen = get_db_session(_make_settings())
        await agen.__anext__()
        with pytest.raises(ValueError, match="boom"):
            await agen.athrow(ValueError("boom"))

        session.rollback.assert_awaited_once()
        session.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_session_creation_failure_is_reraised(self, monkeypatch):
        factory = MagicMock()
        factory.return_value.__aenter__ = AsyncMock(
            side_effect=exc.SQLAlchemyError("password authentication failed")
        )
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        agen = get_db_session(_make_settings())
        with pytest.raises(exc.SQLAlchemyError):
            await agen.__anext__()
        await agen.aclose()


class TestValidateDatabaseConnection:
    @pytest.mark.asyncio
    async def test_successful_select_returns_true(self, monkeypatch):
        session = MagicMock()
        session.execute = AsyncMock(return_value=_fake_query_result((1,)))
        session.close = AsyncMock()
        factory = MagicMock(return_value=_FakeSessionCM(session))
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        assert await validate_database_connection(_make_settings()) is True

    @pytest.mark.asyncio
    async def test_unexpected_select_result_returns_false(self, monkeypatch):
        session = MagicMock()
        session.execute = AsyncMock(return_value=_fake_query_result((0,)))
        session.close = AsyncMock()
        factory = MagicMock(return_value=_FakeSessionCM(session))
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        assert await validate_database_connection(_make_settings()) is False

    @pytest.mark.asyncio
    async def test_sqlalchemy_error_returns_false(self, monkeypatch):
        factory = MagicMock()
        factory.return_value.__aenter__ = AsyncMock(
            side_effect=exc.SQLAlchemyError("password authentication failed")
        )
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(return_value=(MagicMock(), factory)),
        )

        assert await validate_database_connection(_make_settings()) is False

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_false(self, monkeypatch):
        monkeypatch.setattr(
            db_session_module,
            "get_engine_and_factory_direct",
            MagicMock(side_effect=RuntimeError("boom")),
        )

        assert await validate_database_connection(_make_settings()) is False
