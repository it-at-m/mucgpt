from unittest.mock import AsyncMock, MagicMock

import pytest

from config.settings import get_settings
from core import persistance_helpers as persistence


@pytest.mark.asyncio
async def test_checkpoint_pool_checks_connections_before_checkout(monkeypatch):
    monkeypatch.setattr(persistence.PersistanceHelpers, "_pool", None)
    monkeypatch.setattr(persistence.PersistanceHelpers, "_checkpointer", None)
    monkeypatch.setattr(persistence.PersistanceHelpers, "_engine", None)
    monkeypatch.setattr(persistence.PersistanceHelpers, "_session_factory", None)

    pool = MagicMock(open=AsyncMock(), close=AsyncMock())
    engine = MagicMock(dispose=AsyncMock())
    session_factory = MagicMock()
    pool_constructor = MagicMock(return_value=pool)
    pool_constructor.__getitem__.return_value = pool_constructor
    monkeypatch.setattr(persistence, "AsyncConnectionPool", pool_constructor)
    monkeypatch.setattr(
        persistence,
        "create_engine_and_session_factory",
        MagicMock(return_value=(engine, session_factory)),
    )
    checkpointer = MagicMock()
    monkeypatch.setattr(
        persistence, "FencedPostgresSaver", MagicMock(return_value=checkpointer)
    )

    settings = get_settings()
    await persistence.PersistanceHelpers.init(settings)

    pool_constructor.assert_called_once_with(
        conninfo="",
        max_size=20,
        open=False,
        check=persistence.AsyncConnectionPool.check_connection,
        kwargs=persistence._create_connection_args(settings),
    )
    pool.open.assert_awaited_once()
    assert persistence.PersistanceHelpers.get_checkpointer() is checkpointer

    await persistence.PersistanceHelpers.close()
    pool.close.assert_awaited_once()
    engine.dispose.assert_awaited_once()
    assert persistence.PersistanceHelpers._pool is None
