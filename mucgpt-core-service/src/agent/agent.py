from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.messages.base import BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph, add_messages
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field

from agent.tools.mcp import McpBearerAuthProvider
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from agent.tools.tools import ToolCollection
from core.auth_models import AuthenticationResult
from core.logtools import getLogger


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    is_valid: bool


class ValidationResult(BaseModel):
    """Represents the outcome of a tool output validation."""

    is_valid: bool = Field(
        description="Whether the tool output is valid and sufficient to answer the user's query."
    )
    reason: str = Field(
        description="The reason why the tool output was deemed invalid. Provide guidance for the next attempt.",
        default=None,
    )


class MUCGPTAgent:
    """
    Agent responsible for tool and agent construction, tool invocation, and postprocessing.
    """

    def should_continue(self, state: AgentState) -> str:
        messages = state["messages"]
        last_message = messages[-1]
        if getattr(last_message, "tool_calls", None):
            return "tools"
        return END

    def validate_results(self, state: AgentState) -> AgentState:
        """
        New node to validate the output of the tool call using a structured output model.
        """
        writer = get_stream_writer()
        tool_output_message = state["messages"][-1]
        # The user's request is typically the first human message
        user_request = next(
            (msg.content for msg in state["messages"] if isinstance(msg, HumanMessage)),
            None,
        )
        if not user_request:
            # Fallback if no human message is found
            return AgentState(
                is_valid=False, messages=state["messages"]
            )  # Prepare messages for the validation prompt
        validation_messages = [
            SystemMessage(
                content="You are a helpful assistant that validates the output of a tool call based on the user's original request. "
                "Determine if the tool output is sufficient and correct to answer the request. "
                "Respond with a JSON object according to the `ValidationResult` schema."
            )
        ]

        # Include chat history (excluding system messages
        for msg in state["messages"]:
            if not isinstance(msg, SystemMessage):  # Skip system messages
                validation_messages.append(msg)

        # Add the final validation question
        validation_messages.append(
            HumanMessage(
                content="Is the previous tool output sufficient and correct to answer my request?"
            )
        )

        validation_result: ValidationResult = self.validation_model.invoke(
            validation_messages
        )

        if validation_result.is_valid:
            return AgentState(is_valid=True, messages=state["messages"])
        else:
            self.logger.warning(
                f"Tool call failed validation. Reason: {validation_result.reason}"
            )
            # Signal rollback to the frontend
            if writer:
                writer(
                    ToolStreamChunk(
                        state=ToolStreamState.ROLLBACK,
                        content=f"Tool-Ausführung fehlgeschlagen: {validation_result.reason}",
                        tool_name=tool_output_message.name
                        if hasattr(tool_output_message, "name")
                        else "unknown_tool",
                    ).model_dump_json()
                )
            # Add a message to guide the model's next attempt
            error_message = AIMessage(
                content=f"Die Tool-Ausführung war fehlerhaft. Grund: {validation_result.reason}. Bitte versuche es mit anderen Parametern oder einem anderen Ansatz erneut."
            )
            return AgentState(
                is_valid=False, messages=state["messages"] + [error_message]
            )

    async def call_model(self, state: AgentState, config: RunnableConfig) -> AgentState:
        """
        Call the model, dynamically enabling tools based on config.
        """
        messages = state["messages"]
        model = self.model
        user_info : AuthenticationResult = config["configurable"].get("user_info")
        # update mcp OAuth token
        McpBearerAuthProvider.set_token(user_info.user_id, user_info.token)
        # load tools
        enabled_tools = config["configurable"].get("enabled_tools") if config else None
        tools_to_use : list[BaseTool] = (
            await self.tool_collection.get_tools(enabled_tools=enabled_tools, user_info=user_info) if enabled_tools else []
        )
        if self.logger:
            self.logger.info(
                f"MUCGPTAgent: Enabled tools: {enabled_tools if enabled_tools else 'None'}"
            )
        # inject tool instructions into system message
        if enabled_tools:
            messages = self.tool_collection.add_instructions(messages, enabled_tools, tools=self.tools)
        if tools_to_use:
            model = model.bind_tools(tools_to_use, parallel_tool_calls=False)
        # invoke model
        response = await model.with_config(config).ainvoke(messages)
        return AgentState(
            messages=messages + [response],
            is_valid=True,
        )

    """Responsible for tool and agent construction only."""
    def __init__(self, llm: RunnableSerializable, tool_collection: ToolCollection, tools: list[BaseTool], logger=None):
        self.model = llm
        self.validation_model = llm.with_structured_output(ValidationResult)
        self.tool_collection = tool_collection
        self.tools = tools
        self.tool_node = ToolNode(self.tools)
        self.logger = logger if logger else getLogger(name="mucgpt-core-agent")

        # Define the new graph structure
        builder = StateGraph(AgentState)

        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)
        builder.add_node("validate_results", self.validate_results)

        builder.add_edge(START, "call_model")
        builder.add_conditional_edges(
            "call_model", self.should_continue, {"tools": "tools", END: END}
        )
        builder.add_edge("tools", "validate_results")
        builder.add_edge("validate_results", "call_model")

        self.graph = builder.compile()
