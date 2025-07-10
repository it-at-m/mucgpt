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
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

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
from chat.tools import ToolCollection
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-chat")


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


class MUCGPTAgent:
    def should_continue(self, state: MessagesState):
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END

    def call_model(self, state: MessagesState, config: RunnableConfig):
        # TODO bind tools based on config, add tool instructions if needed
        messages = state["messages"]
        response = self.model.with_config(configurable=config).invoke(messages)
        return {"messages": [response]}

    """Responsible for tool and agent construction only."""

    def __init__(
        self, llm: RunnableSerializable, enabled_tools: Optional[List[str]] = None
    ):
        self.model = llm
        self.toolCollection = ToolCollection(model=llm)
        self.tools = self.toolCollection.get_all()
        self.model = self.model.bind_tools(self.tools)
        self.tool_node = ToolNode(self.tools)
        builder = StateGraph(MessagesState)
        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)
        builder.add_edge(START, "call_model")
        builder.add_conditional_edges(
            "call_model", self.should_continue, ["tools", END]
        )
        builder.add_edge("tools", "call_model")
        self.graph = builder.compile()


class MUCGPTAgentRunner:
    """Provides run_with_streaming and run_without_streaming methods using MUCGPTAgent."""

    def __init__(self, agent: MUCGPTAgent):
        self.agent = agent

    async def run_with_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
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
        try:
            logger.debug("Starting streaming response")
            config = {
                "llm_max_tokens": max_output_tokens,
                "llm_temperature": temperature,
                "llm": model,
                "llm_streaming": True,
            }
            async for message_chunk, metadata in self.agent.graph.astream(
                {"messages": msgs}, stream_mode="messages", config=config
            ):
                logger.debug("Streaming message: %r", message_chunk)
                if isinstance(message_chunk, AIMessageChunk):
                    if hasattr(message_chunk, "tool_call_chunks"):
                        if (
                            message_chunk.tool_call_chunks is not None
                            and len(message_chunk.tool_call_chunks) >= 1
                        ):
                            if len(message_chunk.tool_call_chunks) > 1:
                                logger.warning(
                                    f"Multiple tool calls in a single chunk, only the first will be processed. Found calls {len(message_chunk.tool_call_chunks)}"
                                )
                            if message_chunk.tool_call_chunks[0]["name"] is not None:
                                tool_call = message_chunk.tool_call_chunks[0]
                                logger.info(
                                    "Streaming tool start: %s", tool_call["name"]
                                )
                                start_chunk = ChatCompletionChunk(
                                    id=id_,
                                    object="chat.completion.chunk",
                                    created=created,
                                    choices=[
                                        ChatCompletionChunkChoice(
                                            delta=ChatCompletionDelta(
                                                tool_calls=[
                                                    {
                                                        "name": tool_call["name"],
                                                        "args": tool_call["args"],
                                                        "status": "started",
                                                    }
                                                ]
                                            ),
                                            index=0,
                                            finish_reason=None,
                                        )
                                    ],
                                )
                                yield start_chunk.model_dump()
                        # Get the entire content for this chunk
                        chunk_content = message_chunk.content
                        # If the content is empty, skip this chunk
                        if not chunk_content:
                            continue
                        # just stream the content, no tool calls
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
                else:
                    logger.debug(
                        f"Unexpected message type in streaming response: {type(message_chunk)}, expected AIMessage"
                    )
            logger.info("Streaming completed successfully.")
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
    ) -> ChatCompletionResponse:
        logger.info(
            "Chat non-streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )
        msgs = _convert_to_langchain_messages(messages)
        if self.agent.tools:
            msgs = self.agent.tools.add_instructions(msgs, self.agent.tools)
        try:
            logger.debug("Starting non-streaming response")
            config = {
                "llm_max_tokens": max_output_tokens,
                "llm_temperature": temperature,
                "llm": model,
                "llm_streaming": False,
            }
            llm = self.agent.model.with_config(configurable=config)
            if self.agent.tools:
                llm = llm.bind_tools(self.agent.tools)
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
