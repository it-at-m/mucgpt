import json
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from ag_ui.core import (
    PROTOCOL_VERSION,
    BaseEvent,
    CustomEvent,
    EventType,
    MessagesSnapshotEvent,
    RunErrorEvent,
    RunFinishedEvent,
    RunFinishedInterruptOutcome,
    RunStartedEvent,
    StateSnapshotEvent,
    TextMessageChunkEvent,
    ToolCallChunkEvent,
    ToolCallResultEvent,
)
from ag_ui.core import (
    AssistantMessage as AgUiAssistantMessage,
)
from ag_ui.core import (
    Interrupt as AgUiInterrupt,
)
from ag_ui.core import (
    SystemMessage as AgUiSystemMessage,
)
from ag_ui.core import (
    TokenUsage as AgUiTokenUsage,
)
from ag_ui.core import (
    UserMessage as AgUiUserMessage,
)
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import merge_configs
from langfuse import get_client, observe, propagate_attributes
from langfuse.langchain import CallbackHandler
from langgraph.types import Command
from pydantic import ValidationError

from agent.deep_agent import MUCGPTAgent, PendingToolApproval
from agent.middleware import TokenUsage
from agent.tools.canvas import CANVAS_STREAM_NAME
from agent.tools.tool_chunk import ToolStreamChunk
from api.api_models import (
    CanvasState,
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionDelta,
    ChatCompletionMessage,
    ChatCompletionResponse,
    ToolApprovalResumeEntry,
    Usage,
)
from api.api_models import ChatCompletionMessage as InputMessage
from api.exception import llm_error_payload
from config.langfuse_provider import LangfuseProvider
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    extract_department_prefix,
    hash_user_id,
    to_langchain_messages,
)
from core.logtools import getLogger
from core.stream_cleanup import close_stream

logger = getLogger(name="mucgpt-core-agent")


def _json_safe(value: Any) -> Any:
    """Convert LangChain/Pydantic objects into Langfuse-serializable data."""
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(val) for key, val in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    if hasattr(value, "model_dump"):
        return _json_safe(value.model_dump())
    if hasattr(value, "dict"):
        return _json_safe(value.dict())
    return str(value)


def _graph_input(messages: list[InputMessage], resume: dict[str, Any] | None) -> Any:
    """Build the graph input: the turn's messages, or a resume command.

    A native AG-UI request may carry ``resume[]`` answers to interrupts that
    ended a previous run; resuming continues the interrupted thread via a
    LangGraph ``Command(resume=…)`` keyed by interrupt id (groundwork for
    #1093/#1085 — no interrupting tool exists yet).
    """
    if resume:
        return Command(resume=resume)
    return {"messages": to_langchain_messages(messages)}


def _interrupt_outcomes(interrupts: tuple[Any, ...]) -> list[AgUiInterrupt]:
    """Map LangGraph ``Interrupt`` objects onto AG-UI interrupt descriptions."""
    outcomes: list[AgUiInterrupt] = []
    for interrupt in interrupts:
        value = getattr(interrupt, "value", None)
        value_dict = value if isinstance(value, dict) else {}
        try:
            outcomes.append(
                AgUiInterrupt(
                    id=getattr(interrupt, "id", None) or uuid.uuid4().hex,
                    reason=value_dict.get("reason") or "tool_call",
                    tool_call_id=value_dict.get("tool_call_id"),
                    response_schema=getattr(interrupt, "response_schema", None),
                    message=value_dict.get("message"),
                )
            )
        except ValidationError:
            # An unrepresentable interrupt must not crash the run after the
            # snapshots were already streamed; skip it with a warning.
            logger.exception("Skipping unrepresentable interrupt")
    return outcomes


def _to_ag_ui_history(messages: list[Any]) -> list[Any]:
    """Map LangChain state messages onto AG-UI messages for MESSAGES_SNAPSHOT."""
    converted: list[Any] = []
    for message in messages:
        content = (
            message.content
            if isinstance(message.content, str)
            else str(message.content)
        )
        message_id = getattr(message, "id", None) or uuid.uuid4().hex
        if isinstance(message, HumanMessage):
            converted.append(
                AgUiUserMessage(id=message_id, role="user", content=content)
            )
        elif isinstance(message, AIMessage):
            converted.append(
                AgUiAssistantMessage(id=message_id, role="assistant", content=content)
            )
        elif isinstance(message, SystemMessage):
            converted.append(
                AgUiSystemMessage(id=message_id, role="system", content=content)
            )
    return converted


async def _interrupt_finish_events(
    graph: Any,
    config: RunnableConfig,
    conversation_id: str,
    run_id: str,
    interrupts: tuple[Any, ...],
    token_usage: Any,
    model: str | None,
    outcome: RunFinishedInterruptOutcome | None = None,
) -> AsyncGenerator[BaseEvent]:
    """Snapshot the interrupted state and finish the run with an interrupt outcome.

    The state snapshots let the consumer resume the thread later; the interrupt
    outcome (with tool_call_id bindings and response schemas) is what the
    human-approval UI is built on (#1093/#1085).
    """
    try:
        state = await graph.aget_state(config)
        yield StateSnapshotEvent(
            type=EventType.STATE_SNAPSHOT, snapshot=_json_safe(state.values)
        )
        yield MessagesSnapshotEvent(
            type=EventType.MESSAGES_SNAPSHOT,
            messages=_to_ag_ui_history(state.values.get("messages", [])),
        )
    except Exception:
        logger.exception("Failed to snapshot the interrupted graph state")
    yield RunFinishedEvent(
        type=EventType.RUN_FINISHED,
        thread_id=conversation_id,
        run_id=run_id,
        outcome=outcome
        or RunFinishedInterruptOutcome(
            type="interrupt", interrupts=_interrupt_outcomes(interrupts)
        ),
        usage=_ag_ui_usage_from_token_usage(token_usage, model),
        metadata={"mucgpt": {"contextTokens": token_usage.context_tokens}},
    )


def _summarized_canvas_chunk(chunk: ToolStreamChunk) -> dict[str, Any]:
    """Canvas chunks repeat the full document (per-line APPENDs, whole-doc
    UPDATEs); tracing them verbatim amplifies the payload in every trace event.
    The short ToolMessage in the graph already records the update semantically."""
    content = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
    return {
        "tool_name": chunk.tool_name,
        "state": str(chunk.state),
        "content_length": len(content),
        "content_preview": content[:200],
        "metadata": chunk.metadata,
    }


def _usage_from_token_usage(token_usage: TokenUsage) -> Usage | None:
    if token_usage.context_tokens is None:
        return None
    return Usage(
        prompt_tokens=token_usage.prompt_tokens,
        completion_tokens=token_usage.completion_tokens,
        total_tokens=token_usage.prompt_tokens + token_usage.completion_tokens,
        cache_read_tokens=token_usage.cache_read_tokens,
        context_tokens=token_usage.context_tokens,
    )


def _ag_ui_usage_from_token_usage(
    token_usage: TokenUsage, model: str | None
) -> list[AgUiTokenUsage] | None:
    if token_usage.context_tokens is None:
        return None
    return [
        AgUiTokenUsage(
            model=model,
            input_tokens=token_usage.prompt_tokens,
            output_tokens=token_usage.completion_tokens,
            total_tokens=token_usage.prompt_tokens + token_usage.completion_tokens,
            reasoning_tokens=token_usage.reasoning_tokens or None,
            cached_input_tokens=token_usage.cache_read_tokens or None,
        )
    ]


def _message_chunk_trace_event(
    message_chunk: Any, metadata: dict[str, Any]
) -> dict[str, Any]:
    return {
        "stream": "messages",
        "node": metadata.get("langgraph_node"),
        "run_name": metadata.get("run_name"),
        "tags": metadata.get("tags"),
        "internal": _is_internal_chunk(metadata),
        "message_type": type(message_chunk).__name__,
        "content": _json_safe(getattr(message_chunk, "content", None)),
        "tool_calls": _json_safe(getattr(message_chunk, "tool_calls", None)),
        "additional_kwargs": _json_safe(
            getattr(message_chunk, "additional_kwargs", None)
        ),
        "response_metadata": _json_safe(
            getattr(message_chunk, "response_metadata", None)
        ),
        "usage_metadata": _json_safe(getattr(message_chunk, "usage_metadata", None)),
    }


def _write_stream_trace_span(
    input_messages: list[InputMessage], trace_events: list[dict[str, Any]]
) -> None:
    if not trace_events:
        return
    try:
        with get_client().start_as_current_observation(
            as_type="span",
            name="agent-stream-events",
        ) as span:
            span.update(
                input=[message.model_dump() for message in input_messages],
                output={"events": trace_events},
            )
    except Exception:
        logger.debug("Failed to write agent stream trace span", exc_info=True)


def _is_internal_chunk(metadata: dict[str, Any]) -> bool:
    """Return True when a streamed chunk belongs to internal helper calls."""
    if metadata.get("stream_to_user") is False or metadata.get("internal") is True:
        return True

    run_name = str(metadata.get("run_name") or "").strip().lower()
    if run_name == "internal_scope_router":
        return True

    tags = metadata.get("tags") or []
    if isinstance(tags, list):
        normalized_tags = {str(tag).strip().lower() for tag in tags}
        if "internal" in normalized_tags or "scope-router" in normalized_tags:
            return True

    return False


def toolchunk_to_chatcompletionchunk(
    tool_chunk: ToolStreamChunk, id_: str, created: int, index: int = 0
) -> ChatCompletionChunk:
    """
    Convert a ToolStreamChunk to a ChatCompletionChunk, preserving state and metadata in the tool_calls field.
    """

    delta = ChatCompletionDelta(
        role="assistant",
        content=None,
        tool_calls=[
            {
                "name": tool_chunk.tool_name,
                "state": tool_chunk.state.value,
                "content": tool_chunk.content,
                "metadata": tool_chunk.metadata,
            }
        ],
    )
    choice = ChatCompletionChunkChoice(delta=delta, index=index, finish_reason=None)
    return ChatCompletionChunk(
        id=id_,
        object="chat.completion.chunk",
        created=created,
        choices=[choice],
        usage=None,
    )


TOOL_APPROVAL_REASON = "tool_approval"


def _interrupt_outcome(
    pending: list[PendingToolApproval],
) -> RunFinishedInterruptOutcome:
    return RunFinishedInterruptOutcome(
        type="interrupt",
        interrupts=[
            AgUiInterrupt(
                id=approval.tool_call_id,
                reason=TOOL_APPROVAL_REASON,
                tool_call_id=approval.tool_call_id,
                metadata={
                    "mucgpt": {
                        "toolName": approval.tool_name,
                        "args": approval.args,
                        "dataClassification": approval.data_classification,
                    }
                },
            )
            for approval in pending
        ],
    )


def build_resume_decisions(
    pending: list[PendingToolApproval], answers: list[ToolApprovalResumeEntry]
) -> list[dict[str, str]]:
    by_id = {answer.interrupt_id: answer for answer in answers}
    pending_ids = {approval.tool_call_id for approval in pending}
    if not pending:
        raise ValueError("This conversation has no paused run to continue")
    if len(by_id) != len(answers) or set(by_id) != pending_ids:
        raise ValueError("Answer every paused tool call exactly once")
    return [
        {"type": "approve" if by_id[approval.tool_call_id].is_approved else "reject"}
        for approval in pending
    ]


class MUCGPTAgentExecutor:
    """Provides run_with_streaming and run_without_streaming methods using MUCGPTAgent."""

    def __init__(
        self,
        agent: MUCGPTAgent,
    ):
        self.logger = logger
        self.agent = agent

        langfuse_handler = LangfuseProvider.get_callback_handler()
        callbacks: list[CallbackHandler] | None = (
            [langfuse_handler] if langfuse_handler else None
        )
        self.base_config: RunnableConfig = RunnableConfig(
            callbacks=callbacks,  # type: ignore
            run_name="MUCGPTAgent",
        )

    def _build_llm_extra_body(self, assistant_id: str | None) -> dict[str, Any] | None:
        tags: list[str] = []
        if assistant_id:
            tags.append(f"MUCGPT_ASSISTANT_ID:{assistant_id}")
        if not tags:
            return None
        return {"metadata": {"tags": tags}}

    async def run_with_streaming(
        self,
        messages: list[InputMessage],
        temperature: float,
        model: str | None,
        user_info: AuthenticationResult | None,
        enabled_tools: list[str] | None = None,
        assistant_id: str | None = None,
        data_sources: list[dict[str, Any]] | None = None,
        canvas: CanvasState | None = None,
        conversation_id: str | None = None,
        reasoning_effort: str | None = None,
    ) -> AsyncGenerator[dict]:
        logger.debug(
            "Chat streaming started with temperature %s, model %s",
            temperature,
            model,
        )
        msgs = to_langchain_messages(messages)
        id_ = str(uuid.uuid4())
        created = int(time.time())
        logger.debug("Stream ID: %s, created: %s", id_, created)
        dept_prefix = (
            extract_department_prefix(user_info.department) if user_info else None
        )
        llm_user = dept_prefix
        llm_extra_body = self._build_llm_extra_body(assistant_id)
        tags = (
            [f"assistant-{assistant_id}"]
            if assistant_id is not None
            else ["default-assistant"]
        )
        with propagate_attributes(
            user_id=hash_user_id(user_info.user_id if user_info else None),
            tags=tags,
            session_id=conversation_id,
            trace_name="Agent",
        ):
            # Record only the latest input rather than the full resent history.
            get_client().update_current_span(
                input=messages[-1].content if messages else None
            )
            answer_chunks: list[str] = []
            trace_events: list[dict[str, Any]] = []
            token_usage = TokenUsage()
            config = merge_configs(
                self.base_config,
                RunnableConfig(
                    configurable={
                        "thread_id": conversation_id,
                        "llm_temperature": temperature,
                        "reasoning_effort": reasoning_effort,
                        "llm": model,
                        "llm_streaming": True,
                        "enabled_tools": enabled_tools,
                        "agent_state": {"current_scope": "general"},
                        "user_info": user_info,
                        "llm_user": llm_user,
                        "llm_extra_body": llm_extra_body,
                        "assistant_id": assistant_id,
                        "data_sources": data_sources,
                        "canvas": canvas,
                        "token_usage": token_usage,
                        "langfuse_prompt": getattr(
                            self.agent, "default_langfuse_prompt", None
                        ),
                    },
                ),
            )

            if enabled_tools:
                logger.debug(
                    "Enabled tools for this request: %s", ", ".join(enabled_tools)
                )
            graph_stream = self.agent.graph.astream(
                {"messages": msgs},
                stream_mode=["messages", "custom", "updates"],
                config=config,
            )
            try:
                async for item in graph_stream:
                    # item is a tuple of (messages, (message_chunk, meta_data)) or a tool call chunk
                    if not isinstance(item, tuple) or len(item) != 2:
                        logger.error(
                            "Unexpected item format in streaming response: %s", item
                        )
                        continue
                    if isinstance(item, tuple) and item[0] == "messages":
                        _, (message_chunk, metadata) = item
                        metadata = metadata if isinstance(metadata, dict) else {}
                        trace_events.append(
                            _message_chunk_trace_event(message_chunk, metadata)
                        )
                        if _is_internal_chunk(metadata):
                            continue
                        # dont stream summarization chunks
                        if metadata.get("lc_source") == "summarization":
                            continue
                        # only stream assistant model output and no tool chunks
                        if metadata.get("langgraph_node") in {
                            "call_model",
                            "assistant",
                            "model",
                        } and isinstance(message_chunk, AIMessageChunk):
                            chunk_content = message_chunk.content
                            if chunk_content is None:
                                continue
                            if isinstance(chunk_content, str):
                                # Skip only when the chunk is truly empty; spaces need to stream for proper formatting.
                                if chunk_content == "":
                                    continue
                            else:
                                # If content is not a string (e.g., list for multimodal), keep existing behavior and pass through.
                                pass
                            if isinstance(chunk_content, str):
                                answer_chunks.append(chunk_content)
                            yield ChatCompletionChunk(
                                id=id_,
                                object="chat.completion.chunk",
                                created=created,
                                choices=[
                                    ChatCompletionChunkChoice(
                                        delta=ChatCompletionDelta(
                                            content=chunk_content
                                        ),  # type: ignore
                                        index=0,
                                        finish_reason=None,
                                    )
                                ],
                            ).model_dump()
                    elif isinstance(item, tuple) and item[0] == "custom":
                        try:
                            chunk_obj = ToolStreamChunk.model_validate_json(item[1])
                            trace_events.append(
                                {
                                    "stream": "custom",
                                    "type": "ToolStreamChunk",
                                    "content": (
                                        _summarized_canvas_chunk(chunk_obj)
                                        if chunk_obj.tool_name == CANVAS_STREAM_NAME
                                        else _json_safe(chunk_obj)
                                    ),
                                }
                            )
                            yield toolchunk_to_chatcompletionchunk(
                                chunk_obj, id_, created
                            ).model_dump()
                        except Exception:
                            trace_events.append(
                                {
                                    "stream": "custom",
                                    "type": "raw",
                                    "content": _json_safe(item[1]),
                                }
                            )
                            logger.debug(
                                "Non-ToolStreamChunk custom chunk: %s", item[1]
                            )
                    elif isinstance(item, tuple) and item[0] == "updates":
                        trace_events.append(
                            {
                                "stream": "updates",
                                "content": _json_safe(item[1]),
                            }
                        )
                    else:
                        logger.error(
                            "Unexpected item type in streaming response: %s", type(item)
                        )
                        continue
                logger.debug("Streaming completed successfully.")
                _write_stream_trace_span(messages, trace_events)
                get_client().update_current_span(
                    output="".join(answer_chunks),
                    metadata={"agent_stream_event_count": len(trace_events)},
                )
            except Exception as ex:
                _write_stream_trace_span(messages, trace_events)
                logger.error("Streaming error: %s", str(ex), exc_info=True)
                error_payload = llm_error_payload(ex=ex, logger=logger)
                yield ChatCompletionChunk(
                    id=id_,
                    object="chat.completion.chunk",
                    created=created,
                    choices=[
                        ChatCompletionChunkChoice(
                            delta=ChatCompletionDelta(content=""),
                            index=0,
                            finish_reason="error",
                        )
                    ],
                    error=error_payload,
                ).model_dump()
                return
            finally:
                await close_stream(graph_stream)

            logger.debug("Sending end-of-stream signal")
            usage = _usage_from_token_usage(token_usage)
            if usage is None:
                logger.warning("Streaming response completed without token usage.")
            yield ChatCompletionChunk(
                id=id_,
                object="chat.completion.chunk",
                created=created,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionDelta(),  # type: ignore
                        index=0,
                        finish_reason="stop",  # type: ignore
                    )
                ],
                usage=usage,
            ).model_dump()

    @observe(name="Completion", capture_input=False, capture_output=False)
    async def run_without_streaming(
        self,
        messages: list[InputMessage],
        temperature: float,
        model: str | None,
        user_info: AuthenticationResult | None,
        enabled_tools: list[str] | None = None,
        assistant_id: str | None = None,
        data_sources: list[dict[str, Any]] | None = None,
        canvas: CanvasState | None = None,
        conversation_id: str | None = None,
        reasoning_effort: str | None = None,
    ) -> ChatCompletionResponse:
        logger.debug(
            "Chat non-streaming started with temperature %s, model %s",
            temperature,
            model,
        )
        msgs = to_langchain_messages(messages)
        dept_prefix = (
            extract_department_prefix(user_info.department) if user_info else None
        )
        llm_user = dept_prefix
        llm_extra_body = self._build_llm_extra_body(assistant_id)
        tags = (
            [f"assistant-{assistant_id}"]
            if assistant_id is not None
            else ["default-assistant"]
        )
        with propagate_attributes(
            user_id=hash_user_id(user_info.user_id if user_info else None),
            tags=tags,
            session_id=conversation_id,
            trace_name="Completion",
        ):
            token_usage = TokenUsage()
            request_config = RunnableConfig(
                configurable={
                    "thread_id": conversation_id,
                    "llm_temperature": temperature,
                    "reasoning_effort": reasoning_effort,
                    "llm": model,
                    "llm_streaming": False,
                    "enabled_tools": enabled_tools,
                    "agent_state": {"current_scope": "general"},
                    "user_info": user_info,
                    "llm_user": llm_user,
                    "llm_extra_body": llm_extra_body,
                    "assistant_id": assistant_id,
                    "data_sources": data_sources,
                    "canvas": canvas,
                    "token_usage": token_usage,
                    "langfuse_prompt": getattr(
                        self.agent, "default_langfuse_prompt", None
                    ),
                },
            )
            config = merge_configs(self.base_config, request_config)
            try:
                logger.debug("Starting non-streaming response")
                result = await self.agent.graph.ainvoke(
                    {"messages": msgs},
                    config=config,
                )
                ai_message = next(
                    (
                        message
                        for message in reversed(result.get("messages", []))
                        if isinstance(message, AIMessage)
                    ),
                    None,
                )
                if ai_message is None:
                    raise RuntimeError("Agent completed without an assistant message")

                # capture_input/output are disabled on @observe above to avoid
                # duplicating the full resent history; set a lightweight
                # trace-level summary instead so it isn't blank in the UI.
                get_client().update_current_span(
                    input=messages[-1].content if messages else None,
                    output=ai_message.content,
                )
                usage = _usage_from_token_usage(token_usage)
                if usage is None:
                    logger.warning(
                        "Non-streaming response completed without token usage."
                    )
                    usage = Usage(
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                        context_tokens=None,
                    )
                response = ChatCompletionResponse(
                    id=str(uuid.uuid4()),
                    object="chat.completion",
                    created=int(time.time()),
                    choices=[
                        ChatCompletionChoice(
                            message=ChatCompletionMessage(
                                role="assistant",
                                content=ai_message.content,  # type: ignore
                            ),
                            index=0,
                            finish_reason="stop",
                        )
                    ],
                    usage=usage,
                )
                return response
            except Exception as ex:
                logger.error("Non-streaming error: %s", str(ex), exc_info=True)
                error_payload = llm_error_payload(ex=ex, logger=logger)
                return ChatCompletionResponse(
                    id=str(uuid.uuid4()),
                    object="chat.completion",
                    created=int(time.time()),
                    choices=[
                        ChatCompletionChoice(
                            message=ChatCompletionMessage(
                                role="assistant",
                                content="",
                            ),
                            index=0,
                            finish_reason="error",
                        )
                    ],
                    usage=Usage(
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                        context_tokens=None,
                    ),
                    error=error_payload,
                )

    async def get_pending_approvals(
        self, conversation_id: str
    ) -> list[PendingToolApproval]:
        return await self.agent.graph.get_pending_approvals(
            RunnableConfig(configurable={"thread_id": conversation_id})
        )

    ###############################################################################
    ###############################################################################
    async def run_agui_with_streaming(
        self,
        messages: list[InputMessage],
        temperature: float,
        model: str | None,
        user_info: AuthenticationResult,
        conversation_id: str,
        enabled_tools: list[str] | None = None,
        assistant_id: str | None = None,
        data_sources: list[dict[str, Any]] | None = None,
        canvas: CanvasState | None = None,
        reasoning_effort: str | None = None,
        resume: dict[str, Any] | None = None,
        resume_decisions: list[dict[str, str]] | None = None,
        run_id: str | None = None,
        language: str | None = None,
    ) -> AsyncGenerator[BaseEvent]:
        """Run the agent and stream the result as AG-UI protocol events.

        ``run_id``: for native AG-UI requests, the input's ``runId`` echoed on
        the boundary events (spec identity contract); a fresh UUID otherwise.
        ``language``: the user's interface language for the deliberate-default
        response-language instruction. ``resume`` is the generic AG-UI
        interrupt response map; ``resume_decisions`` is MUCGPT's validated
        approval decision payload.
        """
        run_id = run_id or uuid.uuid4().hex
        tags = (
            [f"assistant-{assistant_id}"]
            if assistant_id is not None
            else ["default-assistant"]
        )
        with propagate_attributes(
            user_id=hash_user_id(user_info.user_id),
            tags=tags,
            session_id=conversation_id,
            trace_name="Agent",
        ):
            # Same lightweight trace input as run_with_streaming.
            get_client().update_current_span(
                input=messages[-1].content if messages else None
            )
            answer_chunks: list[str] = []
            trace_events: list[dict[str, Any]] = []
            config = merge_configs(
                self.base_config,
                RunnableConfig(
                    configurable={
                        "thread_id": conversation_id,
                        "llm_temperature": temperature,
                        "reasoning_effort": reasoning_effort,
                        "llm": model,
                        "llm_streaming": True,
                        "enabled_tools": enabled_tools,
                        "agent_state": {"current_scope": "general"},
                        "user_info": user_info,
                        "llm_user": extract_department_prefix(user_info.department),
                        "llm_extra_body": self._build_llm_extra_body(assistant_id),
                        "assistant_id": assistant_id,
                        "data_sources": data_sources,
                        "canvas": canvas,
                        "token_usage": TokenUsage(),
                        "langfuse_prompt": getattr(
                            self.agent, "default_langfuse_prompt", None
                        ),
                        "language": language,
                    },
                ),
            )

            graph_stream = self.agent.graph.astream(
                (
                    Command(resume=resume)
                    if resume is not None
                    else {"messages": to_langchain_messages(messages)}
                ),
                stream_mode=["messages", "custom", "updates"],
                config=config,
                resume_decisions=resume_decisions,
            )
            try:
                yield RunStartedEvent(
                    type=EventType.RUN_STARTED,
                    thread_id=conversation_id,
                    run_id=run_id,
                    # The producer's own declaration, closing the in-band
                    # version negotiation pair with RunAgentInput.protocolVersion.
                    protocol_version=PROTOCOL_VERSION,
                )

                message_id = uuid.uuid4().hex
                tool_calls: dict[int, tuple[str, str]] = {}
                interrupts: tuple[Any, ...] | None = None
                async for stream_mode, data in graph_stream:
                    if stream_mode == "custom":
                        canvas_event: CustomEvent | None = None
                        try:
                            chunk_obj = ToolStreamChunk.model_validate_json(data)
                            is_canvas = chunk_obj.tool_name == CANVAS_STREAM_NAME
                            trace_events.append(
                                {
                                    "stream": "custom",
                                    "type": "ToolStreamChunk",
                                    "content": (
                                        _summarized_canvas_chunk(chunk_obj)
                                        if is_canvas
                                        else _json_safe(chunk_obj)
                                    ),
                                }
                            )
                            # Canvas chunks must reach the frontend as AG-UI
                            # events: the model's own tool-call events
                            # carry the raw tool name, not "Canvas".
                            if is_canvas:
                                canvas_event = CustomEvent(
                                    type=EventType.CUSTOM,
                                    name=CANVAS_STREAM_NAME,
                                    value=chunk_obj.model_dump(),
                                )
                        except Exception:
                            trace_events.append(
                                {
                                    "stream": "custom",
                                    "type": "raw",
                                    "content": _json_safe(data),
                                }
                            )
                        if canvas_event is not None:
                            yield canvas_event
                        continue
                    if stream_mode == "updates":
                        trace_events.append(
                            {"stream": "updates", "content": _json_safe(data)}
                        )
                        # Interrupt/resume groundwork (#1093/#1085): a graph
                        # that hits LangGraph interrupt() ends its run here.
                        if isinstance(data, dict) and "__interrupt__" in data:
                            interrupts = data["__interrupt__"]
                        continue

                    chunk, metadata = data
                    trace_events.append(
                        _message_chunk_trace_event(
                            chunk, metadata if isinstance(metadata, dict) else {}
                        )
                    )
                    # dont stream summarization chunks or internal chunks
                    if metadata.get(
                        "lc_source"
                    ) == "summarization" or _is_internal_chunk(metadata):
                        continue
                    if isinstance(chunk, ToolMessage):
                        content = chunk.content
                        yield ToolCallResultEvent(
                            type=EventType.TOOL_CALL_RESULT,
                            message_id=chunk.id or uuid.uuid4().hex,
                            tool_call_id=chunk.tool_call_id,
                            content=(
                                content
                                if isinstance(content, str)
                                else json.dumps(content)
                            ),
                            role="tool",
                        )
                        continue
                    if not isinstance(chunk, AIMessageChunk):
                        continue

                    if chunk.id:
                        message_id = chunk.id
                    for block in chunk.content_blocks:
                        block_type = block.get("type")
                        if block_type == "text" and (text := block.get("text")):
                            answer_chunks.append(text)
                            yield TextMessageChunkEvent(
                                type=EventType.TEXT_MESSAGE_CHUNK,
                                message_id=message_id,
                                role="assistant",
                                delta=text,
                            )
                        elif block_type in {"tool_call", "tool_call_chunk"}:
                            index = block.get("index", 0)
                            tool_call_id = block.get("id")
                            tool_call_name = block.get("name")
                            if tool_call_id and tool_call_name:
                                tool_calls[index] = (tool_call_id, tool_call_name)
                            elif index in tool_calls:
                                tool_call_id, tool_call_name = tool_calls[index]
                            else:
                                continue

                            args = block.get("args") or ""
                            yield ToolCallChunkEvent(
                                type=EventType.TOOL_CALL_CHUNK,
                                tool_call_id=tool_call_id,
                                tool_call_name=tool_call_name,
                                parent_message_id=message_id,
                                delta=(
                                    args if isinstance(args, str) else json.dumps(args)
                                ),
                            )

                _write_stream_trace_span(messages, trace_events)
                get_client().update_current_span(
                    output="".join(answer_chunks),
                    metadata={"agent_stream_event_count": len(trace_events)},
                )
                token_usage = config["configurable"]["token_usage"]
                if interrupts:
                    get_pending_approvals = getattr(
                        self.agent.graph, "get_pending_approvals", None
                    )
                    pending = (
                        await get_pending_approvals(config)
                        if get_pending_approvals is not None
                        else []
                    )
                    # Spec: a run that ends in an interrupt first emits the
                    # state the consumer needs to resume, then finishes with
                    # an interrupt outcome instead of a success result.
                    async for event in _interrupt_finish_events(
                        self.agent.graph,
                        config,
                        conversation_id,
                        run_id,
                        interrupts,
                        token_usage,
                        model,
                        _interrupt_outcome(pending) if pending else None,
                    ):
                        yield event
                else:
                    yield RunFinishedEvent(
                        type=EventType.RUN_FINISHED,
                        thread_id=conversation_id,
                        run_id=run_id,
                        usage=_ag_ui_usage_from_token_usage(token_usage, model),
                        metadata={
                            "mucgpt": {"contextTokens": token_usage.context_tokens}
                        },
                    )
            except Exception as ex:
                _write_stream_trace_span(messages, trace_events)
                logger.exception("Exception in AG-UI streaming")
                # AG-UI contract: message carries the technical detail,
                # code + metadata carry the structured error for the frontend.
                error_payload = llm_error_payload(ex=ex, logger=logger)
                yield RunErrorEvent(
                    type=EventType.RUN_ERROR,
                    message=error_payload.detail,
                    code=error_payload.code,
                    metadata={"detail": error_payload.detail},
                )
            finally:
                await close_stream(graph_stream)
