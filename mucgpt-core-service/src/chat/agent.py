import time
import uuid
from typing import AsyncGenerator, List, Optional, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, StateGraph
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
from core.logtools import getLogger

from .tools import ChatTools

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
    """Chat with a llm via multiple steps."""

    def __init__(
        self, llm: RunnableSerializable, enabled_tools: Optional[List[str]] = None
    ):
        self.llm = llm
        # Initialize tools helper and tool list
        self.chat_tools = ChatTools(llm)
        all_tools = self.chat_tools.get_tools()

        if enabled_tools is None:
            # Enable all tools by default if no list is provided
            self.tools = all_tools
        else:
            # Filter tools based on the provided list of names
            self.tools = [t for t in all_tools if t.name in enabled_tools]

        # Build separate graphs for streaming and non-streaming
        self.graph = self._build_graph(is_streaming=False)
        self.streaming_graph = self._build_graph(is_streaming=True)

    class ChatState(TypedDict):
        messages: List[BaseMessage]
        temperature: float
        max_output_tokens: int
        model: str
        department: Optional[str]

    def _build_graph(self, is_streaming: bool) -> StateGraph:
        """Construct the LangGraph workflow including tool support."""

        def agent_sync(state: MUCGPTAgent.ChatState) -> dict:
            """Synchronous agent node for non-streaming invocation."""
            messages = state["messages"]
            config = {
                "llm_max_tokens": state["max_output_tokens"],
                "llm_temperature": state["temperature"],
                "llm": state["model"],
            }
            llm = self.llm.with_config(configurable=config)
            if self.tools:
                llm = llm.bind_tools(self.tools)
            try:
                response = llm.invoke(messages)
                return {"messages": [response]}
            except Exception as e:
                err = llm_exception_handler(ex=e, logger=logger)
                return {"messages": [AIMessage(err)]}

        async def agent_async(state: MUCGPTAgent.ChatState) -> dict:
            """Asynchronous agent node that supports streaming."""
            messages = state["messages"]
            config = {
                "llm_max_tokens": state["max_output_tokens"],
                "llm_temperature": state["temperature"],
                "llm": state["model"],
                "llm_streaming": True,  # Important: Enable streaming in the config
            }
            llm = self.llm.with_config(configurable=config)
            if self.tools:
                llm = llm.bind_tools(self.tools)

            try:
                response = await llm.ainvoke(messages)
                return {"messages": [response]}
            except Exception as e:
                err = llm_exception_handler(ex=e, logger=logger)
                return {"messages": [AIMessage(err)]}

        # Build the state graph
        graph = StateGraph(MUCGPTAgent.ChatState)
        agent_node = agent_async if is_streaming else agent_sync
        graph.add_node("agent", agent_node)
        graph.set_entry_point("agent")

        if self.tools:
            graph.add_node("tools", ToolNode(self.tools))
            graph.add_conditional_edges(
                "agent",
                lambda state: "tools"
                if getattr(state["messages"][-1], "tool_calls", None)
                else END,
                {"tools": "tools", END: END},
            )
            graph.add_edge("tools", "agent")
        else:
            graph.add_edge("agent", END)

        return graph.compile()

    async def run_with_streaming(
        self,
        messages: List[InputMessage],
        temperature: float,
        max_output_tokens: int,
        model: str,
        department: Optional[str],
    ) -> AsyncGenerator[dict, None]:
        """Run streaming chat via LangGraph with tool integration."""
        logger.info(
            "Chat streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )

        msgs = _convert_to_langchain_messages(messages)
        if self.tools:
            msgs = self.chat_tools.add_instructions(msgs, self.tools)

        id_ = str(uuid.uuid4())
        created = int(time.time())
        logger.debug("Stream ID: %s, created: %s", id_, created)

        try:
            logger.debug("Starting streaming response")
            # Configure LLM for streaming
            config = {
                "llm_max_tokens": max_output_tokens,
                "llm_temperature": temperature,
                "llm": model,
                "llm_streaming": True,
            }
            llm = self.llm.with_config(configurable=config)

            if self.tools:
                llm = llm.bind_tools(self.tools)

            # Stream directly from the LLM
            tool_calls_detected = False
            async for message in llm.astream(msgs):
                logger.debug("Streaming message: %r", message)
                # Check if this message has tool calls
                if hasattr(message, "tool_calls") and message.tool_calls:
                    tool_calls_detected = True
                    for tool_call in message.tool_calls:
                        # Emit tool start event
                        logger.info("Streaming tool start: %s", tool_call["name"])
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

                        # Execute the tool
                        tool = next(
                            (t for t in self.tools if t.name == tool_call["name"]), None
                        )
                        if tool:
                            try:
                                output = tool.invoke(tool_call["args"])
                                # Emit tool end event
                                logger.info("Streaming tool end: %s", tool_call["name"])
                                end_chunk = ChatCompletionChunk(
                                    id=id_,
                                    object="chat.completion.chunk",
                                    created=created,
                                    choices=[
                                        ChatCompletionChunkChoice(
                                            delta=ChatCompletionDelta(
                                                tool_calls=[
                                                    {
                                                        "name": tool_call["name"],
                                                        "output": output,
                                                        "status": "finished",
                                                    }
                                                ]
                                            ),
                                            index=0,
                                            finish_reason=None,
                                        )
                                    ],
                                )
                                yield end_chunk.model_dump()
                            except Exception as tool_ex:
                                logger.error("Tool execution error: %s", str(tool_ex))
                                # Emit tool error event
                                error_chunk = ChatCompletionChunk(
                                    id=id_,
                                    object="chat.completion.chunk",
                                    created=created,
                                    choices=[
                                        ChatCompletionChunkChoice(
                                            delta=ChatCompletionDelta(
                                                tool_calls=[
                                                    {
                                                        "name": tool_call["name"],
                                                        "output": f"Error: {str(tool_ex)}",
                                                        "status": "error",
                                                    }
                                                ]
                                            ),
                                            index=0,
                                            finish_reason=None,
                                        )
                                    ],
                                )
                                yield error_chunk.model_dump()

                # Stream the content if it exists
                if message.content:
                    chunk = ChatCompletionChunk(
                        id=id_,
                        object="chat.completion.chunk",
                        created=created,
                        choices=[
                            ChatCompletionChunkChoice(
                                delta=ChatCompletionDelta(content=message.content),
                                index=0,
                                finish_reason=None,
                            )
                        ],
                    )
                    yield chunk.model_dump()

            # If we used tools, now stream a final message with the results
            if tool_calls_detected and self.tools:
                # Prepare a new message list with the tool results
                tool_result_msgs = msgs.copy()
                # Add the original LLM response with tool calls
                if hasattr(message, "tool_calls") and message.tool_calls:
                    tool_result_msgs.append(message)

                # Get a final response that incorporates the tool results
                try:
                    final_response = llm.invoke(tool_result_msgs)
                    if final_response.content:
                        final_chunk = ChatCompletionChunk(
                            id=id_,
                            object="chat.completion.chunk",
                            created=created,
                            choices=[
                                ChatCompletionChunkChoice(
                                    delta=ChatCompletionDelta(
                                        content=final_response.content
                                    ),
                                    index=0,
                                    finish_reason=None,
                                )
                            ],
                        )
                        yield final_chunk.model_dump()
                except Exception as ex:
                    logger.error("Final response error: %s", str(ex))

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
        """Run non-streaming chat."""
        logger.info(
            "Chat non-streaming started with temperature %s, model %s, max_tokens %s",
            temperature,
            model,
            max_output_tokens,
        )

        msgs = _convert_to_langchain_messages(messages)
        if self.tools:
            msgs = self.chat_tools.add_instructions(msgs, self.tools)

        try:
            logger.debug("Starting non-streaming response")
            # Configure LLM
            config = {
                "llm_max_tokens": max_output_tokens,
                "llm_temperature": temperature,
                "llm": model,
                "llm_streaming": False,
            }
            llm = self.llm.with_config(configurable=config)

            if self.tools:
                llm = llm.bind_tools(self.tools)

            # Directly invoke the LLM for non-streaming
            ai_message = llm.invoke(msgs)
            logger.info("Non-streaming completed successfully.")

            # Convert AIMessage to ChatCompletionResponse
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
            # Return an error response mimicking the normal response structure
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
