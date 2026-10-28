from typing import Any
from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.utils.function_calling import convert_to_openai_function
from langgraph.prebuilt import ToolRuntime
from langgraph.types import Command

from agent.middleware import RequestContext
from agent.tools import canvas
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from api.api_models import CanvasState


class RecordingWriter:
    def __init__(self) -> None:
        self.chunks: list[ToolStreamChunk] = []

    def __call__(self, raw: str) -> None:
        self.chunks.append(ToolStreamChunk.model_validate_json(raw))


def _logger() -> MagicMock:
    return MagicMock()


def _runtime(revision: int = 0, tool_call_id: str = "call-1") -> ToolRuntime:
    return ToolRuntime(
        state={},
        context=RequestContext(canvas_revision=revision),
        config={},
        stream_writer=None,
        tool_call_id=tool_call_id,
        store=None,
    )


def _command_result(result: Any) -> tuple[str, CanvasState]:
    """Extract (tool-result text, updated canvas) from a tool invocation."""
    if isinstance(result, Command):
        [message] = result.update["messages"]
        return message.content, result.update["canvas"]
    return result, None


def _canvas(content: str = "old content", selection: str | None = None) -> CanvasState:
    return CanvasState(content=content, selection=selection)


# user-facing confirmation prefix returned by mutating canvas tools
CONFIRMATION = "Canvas document updated"


def test_canvas_write_replaces_document_and_streams(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_write_tool(_logger())

    result = tool.invoke(
        {
            "content": "# Title\n\nBody text",
            "canvas_state": _canvas("old content"),
            "runtime": _runtime(),
        }
    )

    result, updated_canvas = _command_result(result)

    # short confirmation only — the full document must not be duplicated into
    # the persisted ToolMessage (state injection refreshes it next model call)
    assert result.startswith(CONFIRMATION)
    assert updated_canvas == CanvasState(content="# Title\n\nBody text", selection=None)
    states = [chunk.state for chunk in writer.chunks]
    assert states[0] == ToolStreamState.STARTED
    assert states[-1] == ToolStreamState.UPDATE
    assert all(state == ToolStreamState.APPEND for state in states[1:-1])
    assert all(chunk.tool_name == "Canvas" for chunk in writer.chunks)
    appended = "".join(
        str(chunk.content)
        for chunk in writer.chunks
        if chunk.state == ToolStreamState.APPEND
    )
    assert appended == "# Title\n\nBody text"
    final = writer.chunks[-1]
    assert final.content == "# Title\n\nBody text"
    assert final.metadata == {"canvas_revision": 1}


def test_canvas_write_creates_canvas_without_prior_state(monkeypatch: Any) -> None:
    """The canvas is always editable: canvas_write starts one from nothing."""
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_write_tool(_logger())

    result, updated_canvas = _command_result(
        tool.invoke({"content": "# Title", "runtime": _runtime()})
    )

    assert result.startswith(CONFIRMATION)
    assert updated_canvas == CanvasState(content="# Title", selection=None)
    states = [chunk.state for chunk in writer.chunks]
    assert states[0] == ToolStreamState.STARTED
    assert states[-1] == ToolStreamState.UPDATE


def test_canvas_write_rejects_empty_content(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_write_tool(_logger())

    result = tool.invoke({"content": "   ", "canvas_state": _canvas()})

    assert result.startswith("Error:")
    assert writer.chunks == []


def test_canvas_write_rejects_raw_html(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_write_tool(_logger())

    result = tool.invoke(
        {
            "content": "Hello <u>underlined</u> world",
            "canvas_state": _canvas(),
            "runtime": _runtime(),
        }
    )

    assert result.startswith("Error:")
    assert "GitHub-Flavored Markdown" in result
    assert writer.chunks == []


def test_canvas_write_allows_html_inside_code(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_write_tool(_logger())

    fenced = "# Config\n\n```text\n<div>not html</div>\n```"
    result, updated_canvas = _command_result(
        tool.invoke(
            {"content": fenced, "canvas_state": _canvas(), "runtime": _runtime()}
        )
    )

    assert result.startswith(CONFIRMATION)
    assert updated_canvas.content == fenced
    inline = "use `a < b` comparisons"
    result, _ = _command_result(
        tool.invoke(
            {
                "content": inline,
                "canvas_state": updated_canvas,
                "runtime": _runtime(revision=1),
            }
        )
    )

    assert result.startswith(CONFIRMATION)


def test_canvas_edit_rejects_raw_html_in_new_text(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "world",
            "new_text": "<u>there</u>",
            "canvas_state": _canvas("Hello world"),
            "runtime": _runtime(),
        }
    )

    assert result.startswith("Error:")
    assert "GitHub-Flavored Markdown" in result
    assert writer.chunks == []


def test_canvas_edit_replaces_first_occurrence_and_streams(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "world",
            "new_text": "there",
            "canvas_state": _canvas("Hello world"),
            "runtime": _runtime(revision=1),
        }
    )

    result, updated_canvas = _command_result(result)

    assert result.startswith(CONFIRMATION)
    assert updated_canvas == CanvasState(content="Hello there", selection=None)
    assert [chunk.state for chunk in writer.chunks] == [
        ToolStreamState.STARTED,
        ToolStreamState.UPDATE,
    ]
    assert writer.chunks[-1].content == "Hello there"
    # Only canvas_write's UPDATE carries revision metadata; edits always apply.
    assert writer.chunks[-1].metadata is None


def test_canvas_edit_keeps_selection_in_state_update(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "selected text",
            "new_text": "revised text",
            "canvas_state": _canvas("selected text", selection="selected text"),
            "runtime": _runtime(),
        }
    )

    _, updated_canvas = _command_result(result)

    assert updated_canvas == CanvasState(
        content="revised text", selection="selected text"
    )


def test_canvas_write_then_edit_build_on_previous_update(monkeypatch: Any) -> None:
    """The state update of call 1 must feed call 2 — chained calls within one run."""
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    write = canvas.make_canvas_write_tool(_logger())
    edit = canvas.make_canvas_edit_tool(_logger())

    first = write.invoke(
        {
            "content": "Hello world",
            "canvas_state": _canvas("old content"),
            "runtime": _runtime(),
        }
    )
    _, updated_canvas = _command_result(first)

    second = edit.invoke(
        {
            "old_text": "world",
            "new_text": "there",
            "canvas_state": updated_canvas,
            "runtime": _runtime(),
        }
    )
    result, updated_canvas = _command_result(second)

    assert result.startswith(CONFIRMATION)
    assert updated_canvas.content == "Hello there"
    updates = [
        chunk for chunk in writer.chunks if chunk.state == ToolStreamState.UPDATE
    ]
    # only canvas_write's UPDATE carries a revision; edits always apply
    assert updates[0].metadata == {"canvas_revision": 1}
    assert updates[1].metadata is None


def test_canvas_edit_without_match_errors(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "missing passage",
            "new_text": "x",
            "canvas_state": _canvas("Hello world"),
        }
    )

    assert result.startswith("Error:")
    assert "not found" in result
    assert writer.chunks == []


def test_canvas_edit_with_ambiguous_match_errors(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "dup",
            "new_text": "x",
            "canvas_state": _canvas("dup and dup"),
        }
    )

    assert result.startswith("Error:")
    assert "2 times" in result
    assert writer.chunks == []


def test_canvas_edit_must_target_active_selection(monkeypatch: Any) -> None:
    writer = RecordingWriter()
    monkeypatch.setattr(canvas, "_get_writer", lambda: writer)
    tool = canvas.make_canvas_edit_tool(_logger())

    result = tool.invoke(
        {
            "old_text": "outside",
            "new_text": "x",
            "canvas_state": _canvas("outside text selected text", "selected text"),
        }
    )

    assert result.startswith("Error:")
    assert "selected" in result
    assert writer.chunks == []


def test_canvas_read_returns_document_with_context_info(monkeypatch: Any) -> None:
    tool = canvas.make_canvas_read_tool(_logger())

    result = tool.invoke(
        {
            "canvas_state": _canvas("# Doc\n\ncontent", selection="selected text"),
        }
    )

    assert "Untrusted user data" in result
    assert "# Doc\n\ncontent" in result
    assert "Full document (14 characters)" in result
    assert "selected text" in result
    assert "canvas_edit's old_text must be part of it" in result
    # no cursor: no cursor line, and no table-annotation note for plain selections
    assert "Cursor" not in result
    assert "[table, row" not in result


def test_canvas_read_reports_cursor_and_table_selection() -> None:
    tool = canvas.make_canvas_read_tool(_logger())
    doc = "| a | b |\n| --- | --- |\n| 1 | 2 |"
    selection = '[table, row 2, col "a", referenced text: "1"]'

    result = tool.invoke(
        {"canvas_state": CanvasState(content=doc, selection=selection, cursor=10)}
    )

    assert "Cursor (the user's 'here') at character offset 10" in result
    assert 'after "| a | b |\n"' in result
    assert 'before "| --- | --- |\n| 1 | 2 |"' in result
    assert selection in result
    assert "the header is row 1" in result


def test_canvas_read_around_cursor_returns_only_a_window() -> None:
    tool = canvas.make_canvas_read_tool(_logger())
    doc = "a" * 2000 + "MIDDLE" + "b" * 20000

    result = tool.invoke(
        {"canvas_state": CanvasState(content=doc, cursor=2003), "around_cursor": True}
    )

    assert "Showing characters " in result
    assert "of 22006" in result
    assert "MIDDLE" in result
    # the window stays bounded around the cursor: no full a-run survives
    assert "a" * 2000 not in result


def test_canvas_read_around_cursor_without_cursor_errors() -> None:
    tool = canvas.make_canvas_read_tool(_logger())

    result = tool.invoke({"canvas_state": _canvas("# Doc"), "around_cursor": True})

    assert result.startswith("Error:")
    assert "without around_cursor" in result


def test_canvas_read_prunes_earlier_read_results() -> None:
    """An earlier full document must not stay in the checkpointed history."""
    tool = canvas.make_canvas_read_tool(_logger())
    prior_read_tool_call = {
        "name": "canvas_read",
        "args": {},
        "id": "call-1",
        "type": "tool_call",
    }
    history = [
        AIMessage(content="", tool_calls=[prior_read_tool_call]),
        ToolMessage(content="the old document", tool_call_id="call-1", id="msg-1"),
    ]

    result = tool.invoke(
        {
            "canvas_state": _canvas("# Doc v2"),
            "messages": history,
            "runtime": _runtime(tool_call_id="call-2"),
            "around_cursor": False,
        }
    )

    updated = result.update["messages"]
    replacement, fresh = updated
    assert replacement.id == "msg-1"
    assert replacement.tool_call_id == "call-1"
    assert replacement.content.startswith("[Canvas content from an earlier read")
    assert fresh.tool_call_id == "call-2"
    assert "# Doc v2" in fresh.content


def test_canvas_read_without_canvas_state_errors(monkeypatch: Any) -> None:
    tool = canvas.make_canvas_read_tool(_logger())

    assert tool.invoke({}).startswith("Error:")


def test_model_visible_schemas_contain_only_contract_args() -> None:
    expected = [
        (canvas.WRITE_TOOL, {"content"}),
        (canvas.EDIT_TOOL, {"old_text", "new_text"}),
        (canvas.READ_TOOL, {"around_cursor"}),
    ]
    for local_tool, visible_args in expected:
        spec = convert_to_openai_function(local_tool.build(None, _logger()))
        properties = set(spec["parameters"].get("properties", {}))
        assert properties == visible_args
        for hidden in ("canvas_state", "canvas_revision", "status_message", "messages"):
            assert hidden not in properties


def test_local_tools_are_registered() -> None:
    from agent.tools.tools import LOCAL_TOOLS

    registered = {t.id for t in LOCAL_TOOLS}
    assert {"canvas_write", "canvas_edit", "canvas_read"} <= registered


def test_canvas_read_is_hidden_from_activity_ui() -> None:
    from config.harness_profiles import DEEP_AGENT_INTERNAL_TOOLS

    assert "canvas_read" in DEEP_AGENT_INTERNAL_TOOLS
    assert "canvas_write" not in DEEP_AGENT_INTERNAL_TOOLS
    assert "canvas_edit" not in DEEP_AGENT_INTERNAL_TOOLS
