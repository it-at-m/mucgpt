import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import merge_configs
from langfuse import get_client, observe, propagate_attributes
from langfuse.langchain import CallbackHandler

from agent.deep_agent import MUCGPTAgent
from agent.tools.tool_chunk import ToolStreamChunk
from api.api_models import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionDelta,
    ChatCompletionMessage,
    ChatCompletionResponse,
    Usage,
)
from api.api_models import ChatCompletionMessage as InputMessage
from api.exception import llm_exception_handler
from config.langfuse_provider import LangfuseProvider
from core.auth_models import AuthenticationResult
from core.llm_helpers import (
    extract_department_prefix,
    hash_user_id,
    to_langchain_messages,
)
from core.logtools import getLogger

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


def _usage_from_metadata(usage_metadata: dict[str, Any] | None) -> Usage | None:
    """Map LangChain's usage_metadata (input_tokens/output_tokens/total_tokens) to our Usage schema."""
    if not usage_metadata:
        return None
    prompt_tokens = usage_metadata.get("input_tokens") or usage_metadata.get(
        "prompt_tokens", 0
    )
    completion_tokens = usage_metadata.get("output_tokens") or usage_metadata.get(
        "completion_tokens", 0
    )
    total_tokens = (
        usage_metadata.get("total_tokens") or prompt_tokens + completion_tokens
    )
    return Usage(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
    )


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
        id=id_, object="chat.completion.chunk", created=created, choices=[choice]
    )


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

    @observe(name="Agent", capture_input=False, capture_output=False)
    async def run_with_streaming(
        self,
        messages: list[InputMessage],
        temperature: float,
        model: str | None,
        user_info: AuthenticationResult | None,
        enabled_tools: list[str] | None = None,
        assistant_id: str | None = None,
        data_sources: list[dict[str, Any]] | None = None,
        conversation_id: str | None = None,
    ) -> AsyncGenerator[dict]:
        logger.info(
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
        ):
            # capture_input/output are disabled on @observe above to avoid
            # duplicating the full resent history; set a lightweight
            # trace-level summary instead so it isn't blank in the UI.
            get_client().update_current_span(
                input=messages[-1].content if messages else None
            )
            answer_chunks: list[str] = []
            trace_events: list[dict[str, Any]] = []
            last_usage_metadata: dict[str, Any] | None = None
            config = merge_configs(
                self.base_config,
                RunnableConfig(
                    configurable={
                        "llm_temperature": temperature,
                        "llm": model,
                        "llm_streaming": True,
                        "enabled_tools": enabled_tools,
                        "agent_state": {"current_scope": "general"},
                        "user_info": user_info,
                        "llm_user": llm_user,
                        "llm_extra_body": llm_extra_body,
                        "assistant_id": assistant_id,
                        "data_sources": data_sources,
                    },
                ),
            )

            if enabled_tools:
                logger.debug(
                    "Enabled tools for this request: %s", ", ".join(enabled_tools)
                )
            try:
                async for item in self.agent.graph.astream(
                    {"messages": msgs},
                    stream_mode=["messages", "custom", "updates"],
                    config=config,
                ):
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
                            chunk_usage = getattr(
                                message_chunk, "usage_metadata", None
                            )
                            if chunk_usage:
                                last_usage_metadata = chunk_usage
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
                                    "content": _json_safe(chunk_obj),
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
                error_msg = llm_exception_handler(ex=ex, logger=logger)
                yield ChatCompletionChunk(
                    id=id_,
                    object="chat.completion.chunk",
                    created=created,
                    choices=[
                        ChatCompletionChunkChoice(
                            delta=ChatCompletionDelta(content=error_msg),  # type: ignore
                            index=0,
                            finish_reason="error",
                        )
                    ],
                ).model_dump()
                return

            logger.debug("Sending end-of-stream signal")
            yield ChatCompletionChunk(
                id=id_,
                object="chat.completion.chunk",
                created=created,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionDelta(),
                        index=0,
                        finish_reason="stop",  # type: ignore
                    )
                ],
                usage=_usage_from_metadata(last_usage_metadata),
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
        conversation_id: str | None = None,
    ) -> ChatCompletionResponse:
        logger.info(
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
        ):
            request_config = RunnableConfig(
                configurable={
                    "llm_temperature": temperature,
                    "llm": model,
                    "llm_streaming": False,
                    "enabled_tools": enabled_tools,
                    "agent_state": {"current_scope": "general"},
                    "user_info": user_info,
                    "llm_user": llm_user,
                    "llm_extra_body": llm_extra_body,
                    "assistant_id": assistant_id,
                    "data_sources": data_sources,
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
                logger.info("Non-streaming completed successfully.")
                # capture_input/output are disabled on @observe above to avoid
                # duplicating the full resent history; set a lightweight
                # trace-level summary instead so it isn't blank in the UI.
                get_client().update_current_span(
                    input=messages[-1].content if messages else None,
                    output=ai_message.content,
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
                    usage=_usage_from_metadata(
                        getattr(ai_message, "usage_metadata", None)
                    )
                    or Usage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
                )
                return response
            except Exception as ex:
                logger.error("Non-streaming error: %s", str(ex), exc_info=True)
                error_msg = llm_exception_handler(ex=ex, logger=logger)
                return ChatCompletionResponse(
                    id=str(uuid.uuid4()),
                    object="chat.completion",
                    created=int(time.time()),
                    choices=[
                        ChatCompletionChoice(
                            message=ChatCompletionMessage(
                                role="assistant",
                                content=error_msg,
                            ),
                            index=0,
                            finish_reason="error",
                        )
                    ],
                    usage=Usage(
                        prompt_tokens=0,
                        completion_tokens=0,
                        total_tokens=0,
                    ),
                )
