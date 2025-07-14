from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from agent.tools import ToolCollection


class XMLWrappingToolNode(ToolNode):
    def __call__(self, state, config=None):
        result = super().__call__(state, config)
        messages = result.get("messages", [])
        xml_results = []
        for msg in messages:
            tool_call = getattr(msg, "tool_call", None) or msg.get("tool_call")
            if tool_call:
                tool_name = tool_call.get("name") or tool_call.get("tool_name")
                tool_result = tool_call.get("result")
                if tool_name and tool_result:
                    tag = f"mucgpt-{tool_name}"
                    xml_results.append(f"<{tag}>{tool_result}</{tag}>")
        if xml_results:
            xml_string = f"<mucgpt-results>{''.join(xml_results)}</mucgpt-results>"
            # Store the XML string in each tool_call result for downstream use
            for msg in messages:
                tool_call = getattr(msg, "tool_call", None) or msg.get("tool_call")
                if tool_call and "result" in tool_call:
                    tool_call["result"] = xml_string
        return result


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
        # Log model and enabled tools
        if self.logger:
            model_name = getattr(self.model, "model_name", str(self.model))
            self.logger.info(f"MUCGPTAgent: Using model: {model_name}")
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
        self.tool_node = XMLWrappingToolNode(self.tools)
        self.logger = logger
        builder = StateGraph(MessagesState)
        builder.add_node("call_model", self.call_model)
        builder.add_node("tools", self.tool_node)
        builder.add_edge(START, "call_model")
        builder.add_conditional_edges(
            "call_model", self.should_continue, ["tools", END]
        )
        builder.add_edge("tools", "call_model")
        self.graph = builder.compile()
