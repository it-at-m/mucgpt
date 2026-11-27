"""A deterministic, tool-capable chat model for tests.

The fake intentionally lives in the test package.  It models the small part of
the provider contract exercised by agents while retaining every request and
tool binding for assertions.
"""

import asyncio
from collections.abc import AsyncIterator, Callable, Iterator, Sequence
from dataclasses import dataclass
from typing import Any, Literal, cast

from langchain_core.callbacks.manager import (
    AsyncCallbackManagerForLLMRun,
    CallbackManagerForLLMRun,
)
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    ToolMessage,
    message_chunk_to_message,
)
from langchain_core.outputs import ChatGeneration, ChatGenerationChunk, ChatResult
from langchain_core.tools import BaseTool
from langchain_core.utils.function_calling import convert_to_openai_function
from pydantic import Field, PrivateAttr


@dataclass(frozen=True)
class ScriptStep:
    """One expected model operation and its deterministic result."""

    kind: Literal["message", "stream", "error", "wait", "derive"]
    message: AIMessage | None = None
    chunks: tuple[AIMessageChunk, ...] = ()
    error: Exception | None = None
    stream_error: Exception | None = None
    event: asyncio.Event | None = None
    derive: Callable[[Sequence[BaseMessage]], AIMessage] | None = None


@dataclass(frozen=True)
class RecordedModelCall:
    """Input captured for a scripted invocation or stream."""

    messages: tuple[BaseMessage, ...]
    settings: dict[str, Any]
    mode: Literal["invoke", "stream"]


def text(content: str, **kwargs: Any) -> ScriptStep:
    """Return a normal final assistant message."""
    return ScriptStep(kind="message", message=AIMessage(content=content, **kwargs))


def message(value: AIMessage) -> ScriptStep:
    """Return a caller-created assistant message."""
    return ScriptStep(kind="message", message=value)


def stream(
    *contents: str | AIMessageChunk, then_raise: Exception | None = None
) -> ScriptStep:
    """Return chunks in exact order, optionally ending in a stream error."""
    chunks = tuple(
        value if isinstance(value, AIMessageChunk) else AIMessageChunk(content=value)
        for value in contents
    )
    return ScriptStep(kind="stream", chunks=chunks, stream_error=then_raise)


def tool_call(name: str, args: dict[str, Any], *, id: str) -> ScriptStep:
    """Return one well-formed tool call with a stable caller-supplied id."""
    return ScriptStep(
        kind="message",
        message=AIMessage(
            content="",
            tool_calls=[{"name": name, "args": args, "id": id, "type": "tool_call"}],
        ),
    )


def read_file(file_path: str, *, id: str, **kwargs: Any) -> ScriptStep:
    """Return a ``read_file`` call."""
    return tool_call("read_file", {"file_path": file_path, **kwargs}, id=id)


def grep(pattern: str, path: str, *, id: str, **kwargs: Any) -> ScriptStep:
    """Return a ``grep`` call."""
    return tool_call("grep", {"pattern": pattern, "path": path, **kwargs}, id=id)


def message_text(content: str | list[Any]) -> str:
    """Flatten text message content into the plain text a caller would read."""
    if isinstance(content, str):
        return content
    return "".join(
        part if isinstance(part, str) else str(part.get("text", "")) for part in content
    )


def answer_from_tool(
    *, tool_call_id: str | None = None, prefix: str = ""
) -> ScriptStep:
    """Compose the next assistant message from a recorded tool result.

    Deriving the answer from the tool result keeps the model response tied to
    what the tool actually returned instead of replaying canned text.  The
    latest tool result is used unless ``tool_call_id`` selects one.
    """

    def derive(messages: Sequence[BaseMessage]) -> AIMessage:
        results = [
            message
            for message in messages
            if isinstance(message, ToolMessage)
            and (tool_call_id is None or message.tool_call_id == tool_call_id)
        ]
        if not results:
            target = tool_call_id or "the latest tool call"
            raise AssertionError(f"Missing tool result for {target}")
        return AIMessage(content=f"{prefix}{message_text(results[-1].content)}")

    return ScriptStep(kind="derive", derive=derive)


def raise_error(error: Exception) -> ScriptStep:
    """Raise ``error`` when this script position is reached."""
    return ScriptStep(kind="error", error=error)


def wait_for(event: asyncio.Event) -> ScriptStep:
    """Wait for an event in asynchronous invocation or streaming."""
    return ScriptStep(kind="wait", event=event)


def content_filtered(content: str = "") -> ScriptStep:
    """Return a provider-style content-filtered response."""
    return ScriptStep(
        kind="message",
        message=AIMessage(
            content=content,
            response_metadata={"finish_reason": "content_filter"},
        ),
    )


def malformed_tool_call(
    *, id: str = "malformed-1", raw_arguments: str = "{"
) -> ScriptStep:
    """Return a deliberately invalid provider tool-call payload."""
    return ScriptStep(
        kind="message",
        message=AIMessage(
            content="",
            invalid_tool_calls=[
                {
                    "type": "invalid_tool_call",
                    "id": id,
                    "name": "broken_tool",
                    "args": raw_arguments,
                    "error": "scripted malformed tool call",
                }
            ],
        ),
    )


class ScriptedChatModel(BaseChatModel):
    """Execute a finite per-instance script without provider or network access."""

    script: list[ScriptStep]
    recorded_inputs: list[RecordedModelCall] = Field(default_factory=list)
    bound_tool_schemas: list[list[dict[str, Any]]] = Field(default_factory=list)
    _cursor: int = PrivateAttr(default=0)

    @property
    def _llm_type(self) -> str:
        return "scripted-chat-model"

    def bind_tools(
        self, tools: Sequence[dict[str, Any] | type | BaseTool | Any], **_: Any
    ):
        """Record the schemas while preserving this script and its cursor."""
        self.bound_tool_schemas.append([_tool_schema(tool) for tool in tools])
        return self

    def assert_consumed(self) -> None:
        """Assert that the test exercised every expected model operation."""
        if remaining := len(self.script) - self._cursor:
            raise AssertionError(f"Script has {remaining} unconsumed step(s)")

    def _next_step(
        self,
        messages: list[BaseMessage],
        settings: dict[str, Any],
        mode: Literal["invoke", "stream"],
    ) -> ScriptStep:
        self.recorded_inputs.append(
            RecordedModelCall(tuple(messages), dict(settings), mode)
        )
        if self._cursor == len(self.script):
            raise AssertionError(
                "ScriptedChatModel was invoked after its script was consumed"
            )
        step = self.script[self._cursor]
        self._cursor += 1
        return step

    @staticmethod
    def _raise_or_reject_wait(step: ScriptStep) -> None:
        if step.kind == "error":
            assert step.error is not None
            raise step.error
        if step.kind == "wait":
            raise RuntimeError(
                "wait_for() requires asynchronous invocation or streaming"
            )

    @staticmethod
    def _message_from_step(
        step: ScriptStep, messages: Sequence[BaseMessage]
    ) -> AIMessage:
        if step.kind == "derive":
            assert step.derive is not None
            return step.derive(messages)
        if step.kind == "message":
            assert step.message is not None
            return step.message
        if step.kind == "stream":
            if not step.chunks:
                return AIMessage(content="")
            aggregate = step.chunks[0]
            for chunk in step.chunks[1:]:
                aggregate += chunk
            return cast(AIMessage, message_chunk_to_message(aggregate))
        raise AssertionError("wait and error steps do not produce a message")

    @staticmethod
    def _chunk_from_message(message: AIMessage) -> AIMessageChunk:
        return AIMessageChunk(
            content=message.content,
            additional_kwargs=message.additional_kwargs,
            response_metadata=message.response_metadata,
            name=message.name,
            id=message.id,
            tool_calls=message.tool_calls,
            invalid_tool_calls=message.invalid_tool_calls,
            usage_metadata=message.usage_metadata,
        )

    @staticmethod
    def _settings_with_stop(
        kwargs: dict[str, Any], stop: list[str] | None
    ) -> dict[str, Any]:
        if stop is None:
            return kwargs
        return {**kwargs, "stop": stop}

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        step = self._next_step(
            messages, self._settings_with_stop(kwargs, stop), "invoke"
        )
        self._raise_or_reject_wait(step)
        return ChatResult(
            generations=[
                ChatGeneration(message=self._message_from_step(step, messages))
            ]
        )

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        step = self._next_step(
            messages, self._settings_with_stop(kwargs, stop), "invoke"
        )
        if step.kind == "wait":
            assert step.event is not None
            await step.event.wait()
            return ChatResult(
                generations=[ChatGeneration(message=AIMessage(content=""))]
            )
        self._raise_or_reject_wait(step)
        return ChatResult(
            generations=[
                ChatGeneration(message=self._message_from_step(step, messages))
            ]
        )

    def _stream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> Iterator[ChatGenerationChunk]:
        step = self._next_step(
            messages, self._settings_with_stop(kwargs, stop), "stream"
        )
        self._raise_or_reject_wait(step)
        chunks = (
            step.chunks
            if step.kind == "stream"
            else (self._chunk_from_message(self._message_from_step(step, messages)),)
        )
        for chunk in chunks:
            yield ChatGenerationChunk(message=chunk)
        if step.stream_error:
            raise step.stream_error

    async def _astream(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: AsyncCallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        step = self._next_step(
            messages, self._settings_with_stop(kwargs, stop), "stream"
        )
        if step.kind == "wait":
            assert step.event is not None
            await step.event.wait()
            yield ChatGenerationChunk(message=AIMessageChunk(content=""))
            return
        self._raise_or_reject_wait(step)
        chunks = (
            step.chunks
            if step.kind == "stream"
            else (self._chunk_from_message(self._message_from_step(step, messages)),)
        )
        for chunk in chunks:
            yield ChatGenerationChunk(message=chunk)
        if step.stream_error:
            raise step.stream_error


def _tool_schema(tool: dict[str, Any] | type | BaseTool | Any) -> dict[str, Any]:
    """Use LangChain's public conversion routine and make the result plain data."""
    if isinstance(tool, dict):
        return dict(tool)
    return dict(convert_to_openai_function(tool))
