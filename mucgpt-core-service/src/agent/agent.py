from typing import Any, Dict

from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from agent.tools.tools import ToolCollection
from core.logtools import getLogger


class MUCGPTAgent:
    """
    Agent responsible for tool and agent construction, tool invocation, and postprocessing.
    """

    def should_continue(self, state: MessagesState) -> str:
        messages = state["messages"]
        last_message = messages[-1]
        if getattr(last_message, "tool_calls", None):
            return "tools"
        return END

    def call_model(
        self, state: MessagesState, config: RunnableConfig
    ) -> Dict[str, Any]:
        """
        Call the model, dynamically enabling tools based on config.
        """
        messages = state["messages"]
        enabled_tools = config["configurable"].get("enabled_tools") if config else None
        tools_to_use = (
            self.toolCollection.get_all(enabled_tools) if enabled_tools else []
        )
        if self.logger:
            self.logger.info(
                f"MUCGPTAgent: Enabled tools: {enabled_tools if enabled_tools else 'None'}"
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

    def __init__(self, llm: RunnableSerializable, logger=None):
        self.model = llm
        self.toolCollection = ToolCollection(model=llm)
        self.tools = self.toolCollection.get_all()
        self.tool_node = ToolNode(self.tools)
        self.logger = logger if logger else getLogger(name="mucgpt-core-agent")
        builder = StateGraph(MessagesState)
        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)
        builder.add_edge(START, "call_model")
        builder.add_conditional_edges(
            "call_model", self.should_continue, ["tools", END]
        )
        builder.add_edge("tools", "call_model")
        self.graph = builder.compile()
