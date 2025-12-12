from typing import Annotated, TypedDict

from langchain_core.messages.base import BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools.base import BaseTool
from langgraph.graph import END, START, StateGraph, add_messages
from langgraph.prebuilt import ToolNode

from agent.tools.mcp import McpBearerAuthProvider
from agent.tools.tools import ToolCollection
from core.auth_models import AuthenticationResult
from core.logtools import getLogger


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

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
            messages = self.tool_collection.add_instructions(messages, enabled_tools, tools=tools_to_use)
        if tools_to_use:
            model = model.bind_tools(tools_to_use, parallel_tool_calls=False)
        # invoke model
        response = await model.with_config(config).ainvoke(messages)
        return AgentState(
            messages=messages + [response],
        )

    """Responsible for tool and agent construction only."""
    def __init__(self, llm: RunnableSerializable, tool_collection: ToolCollection, tools: list[BaseTool], logger=None):
        self.model = llm
        self.tool_collection = tool_collection
        self.tools = tools
        self.tool_node = ToolNode(self.tools)
        self.logger = logger if logger else getLogger(name="mucgpt-core-agent")

        # Define the new graph structure
        builder = StateGraph(AgentState)

        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)

        builder.add_edge(START, "call_model")
        builder.add_conditional_edges(
            "call_model", self.should_continue, {"tools": "tools", END: END}
        )
        builder.add_edge("tools", "call_model")

        self.graph = builder.compile()
