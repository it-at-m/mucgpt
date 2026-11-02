from uuid import UUID

import pytest
from deepagents.backends.utils import create_file_data
from deepagents.middleware.filesystem import FilesystemMiddleware
from langchain.agents import create_agent
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.store.memory import InMemoryStore

from core import virtual_file_system_helper as vfs

SELECTED_ID = "12345678-1234-4234-8234-123456789abc"
OTHER_ID = "87654321-4321-4321-8321-cba987654321"
SELECTED_PATH = vfs.get_document_path(SELECTED_ID)
OTHER_PATH = vfs.get_document_path(OTHER_ID)


class FilesystemTestModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


@pytest.fixture
def document_store(monkeypatch):
    store = InMemoryStore()
    monkeypatch.setattr(vfs.FileStoreManager, "_file_store", store)
    for document_id, text in [
        (SELECTED_ID, "needle selected text"),
        (OTHER_ID, "needle private text"),
    ]:
        result = vfs.create_document_backend("owner").write(
            vfs.get_document_storage_key(document_id), text
        )
        assert result.error is None
    return store


async def run_tools(user_id, selected_ids, calls, *, asynchronous, files=None):
    """Exercise real middleware tool dispatch and graph-state writes, without an LLM."""
    model = FilesystemTestModel(
        responses=[
            AIMessage(
                content="",
                tool_calls=[
                    {"name": name, "args": args, "id": str(index), "type": "tool_call"}
                    for index, (name, args) in enumerate(calls)
                ],
            ),
            AIMessage(content="done"),
        ]
    )
    agent = create_agent(
        model=model,
        middleware=[
            FilesystemMiddleware(
                backend=vfs.create_backend(user_id, selected_ids),
                _permissions=vfs.create_permissions(selected_ids),
            )
        ],
    )
    inputs = {"messages": [("user", "exercise filesystem")], "files": files or {}}
    result = await agent.ainvoke(inputs) if asynchronous else agent.invoke(inputs)
    messages = {
        message.tool_call_id: message
        for message in result["messages"]
        if isinstance(message, ToolMessage)
    }
    return result, [messages[str(index)] for index in range(len(calls))]


@pytest.mark.parametrize(
    "document_id",
    [SELECTED_ID.upper(), SELECTED_ID.replace("-", ""), UUID(SELECTED_ID)],
)
def test_document_ids_resolve_to_one_canonical_key(document_id):
    assert vfs.get_document_storage_key(document_id) == f"/{SELECTED_ID}.txt"
    assert vfs.get_document_path(document_id) == SELECTED_PATH


@pytest.mark.parametrize(
    "document_id", ["", "../secret", SELECTED_PATH, "*.txt", "not-a-uuid"]
)
def test_document_paths_reject_filenames_paths_and_patterns(document_id):
    with pytest.raises(ValueError):
        vfs.get_document_path(document_id)
    with pytest.raises(ValueError):
        vfs.create_permissions([document_id])


@pytest.mark.parametrize("user_id", ["", " ", None, 123])
def test_namespace_requires_authenticated_identity(user_id):
    with pytest.raises(ValueError, match="user ID"):
        vfs.get_document_namespace(user_id)


def test_namespace_encoding_is_safe_and_collision_free(document_store):
    unsafe_id = "münchen/user[*]"
    encoded_id = vfs.get_document_namespace(unsafe_id)[1]
    identities = ["owner", "Owner", "owner ", unsafe_id, encoded_id]
    namespaces = [vfs.get_document_namespace(identity) for identity in identities]
    assert len(set(namespaces)) == len(identities)
    assert namespaces[0] == ("user_documents", "owner")
    for index, identity in enumerate(identities):
        # Actual StoreBackend validation and reads, outside any graph runtime.
        backend = vfs.create_document_backend(identity)
        key = vfs.get_document_storage_key(OTHER_ID)
        assert backend.write(key, str(index)).error is None
        assert backend.read(key).file_data["content"] == str(index)


@pytest.mark.asyncio
async def test_direct_ingestion_and_mounted_reads_share_keys_and_isolate_users(
    document_store,
):
    key = vfs.get_document_storage_key(SELECTED_ID)
    assert document_store.get(vfs.get_document_namespace("owner"), key) is not None
    owner = vfs.create_backend("owner", [SELECTED_ID])
    assert (await owner.aread(SELECTED_PATH)).file_data[
        "content"
    ] == "needle selected text"
    assert (
        await vfs.create_backend("other-user").aread(SELECTED_PATH)
    ).error is not None
    # No accidentally stored public-path key or extra StoreBackend namespace.
    assert (
        document_store.get(vfs.get_document_namespace("owner"), SELECTED_PATH) is None
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_selected_reads_and_search_with_document_discovery_disabled(
    document_store, asynchronous
):
    calls = [
        ("read_file", {"file_path": SELECTED_PATH}),
        ("read_file", {"file_path": OTHER_PATH}),
        ("ls", {"path": "/"}),
        ("ls", {"path": "/documents/"}),
        ("ls", {"path": "/documents"}),
        ("glob", {"pattern": "**/*.txt", "path": "/"}),
        ("glob", {"pattern": "*.txt", "path": "/documents/"}),
        ("glob", {"pattern": "/documents/*.txt"}),
        ("grep", {"pattern": "needle", "output_mode": "content"}),
        ("grep", {"pattern": "needle", "path": "/documents", "output_mode": "count"}),
        ("grep", {"pattern": "needle", "path": OTHER_PATH}),
    ]
    _, messages = await run_tools(
        "owner",
        [SELECTED_ID, SELECTED_ID.upper()],
        calls,
        asynchronous=asynchronous,
        files={"/scratch.txt": create_file_data("needle scratch")},
    )
    assert messages[0].status == "success"
    assert "selected text" in messages[0].content
    assert messages[1].status == messages[-1].status == "error"
    for message in [messages[0], messages[2], *messages[8:10]]:
        assert OTHER_PATH not in message.content
        assert "private text" not in message.content
    assert messages[2].status == "success"
    assert all(message.status == "error" for message in messages[3:8])
    for message in messages[8:10]:
        assert message.status == "success"
        assert SELECTED_PATH in message.content
    assert "/scratch.txt" in messages[2].content
    assert "needle scratch" in messages[8].content


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_empty_selection_hides_mount_and_denies_document_access(
    document_store, asynchronous
):
    calls = [
        ("ls", {"path": "/"}),
        ("glob", {"pattern": "**/*.txt"}),
        ("grep", {"pattern": "needle"}),
        ("ls", {"path": "/documents/"}),
        ("read_file", {"file_path": SELECTED_PATH}),
    ]
    _, messages = await run_tools("owner", [], calls, asynchronous=asynchronous)
    for message in [messages[0], messages[2]]:
        assert message.status == "success"
        assert "/documents" not in message.content
    assert all(message.status == "error" for message in [messages[1], *messages[3:]])


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_all_document_mutations_denied_and_scratch_stays_in_state(
    document_store, asynchronous
):
    paths = [
        SELECTED_PATH,
        OTHER_PATH,
        "/documents",
        "/documents/",
        "/documents/new.txt",
        "/documents/.hidden",
        "/documents/.hidden/nested/.file",
    ]
    calls = []
    for path in paths:
        calls.extend(
            [
                ("write_file", {"file_path": path, "content": "replacement"}),
                (
                    "edit_file",
                    {
                        "file_path": path,
                        "old_string": "needle",
                        "new_string": "replacement",
                    },
                ),
                ("delete", {"file_path": path}),
            ]
        )
    calls.append(
        (
            "write_file",
            {"file_path": "/documents2/scratch.txt", "content": "scratch text"},
        )
    )
    result, messages = await run_tools(
        "owner", [SELECTED_ID], calls, asynchronous=asynchronous
    )
    assert all(
        message.status == "error" and "permission denied" in message.content
        for message in messages[:-1]
    )
    assert messages[-1].status == "success"
    assert result["files"]["/documents2/scratch.txt"]["content"] == "scratch text"
    stored = document_store.search(vfs.get_document_namespace("owner"))
    assert len(stored) == 2
    assert {item.value["content"] for item in stored} == {
        "needle selected text",
        "needle private text",
    }


@pytest.mark.asyncio
async def test_mounted_backend_denies_direct_mutations_and_transfers(document_store):
    backend = vfs.create_backend("owner")
    assert backend.write(SELECTED_PATH, "replacement").error
    assert (await backend.awrite(SELECTED_PATH, "replacement")).error
    assert backend.edit(SELECTED_PATH, "needle", "replacement").error
    assert (await backend.aedit(SELECTED_PATH, "needle", "replacement")).error
    assert backend.delete(SELECTED_PATH).error
    assert (await backend.adelete(SELECTED_PATH)).error
    files = [(SELECTED_PATH, b"replacement"), ("/documents/.hidden", b"hidden")]
    assert all(response.error for response in backend.upload_files(files))
    assert all(response.error for response in await backend.aupload_files(files))
    assert (
        document_store.get(
            vfs.get_document_namespace("owner"),
            vfs.get_document_storage_key(SELECTED_ID),
        ).value["content"]
        == "needle selected text"
    )
