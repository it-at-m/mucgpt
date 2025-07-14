from typing import List, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from agent.tools import ToolCollection


class MUCGPTAgent:
    def should_continue(self, state: MessagesState):
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END

    def call_model(self, state: MessagesState, config: RunnableConfig):
        # Dynamically enable tools based on config
        messages = state["messages"]
        enabled_tools = config.get("enabled_tools") if config else None
        tools_to_use = (
            self.toolCollection.get_all(enabled_tools) if enabled_tools else []
        )
        # Inject tool instructions if tools are enabled
        if enabled_tools:
            messages = self.toolCollection.add_instructions(messages, enabled_tools)
        model = self.model
        if tools_to_use:
            model = model.bind_tools(tools_to_use)
        response = model.with_config(configurable=config).invoke(messages)
        return {"messages": [response]}

    """Responsible for tool and agent construction only."""

    def __init__(
        self, llm: RunnableSerializable, enabled_tools: Optional[List[str]] = None
    ):
        self.model = llm
        self.toolCollection = ToolCollection(model=llm)
        self.tools = self.toolCollection.get_all()  # Always all tools
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
