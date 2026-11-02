from unittest.mock import AsyncMock, MagicMock, call

import pytest
from deepagents.backends import CompositeBackend, StateBackend
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
    recording_store.search.side_effect = AssertionError("namespace search forbidden")
    recording_store.asearch = AsyncMock(
        side_effect=AssertionError("namespace search forbidden")
    )
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
@pytest.mark.parametrize("line_count", [99, 100, 101, 205])
async def test_default_read_returns_full_document_or_first_page(
    store, asynchronous, line_count
):
    lines = [f"line {number}\n" for number in range(line_count)]
    store.put(NAMESPACE, SELECTED_PATH, create_file_data("".join(lines)))
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = (
        await backend.aread(SELECTED_PATH)
        if asynchronous
        else backend.read(SELECTED_PATH)
    )
    assert result.error is None
    assert result.file_data["content"] == "".join(lines[:100])
    assert result.total_lines == line_count
    assert result.start_line == 1
    assert result.end_line == min(line_count, 100)
    assert result.next_offset == (100 if line_count > 100 else None)
    if asynchronous:
        store.aget.assert_awaited_once_with(NAMESPACE, SELECTED_PATH)
        store.get.assert_not_called()
    else:
        store.get.assert_called_once_with(NAMESPACE, SELECTED_PATH)
        store.aget.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_default_pages_can_resume_without_skipping_document_lines(
    store, asynchronous
):
    text = "".join(f"line {number}\n" for number in range(205))
    store.put(NAMESPACE, SELECTED_PATH, create_file_data(text))
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    method = backend.aread if asynchronous else backend.read
    pages = []
    offset = 0
    for expected_end in [100, 200, 205]:
        result = (
            await method(SELECTED_PATH, offset=offset)
            if asynchronous
            else method(SELECTED_PATH, offset=offset)
        )
        assert result.error is None
        assert result.start_line == offset + 1
        assert result.end_line == expected_end
        assert result.total_lines == 205
        assert result.next_offset == (expected_end if expected_end < 205 else None)
        pages.append(result.file_data["content"])
        offset = result.next_offset
    assert "".join(pages) == text


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize(
    ("offset", "limit", "start", "end"),
    [(0, 205, 0, 205), (99, 102, 99, 201), (-1, 1, 0, 1), (10, 0, 10, 10)],
)
async def test_explicit_read_bounds_are_preserved(
    store, asynchronous, offset, limit, start, end
):
    lines = [f"line {number}\n" for number in range(205)]
    store.put(NAMESPACE, SELECTED_PATH, create_file_data("".join(lines)))
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = (
        await backend.aread(SELECTED_PATH, offset=offset, limit=limit)
        if asynchronous
        else backend.read(SELECTED_PATH, offset=offset, limit=limit)
    )
    assert result.error is None
    assert result.file_data["content"] == "".join(lines[start:end])
    if limit == 0:
        assert result.no_lines_requested is True
        assert result.start_line is None and result.end_line is None
        assert result.next_offset is None
    else:
        assert result.start_line == start + 1
        assert result.end_line == end
        assert result.total_lines == 205
        assert result.next_offset == (end if end < 205 else None)


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


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize(
    ("path", "glob", "expected_paths"),
    [
        (SELECTED_PATH, None, [SELECTED_PATH]),
        ("/", None, [SELECTED_PATH, OTHER_PATH]),
        (None, "123*.txt", [SELECTED_PATH]),
        ("/", "*.pdf", []),
    ],
)
async def test_grep_fetches_only_selected_candidates(
    store, asynchronous, path, glob, expected_paths
):
    backend = DocumentBackend(
        store=store,
        namespace=lambda _: NAMESPACE,
        allowed_paths=[OTHER_PATH, SELECTED_PATH],
    )
    result = (
        await backend.agrep("text", path, glob)
        if asynchronous
        else backend.grep("text", path, glob)
    )
    assert result.error is None
    assert [match["path"] for match in result.matches] == (
        [OTHER_PATH] if OTHER_PATH in expected_paths else []
    )
    expected_calls = [call(NAMESPACE, key) for key in expected_paths]
    if asynchronous:
        assert store.aget.await_args_list == expected_calls
        store.get.assert_not_called()
    else:
        assert store.get.call_args_list == expected_calls
        store.aget.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_root_grep_excludes_unattached_bodies(store, asynchronous):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = await backend.agrep("private") if asynchronous else backend.grep("private")
    assert result.error is None and result.matches == []
    retrieval = store.aget if asynchronous else store.get
    assert retrieval.call_args_list == [call(NAMESPACE, SELECTED_PATH)]


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("path", [OTHER_PATH, "/../" + SELECTED_PATH[1:]])
async def test_invalid_grep_path_does_not_fetch_bodies(store, asynchronous, path):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = (
        await backend.agrep("text", path)
        if asynchronous
        else backend.grep("text", path)
    )
    assert result.error is not None
    store.get.assert_not_called()
    store.aget.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_empty_grep_selection_does_not_fetch_bodies(store, asynchronous):
    backend = DocumentBackend(store=store, namespace=lambda _: NAMESPACE)
    result = await backend.agrep("text") if asynchronous else backend.grep("text")
    assert result.error is None and result.matches == []
    store.get.assert_not_called()
    store.aget.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("max_count", [1, 2])
async def test_grep_searches_complete_text_and_preserves_limits(
    store, asynchronous, max_count
):
    store.put(
        NAMESPACE,
        SELECTED_PATH,
        create_file_data("plain\n" * 2000 + "needle.*\nneedle.*"),
    )
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = (
        await backend.agrep("needle.*", max_count=max_count)
        if asynchronous
        else backend.grep("needle.*", max_count=max_count)
    )
    assert result.error is None
    assert [match["line"] for match in result.matches] == list(
        range(2001, 2001 + max_count)
    )
    assert all(match["text"] == "needle.*" for match in result.matches)
    assert result.truncated is (max_count == 1)


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("body", [None, {"content": 123}])
async def test_grep_propagates_missing_or_invalid_body(store, asynchronous, body):
    if body is None:
        store.delete(NAMESPACE, SELECTED_PATH)
    else:
        store.put(NAMESPACE, SELECTED_PATH, body)
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    result = await backend.agrep("text") if asynchronous else backend.grep("text")
    assert result.error is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("operation", ["ls", "glob"])
@pytest.mark.parametrize("path", ["/", SELECTED_PATH])
async def test_document_discovery_is_denied_without_store_access(
    store, asynchronous, operation, path
):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    method = getattr(backend, ("a" if asynchronous else "") + operation)
    kwargs = {"path": path}
    if operation == "glob":
        kwargs["pattern"] = "*.txt"
    result = await method(**kwargs) if asynchronous else method(**kwargs)
    assert result.error is not None and "disabled" in result.error
    assert store.mock_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("operation", ["ls", "glob"])
async def test_discovery_denial_is_scoped_to_document_mount(
    store, monkeypatch, asynchronous, operation
):
    scratch = StateBackend()
    monkeypatch.setattr(
        scratch,
        "_read_files",
        lambda: {"/scratch/note.txt": create_file_data("scratch")},
    )
    backend = CompositeBackend(
        default=scratch,
        routes={
            "/documents/": DocumentBackend(
                store=store,
                namespace=lambda _: NAMESPACE,
                allowed_paths=[SELECTED_PATH],
            )
        },
    )
    method = getattr(backend, ("a" if asynchronous else "") + operation)
    for path in ["/documents/", "/scratch/"]:
        kwargs = {"path": path}
        if operation == "glob":
            kwargs["pattern"] = "*.txt"
        result = await method(**kwargs) if asynchronous else method(**kwargs)
        if path == "/documents/":
            assert result.error is not None
        else:
            assert result.error is None
            entries = result.entries if operation == "ls" else result.matches
            assert [entry["path"] for entry in entries] == ["/scratch/note.txt"]
    assert store.mock_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("mounted", [False, True])
@pytest.mark.parametrize("empty", [False, True])
async def test_document_downloads_are_denied_without_store_access(
    store, asynchronous, mounted, empty
):
    backend = DocumentBackend(
        store=store, namespace=lambda _: NAMESPACE, allowed_paths=[SELECTED_PATH]
    )
    paths = [] if empty else [SELECTED_PATH, OTHER_PATH, SELECTED_PATH]
    if mounted:
        backend = CompositeBackend(
            default=StateBackend(), routes={"/documents/": backend}
        )
        paths = ["/documents" + path for path in paths]
    responses = (
        await backend.adownload_files(paths)
        if asynchronous
        else backend.download_files(paths)
    )
    assert [response.path for response in responses] == paths
    assert all(response.error == "permission_denied" for response in responses)
    assert all(response.content is None for response in responses)
    assert store.mock_calls == []
