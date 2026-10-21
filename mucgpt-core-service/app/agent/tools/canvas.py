from collections.abc import Iterator
from logging import Logger
from typing import Annotated, Any

from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.prebuilt import InjectedState, ToolRuntime
from langgraph.types import Command, StreamWriter

from agent.tools.spec import LocalTool
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from api.api_models import CanvasState

# All canvas chunks stream under this single name so the legacy fence
# (```MUCGPTCanvas) and the activity timeline stay uniform.
CANVAS_STREAM_NAME = "Canvas"

# Groups the three canvas tools into one "Canvas" entry in the tool selector
# mirrors the mcp_group set on the built tools.
CANVAS_MCP_GROUP = "Canvas"

CANVAS_WRITE_SUMMARY = (
    "Replaces the entire canvas document with the given markdown content. "
    "Only use this when the user explicitly wants the whole document rewritten."
)

CANVAS_EDIT_SUMMARY = (
    "Replaces the exact string old_text with new_text in the canvas document. "
    "Prefer this over canvas_write for any change smaller than a full rewrite; "
    "copy old_text verbatim from the document."
)

CANVAS_READ_SUMMARY = (
    "Returns the current canvas document content as markdown. "
    "Use as a safety net when the canvas content in the context seems outdated."
)

CANVAS_METADATA = {
    "canvas_write": {
        "deutsch": {
            "name": "Canvas schreiben",
            "description": "Ersetzt den gesamten Canvas-Inhalt durch neuen Markdown-Text.",
        },
        "english": {
            "name": "Write to Canvas",
            "description": "Replaces the entire canvas content with new markdown text.",
        },
    },
    "canvas_edit": {
        "deutsch": {
            "name": "Canvas bearbeiten",
            "description": "Ersetzt eine bestimmte Textstelle im Canvas durch einen neuen Text.",
        },
        "english": {
            "name": "Edit Canvas",
            "description": "Replaces an exact passage in the canvas with new text.",
        },
    },
    "canvas_read": {
        "deutsch": {
            "name": "Canvas lesen",
            "description": "Liest den aktuellen Canvas-Inhalt als Markdown aus.",
        },
        "english": {
            "name": "Read Canvas",
            "description": "Returns the current canvas content as markdown.",
        },
    },
}

NO_CANVAS_ERROR = (
    "Error: no canvas is active for this conversation. "
    "The canvas tools are only available while the user has the canvas open."
)

# The ToolNode strips caller-supplied values for InjectedToolArg-style params
# (anti-forgery), so canvas_state is delivered from graph state via InjectedState
# instead of relying on middleware-injected args alone.
_CANVAS_STATE_ARG = Annotated[CanvasState | None, InjectedState("canvas")]


def _get_writer() -> StreamWriter | None:
    try:
        return get_stream_writer()
    except RuntimeError:
        return None


def _ensure_canvas(value: Any) -> CanvasState | None:
    if isinstance(value, CanvasState):
        return value
    if isinstance(value, dict):
        try:
            return CanvasState.model_validate(value)
        except Exception:
            return None
    return None


def _next_revision(runtime: ToolRuntime | None) -> int:
    """Bump and return the run-scoped canvas revision counter."""
    context = getattr(runtime, "context", None)
    if context is None or not hasattr(context, "canvas_revision"):
        return 0
    context.canvas_revision += 1
    return context.canvas_revision


def _tool_result(
    runtime: ToolRuntime | None,
    content: str,
    updated_canvas: CanvasState | None = None,
) -> str | Command:
    """Wrap a mutating tool's result so the updated canvas lands in graph state.

    The Command must carry the terminating ToolMessage bound to the tool call id
    (what the model sees); the ``canvas`` update keeps later tool calls and the
    next model call in the same run on fresh content.
    """
    if updated_canvas is None:
        return content
    return Command(
        update={
            "canvas": updated_canvas,
            "messages": [
                ToolMessage(
                    content=content,
                    tool_call_id=getattr(runtime, "tool_call_id", None) or "",
                )
            ],
        }
    )


def _emit(
    writer: StreamWriter | None,
    state: ToolStreamState,
    content: str,
    metadata: dict | None = None,
) -> None:
    if writer is None:
        return
    writer(
        ToolStreamChunk(
            state=state,
            content=content,
            tool_name=CANVAS_STREAM_NAME,
            metadata=metadata,
        ).model_dump_json()
    )


def _iter_markdown_chunks(content: str) -> Iterator[str]:
    """Split content into line-sized chunks so the editor can render them live."""
    for line in content.splitlines(keepends=True):
        if line:
            yield line


def make_canvas_write_tool(logger: Logger) -> BaseTool:
    @tool("canvas_write", description=CANVAS_WRITE_SUMMARY)
    def canvas_write(
        content: str,
        canvas_state: _CANVAS_STATE_ARG = None,
        runtime: ToolRuntime = None,
    ) -> str:
        canvas = _ensure_canvas(canvas_state)
        if canvas is None:
            return NO_CANVAS_ERROR
        if not content or not content.strip():
            return "Error: content is required for canvas_write."

        writer = _get_writer()
        _emit(writer, ToolStreamState.STARTED, "")
        for chunk in _iter_markdown_chunks(content):
            _emit(writer, ToolStreamState.APPEND, chunk)
        _emit(
            writer,
            ToolStreamState.UPDATE,
            content,
            metadata={"canvas_revision": _next_revision(runtime)},
        )
        # A full replace clears the selection (mirrors the client's setMarkdown).
        return _tool_result(
            runtime, content, CanvasState(content=content, selection=None)
        )

    canvas_write.metadata = {"mcp_group": CANVAS_MCP_GROUP}
    return canvas_write


def make_canvas_edit_tool(logger: Logger) -> BaseTool:
    @tool("canvas_edit", description=CANVAS_EDIT_SUMMARY)
    def canvas_edit(
        old_text: str,
        new_text: str,
        canvas_state: _CANVAS_STATE_ARG = None,
        runtime: ToolRuntime = None,
    ) -> str:
        canvas = _ensure_canvas(canvas_state)
        if canvas is None:
            return NO_CANVAS_ERROR
        if not old_text:
            return "Error: old_text is required for canvas_edit."

        document = canvas.content
        occurrences = document.count(old_text)
        if occurrences == 0:
            return (
                "Error: old_text was not found in the canvas document. "
                "Copy old_text verbatim from the current document "
                "(canvas_read returns it) and retry."
            )
        if occurrences > 1:
            return (
                f"Error: old_text occurs {occurrences} times in the canvas document. "
                "Extend old_text with surrounding context so it matches exactly one passage."
            )
        if canvas.selection and old_text not in canvas.selection:
            return (
                "Error: a passage is selected in the canvas; "
                "old_text must be part of the selected text."
            )

        updated = document.replace(old_text, new_text, 1)
        # Keep the reported caret meaningful across the edit: shift it by the
        # length delta when it sits after the replaced passage, move it to the
        # edit start when it sat inside the passage.
        cursor = canvas.cursor
        if cursor is not None:
            start = document.find(old_text)
            if cursor >= start + len(old_text):
                cursor += len(new_text) - len(old_text)
            elif cursor > start:
                cursor = start
        writer = _get_writer()
        _emit(writer, ToolStreamState.STARTED, "")
        # Only canvas_write's UPDATE carries revision metadata; canvas_edit's
        # final UPDATE carries none so the editor always applies it.
        _emit(writer, ToolStreamState.UPDATE, updated)
        return _tool_result(
            runtime,
            updated,
            CanvasState(content=updated, selection=canvas.selection, cursor=cursor),
        )

    canvas_edit.metadata = {"mcp_group": CANVAS_MCP_GROUP}
    return canvas_edit


def make_canvas_read_tool(logger: Logger) -> BaseTool:
    @tool("canvas_read", description=CANVAS_READ_SUMMARY)
    def canvas_read(
        canvas_state: _CANVAS_STATE_ARG = None,
    ) -> str:
        canvas = _ensure_canvas(canvas_state)
        if canvas is None:
            return NO_CANVAS_ERROR
        return canvas.content

    canvas_read.metadata = {"mcp_group": CANVAS_MCP_GROUP}
    return canvas_read


WRITE_TOOL = LocalTool(
    id="canvas_write",
    factory=make_canvas_write_tool,
    metadata=CANVAS_METADATA["canvas_write"],
    needs_model=False,
    mcp_group=CANVAS_MCP_GROUP,
)

EDIT_TOOL = LocalTool(
    id="canvas_edit",
    factory=make_canvas_edit_tool,
    metadata=CANVAS_METADATA["canvas_edit"],
    needs_model=False,
    mcp_group=CANVAS_MCP_GROUP,
)

READ_TOOL = LocalTool(
    id="canvas_read",
    factory=make_canvas_read_tool,
    metadata=CANVAS_METADATA["canvas_read"],
    needs_model=False,
    mcp_group=CANVAS_MCP_GROUP,
)

TOOLS = (WRITE_TOOL, EDIT_TOOL, READ_TOOL)
