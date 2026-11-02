from unittest.mock import AsyncMock, MagicMock

import pytest
from deepagents.backends.utils import create_file_data
from langgraph.store.memory import InMemoryStore

from core.document_backend import DocumentBackend

NAMESPACE = ("user_documents", "owner")
SELECTED_PATH = "/12345678-1234-4234-8234-123456789abc.txt"
OTHER_PATH = "/87654321-4321-4321-8321-cba987654321.txt"


@pytest.fixture
def store():
    store = InMemoryStore()
    store.put(NAMESPACE, SELECTED_PATH, create_file_data("first\nsecond\nthird"))
    store.put(NAMESPACE, OTHER_PATH, create_file_data("private text"))
    recording_store = MagicMock(wraps=store)
    recording_store.aget = AsyncMock(wraps=store.aget)
    return recording_store


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_selected_read_fetches_only_exact_key(store, asynchronous):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = (
        await backend.aread(SELECTED_PATH, offset=1, limit=1)
        if asynchronous
        else backend.read(SELECTED_PATH, offset=1, limit=1)
    )
    assert result.error is None
    assert result.file_data["content"] == "second\n"
    if asynchronous:
        store.aget.assert_awaited_once_with(NAMESPACE, SELECTED_PATH)
        store.get.assert_not_called()
    else:
        store.get.assert_called_once_with(NAMESPACE, SELECTED_PATH)
        store.aget.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize(
    "path",
    [OTHER_PATH, "/", "/documents" + SELECTED_PATH, "/../" + SELECTED_PATH[1:]],
)
async def test_unattached_reads_do_not_access_store(store, asynchronous, path):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = await backend.aread(path) if asynchronous else backend.read(path)
    assert result.error == "permission denied: document is not attached"
    store.get.assert_not_called()
    store.aget.assert_not_called()


def test_empty_selection_denies_reads_without_store_access(store):
    backend = DocumentBackend(store=store, namespace=lambda _: NAMESPACE)
    assert backend.read(SELECTED_PATH).error is not None
    store.get.assert_not_called()


def test_selection_is_copied_at_construction(store):
    paths = [SELECTED_PATH]
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=paths
    )
    paths.append(OTHER_PATH)
    assert backend.read(OTHER_PATH).error is not None
    store.get.assert_not_called()


@pytest.mark.parametrize("namespace", [NAMESPACE, ("user_documents", "other-user")])
def test_missing_or_foreign_body_preserves_not_found_error(store, namespace):
    if namespace == NAMESPACE:
        store.delete(NAMESPACE, SELECTED_PATH)
    backend = DocumentBackend(
        store=store, namespace=lambda _: namespace, allowed_paths=[SELECTED_PATH]
    )
    assert "not found" in backend.read(SELECTED_PATH).error
    store.get.assert_called_once_with(namespace, SELECTED_PATH)
