import time
import uuid
from typing import AsyncGenerator, List, Optional

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import merge_configs
from langfuse import Langfuse
from langfuse.langchain import CallbackHandler

from agent.agent import MUCGPTAgent
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
from config.settings import Settings
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-agent")


def _convert_to_langchain_messages(messages: List[InputMessage]) -> List[BaseMessage]:
    """Converts API messages to LangChain message objects."""
    msgs: List[BaseMessage] = []
    for m in messages:
        if m.role == "system":
            msgs.append(SystemMessage(m.content))
        elif m.role == "user":
            msgs.append(HumanMessage(m.content))
        else:
            msgs.append(AIMessage(m.content))
    return msgs


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

    def __init__(self, agent: MUCGPTAgent = None, settings: Settings = None):
        self.logger = logger
        self.agent = agent
        self.langfuse = None
        self.langfuse_handler = None

        if settings is not None:
            if (
                settings.backend.langfuse_host
                and settings.backend.langfuse_secret_key
                and settings.backend.langfuse_public_key
            ):
                try:
                    self.langfuse = Langfuse(
                        public_key=settings.backend.langfuse_public_key,
                        host=settings.backend.langfuse_host,
                        secret_key=settings.backend.langfuse_secret_key,
                        release=settings.version,
                    )
                    self.langfuse.auth_check()
                    self.langfuse_handler = CallbackHandler(
                        public_key=settings.backend.langfuse_public_key
                    )
                except Exception as e:
                    self.logger.error(f"Error initializing Langfuse: {e}")
                    self.langfuse = None
                    self.langfuse_handler = None
        callbacks = [self.langfuse_handler] if self.langfuse_handler else []
        self.base_config: RunnableConfig = RunnableConfig(
            callbacks=callbacks,
            run_name="MUCGPTAgent",
            metadata={
                "langfuse_tags": ["default-bot"],
            },
        )

    async def run_with_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
        enabled_tools: Optional[List[str]] = None,
    ) -> AsyncGenerator[dict, None]:
        logger.info(
            "Chat streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )
        msgs = _convert_to_langchain_messages(messages)
        id_ = str(uuid.uuid4())
        created = int(time.time())
        logger.debug("Stream ID: %s, created: %s", id_, created)
        config = merge_configs(
            self.base_config,
            RunnableConfig(
                configurable={
                    "llm_max_tokens": max_output_tokens,
                    "llm_temperature": temperature,
                    "llm": model,
                    "llm_streaming": True,
                    "enabled_tools": enabled_tools,
                },
            ),
        )
        if enabled_tools:
            logger.debug("Enabled tools for this request: %s", ", ".join(enabled_tools))
        try:
            async for item in self.agent.graph.astream(
                {"messages": msgs}, stream_mode=["messages", "custom"], config=config
            ):
                # item is a tuple of (messages, (message_chunk, meta_data)) or a tool call chunk
                if not isinstance(item, tuple) or len(item) != 2:
                    logger.error(
                        "Unexpected item format in streaming response: %s", item
                    )
                    continue
                if isinstance(item, tuple) and item[0] == "messages":
                    _, (message_chunk, metadata) = item
                    # only stream model call and no tool chunks
                    if metadata["langgraph_node"] == "call_model" and isinstance(
                        message_chunk, AIMessageChunk
                    ):
                        chunk_content = message_chunk.content
                        if not chunk_content or chunk_content.isspace():
                            continue
                        yield ChatCompletionChunk(
                            id=id_,
                            object="chat.completion.chunk",
                            created=created,
                            choices=[
                                ChatCompletionChunkChoice(
                                    delta=ChatCompletionDelta(content=chunk_content),
                                    index=0,
                                    finish_reason=None,
                                )
                            ],
                        ).model_dump()
                elif isinstance(item, tuple) and item[0] == "custom":
                    try:
                        chunk_obj = ToolStreamChunk.model_validate_json(item[1])
                        yield toolchunk_to_chatcompletionchunk(
                            chunk_obj, id_, created
                        ).model_dump()
                    except Exception:
                        logger.debug(
                            "Non-ToolStreamChunk custom chunk: %s", message_chunk
                        )
                else:
                    logger.error(
                        "Unexpected item type in streaming response: %s", type(item)
                    )
                    continue
            logger.debug("Streaming completed successfully.")
        except Exception as ex:
            logger.error("Streaming error: %s", str(ex), exc_info=True)
            error_msg = llm_exception_handler(ex=ex, logger=logger)
            yield ChatCompletionChunk(
                id=id_,
                object="chat.completion.chunk",
                created=created,
                choices=[
                    ChatCompletionChunkChoice(
                        delta=ChatCompletionDelta(content=error_msg),
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
                    delta=ChatCompletionDelta(), index=0, finish_reason="stop"
                )
            ],
        ).model_dump()

    def run_without_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
        enabled_tools: Optional[List[str]] = None,
    ) -> ChatCompletionResponse:
        logger.info(
            "Chat non-streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )
        msgs = _convert_to_langchain_messages(messages)
        request_config = RunnableConfig(
            configurable={
                "llm_max_tokens": max_output_tokens,
                "llm_temperature": temperature,
                "llm": model,
                "llm_streaming": True,
                "enabled_tools": enabled_tools,
            }
        )
        config = merge_configs(self.base_config, request_config)
        try:
            logger.debug("Starting non-streaming response")
            llm = self.agent.model.with_config(configurable=config)
            ai_message = llm.invoke(msgs)
            logger.info("Non-streaming completed successfully.")
            response = ChatCompletionResponse(
                id=str(uuid.uuid4()),
                object="chat.completion",
                created=int(time.time()),
                choices=[
                    ChatCompletionChoice(
                        message=ChatCompletionMessage(
                            role="assistant",
                            content=ai_message.content,
                        ),
                        index=0,
                        finish_reason="stop",
                    )
                ],
                usage=Usage(
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                ),
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
