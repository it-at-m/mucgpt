import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from config.settings import get_settings
from core import virtual_file_system_helper as vfs


@pytest.fixture
def store_resources(monkeypatch):
    monkeypatch.setattr(vfs.FileStoreManager, "_pool", None)
    monkeypatch.setattr(vfs.FileStoreManager, "_file_store", None)
    pool = MagicMock(open=AsyncMock(), close=AsyncMock())
    store = MagicMock()
    monkeypatch.setattr(vfs, "AsyncConnectionPool", MagicMock(return_value=pool))
    monkeypatch.setattr(vfs, "AsyncPostgresStore", MagicMock(return_value=store))
    return pool, store


@pytest.mark.asyncio
@pytest.mark.parametrize("error_type", [RuntimeError, asyncio.CancelledError])
async def test_failed_initialization_cleans_up_and_can_retry(
    store_resources, error_type
):
    pool, store = store_resources
    pool.open.side_effect = error_type("startup interrupted")

    with pytest.raises(error_type):
        await vfs.FileStoreManager.init(get_settings())

    pool.close.assert_awaited_once()
    with pytest.raises(RuntimeError, match="not initialized"):
        vfs.FileStoreManager.get_store()

    pool.open.side_effect = None
    await vfs.FileStoreManager.init(get_settings())
    assert vfs.FileStoreManager.get_store() is store
    vfs.AsyncPostgresStore.assert_called_with(conn=pool)

    # Repeated startup must not replace an already published store/pool.
    calls = vfs.AsyncConnectionPool.call_count
    await vfs.FileStoreManager.init(get_settings())
    assert vfs.AsyncConnectionPool.call_count == calls

    await vfs.FileStoreManager.close()
    with pytest.raises(RuntimeError, match="not initialized"):
        vfs.FileStoreManager.get_store()
    await vfs.FileStoreManager.close()
    assert pool.close.await_count == 2


@pytest.mark.asyncio
async def test_close_failure_clears_store_readiness(store_resources):
    pool, _ = store_resources
    await vfs.FileStoreManager.init(get_settings())
    pool.close.side_effect = RuntimeError("close failed")

    with pytest.raises(RuntimeError, match="close failed"):
        await vfs.FileStoreManager.close()

    with pytest.raises(RuntimeError, match="not initialized"):
        vfs.FileStoreManager.get_store()
    assert vfs.FileStoreManager._pool is None
