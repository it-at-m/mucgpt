from typing import Annotated, Any, TypedDict
from xml.sax.saxutils import escape

from langchain_core.messages import SystemMessage
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

    @staticmethod
    def _build_data_sources_xml(data_sources: list[Any]) -> str:
        document_blocks: list[str] = []

        for idx, source in enumerate(data_sources, start=1):
            if isinstance(source, str):
                title = f"Document {idx}"
                content = source
                metadata_map: dict[str, str] = {}
            elif isinstance(source, dict):
                title = str(source.get("title") or f"Document {idx}")
                content = str(source.get("content") or "")
                raw_metadata = source.get("metadata") or {}
                metadata_map = {}
                if isinstance(raw_metadata, dict):
                    metadata_map = {
                        str(k): str(v)
                        for k, v in raw_metadata.items()
                        if v is not None and str(v).strip()
                    }
            else:
                continue

            if not content.strip():
                continue

            metadata_xml = ""
            if metadata_map:
                meta_lines = [
                    f'      <meta key="{escape(key)}">{escape(value)}</meta>'
                    for key, value in metadata_map.items()
                ]
                metadata_xml = (
                    "\n    <metadata>\n" + "\n".join(meta_lines) + "\n    </metadata>"
                )

            document_blocks.append(
                "\n".join(
                    [
                        f'  <document index="{idx}">',
                        f"    <title>{escape(title)}</title>",
                        *([] if not metadata_xml else [metadata_xml]),
                        f"    <content>{escape(content)}</content>",
                        "  </document>",
                    ]
                )
            )

        if not document_blocks:
            return ""

        return "<data-sources>\n" + "\n".join(document_blocks) + "\n</data-sources>"

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
        configurable = config.get("configurable", {}) if config else {}
        user_info: AuthenticationResult = configurable.get("user_info")
        if not user_info:
            raise ValueError(
                "user_info is required in config for MUCGPTAgent.call_model"
            )
        llm_user = configurable.get("llm_user")
        extra_body = configurable.get("llm_extra_body")
        assistant_id = configurable.get("assistant_id")

        # update mcp OAuth token
        McpBearerAuthProvider.set_token(user_info.user_id, user_info.token)

        # load tools
        enabled_tools = configurable.get("enabled_tools") if config else None
        tools_to_use: list[BaseTool] = (
            await self.tool_collection.get_tools(
                enabled_tools=enabled_tools,
                user_info=user_info,
                llm_user=llm_user,
                assistant_id=assistant_id,
            )
            if enabled_tools
            else []
        )
        if self.logger:
            self.logger.info(
                f"MUCGPTAgent: Enabled tools: {enabled_tools if enabled_tools else 'None'}"
            )

        # attach request-scoped extras (e.g., LiteLLM metadata tags)
        if extra_body:
            model = model.bind(extra_body=extra_body)
        # attach request user (e.g., department identifier)
        if llm_user:
            model = model.bind(user=llm_user)

        # inject tool instructions into system message
        if enabled_tools:
            messages = self.tool_collection.add_instructions(
                messages, enabled_tools, tools=tools_to_use
            )
        if tools_to_use:
            model = model.bind_tools(tools_to_use, parallel_tool_calls=False)

        # inject selected data sources directly into messages as XML
        data_sources = (
            config.get("configurable", {}).get("data_sources") if config else None
        )

        if data_sources:
            self.logger.info(
                f"Injecting {len(data_sources)} data source(s) into request context"
            )
            data_sources_xml = self._build_data_sources_xml(data_sources)
            if data_sources_xml:
                data_string = (
                    "Use the following selected data-sources to answer the request when relevant.\n"
                    f"{data_sources_xml}"
                )
                if messages and isinstance(messages[0], SystemMessage):
                    messages[0] = SystemMessage(
                        content=f"{messages[0].content}\n\n{data_string}"
                    )
                else:
                    messages.insert(0, SystemMessage(content=data_string))

        # invoke model
        response = await model.with_config(config).ainvoke(messages)
        return AgentState(
            messages=messages + [response],
        )

    """Responsible for tool and agent construction only."""

    def __init__(
        self,
        llm: RunnableSerializable,
        tool_collection: ToolCollection,
        tools: list[BaseTool],
        logger=None,
    ):
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
