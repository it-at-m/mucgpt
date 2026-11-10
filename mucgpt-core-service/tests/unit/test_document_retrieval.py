from unittest.mock import AsyncMock, MagicMock, call

import pytest
from deepagents.backends import CompositeBackend, StateBackend
from deepagents.backends.utils import create_file_data
from deepagents.middleware.filesystem import FilesystemMiddleware
from langchain.agents import create_agent
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.store.memory import InMemoryStore

from core.document_backend import DocumentBackend

NAMESPACE = ("user_documents", "owner")
SELECTED_KEY = "/12345678-1234-4234-8234-123456789abc.txt"
OTHER_KEY = "/87654321-4321-4321-8321-cba987654321.txt"
SELECTED_PATH = "/documents" + SELECTED_KEY
OTHER_PATH = "/documents" + OTHER_KEY


class FilesystemTestModel(FakeMessagesListChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


def tool_response(name, args, tool_call_id):
    return AIMessage(
        content="",
        tool_calls=[
            {"name": name, "args": args, "id": tool_call_id, "type": "tool_call"}
        ],
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("asynchronous", [False, True])
async def test_grep_then_read_window_and_resume_use_only_attached_body(asynchronous):
    """Exercise real tool dispatch, mount routing, and model-visible pagination."""
    lines = [f"source line {number}\n" for number in range(1, 211)]
    lines[200] = "needle.* selected match\n"
    text = "".join(lines)
    store = InMemoryStore()
    store.put(NAMESPACE, SELECTED_KEY, create_file_data(text))
    store.put(NAMESPACE, OTHER_KEY, create_file_data("needle.* private text"))
    recording_store = MagicMock(wraps=store)
    recording_store.aget = AsyncMock(wraps=store.aget)
    recording_store.search.side_effect = AssertionError("namespace search forbidden")
    recording_store.asearch = AsyncMock(
        side_effect=AssertionError("namespace search forbidden")
    )
    backend = CompositeBackend(
        default=StateBackend(),
        routes={
            "/documents/": DocumentBackend(
                store=recording_store,
                namespace=lambda _: NAMESPACE,
                allowed_paths=[SELECTED_KEY],
            )
        },
    )
    model = FilesystemTestModel(
        responses=[
            tool_response(
                "grep",
                {
                    "pattern": "needle.*",
                    "path": "/documents/",
                    "output_mode": "content",
                },
                "search",
            ),
            tool_response(
                "read_file",
                {"file_path": SELECTED_PATH, "offset": 198, "limit": 5},
                "window",
            ),
            tool_response(
                "read_file",
                {"file_path": SELECTED_PATH, "offset": 203, "limit": 7},
                "resume",
            ),
            tool_response("read_file", {"file_path": OTHER_PATH}, "unattached"),
            AIMessage(content="done"),
        ]
    )
    agent = create_agent(
        model=model,
        middleware=[FilesystemMiddleware(backend=backend)],
    )
    inputs = {"messages": [("user", "Find the phrase and inspect nearby lines.")]}
    result = await agent.ainvoke(inputs) if asynchronous else agent.invoke(inputs)
    messages = {
        message.tool_call_id: message
        for message in result["messages"]
        if isinstance(message, ToolMessage)
    }

    search = messages["search"]
    assert search.status == "success"
    assert SELECTED_PATH in search.content
    assert "201" in search.content and "needle.* selected match" in search.content
    assert OTHER_PATH not in search.content and "private text" not in search.content

    window = messages["window"]
    assert window.status == "success"
    for number in range(199, 204):
        source = lines[number - 1].rstrip("\n")
        assert source in window.content
    assert "source line 198" not in window.content
    assert "source line 204" not in window.content
    assert "@@ lines 199-203 of 210 | next offset 203 @@" in window.content

    resume = messages["resume"]
    assert resume.status == "success"
    for number in range(204, 211):
        assert f"source line {number}" in resume.content
    assert "source line 203" not in resume.content
    assert "next offset" not in resume.content
    assert messages["unattached"].status == "error"
    assert "permission denied" in messages["unattached"].content
    assert "private text" not in messages["unattached"].content

    expected_calls = [call(NAMESPACE, SELECTED_KEY)] * 3
    if asynchronous:
        assert recording_store.aget.await_args_list == expected_calls
        recording_store.get.assert_not_called()
    else:
        assert recording_store.get.call_args_list == expected_calls
        recording_store.aget.assert_not_called()
    recording_store.search.assert_not_called()
    recording_store.asearch.assert_not_called()
    recording_store.put.assert_not_called()
    recording_store.aput.assert_not_called()
    assert result.get("files", {}) == {}
