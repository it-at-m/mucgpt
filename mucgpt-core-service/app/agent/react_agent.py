import os
from typing import Any, cast

from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import RunnableConfig
from langchain_core.tools.base import BaseTool

from agent.middleware import ContextMiddleware, ToolErrorMiddleware
from agent.state_models.default_state import DefaultAgentState
from agent.tools.mcp import McpBearerAuthProvider
from agent.tools.tools import ToolCollection, select_agent_state_schema
from core.auth_models import AuthenticationResult
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-react-agent")

DEFAULT_INSTRUCTIONS = ""
with open(
    os.path.join(os.path.dirname(__file__), "prompt_pool", "default_instructions.md")
) as fp:
    DEFAULT_INSTRUCTIONS = fp.read()


class _ConfiguredLangChainAgentGraph:
    """Simple wrapper around a LangChain agent to configure it with user info and tools on each run."""

    def __init__(
        self,
        llm: BaseChatModel,
        tool_collection: ToolCollection,
        tools: list[BaseTool],
        logger,
        debug: bool = True,
    ):
        self.model = llm
        self.tool_collection = tool_collection
        self.tools = tools
        self.logger = logger
        self.debug = debug

        logger.debug(
            "Initializing MUCGPT ReAct agent graph with tools: %s",
            [tool.name for tool in tools],
        )
        initial_state_schema = _ConfiguredLangChainAgentGraph.get_schema_from_tools(
            self.tools
        )
        self.agent = create_agent(
            model=cast(Any, self.model),
            tools=self.tools,
            middleware=[
                ContextMiddleware(state_schema=initial_state_schema),
                ToolErrorMiddleware(),
            ],
            system_prompt=DEFAULT_INSTRUCTIONS,
            debug=self.debug,
            state_schema=initial_state_schema,
        )

    @staticmethod
    def get_schema_from_tools(
        enabled_tools: list[BaseTool] | None,
    ) -> type[DefaultAgentState]:
        if not enabled_tools:
            return DefaultAgentState
        return select_agent_state_schema(enabled_tools)

    def _select_tools(self, enabled_tools: list[str] | None) -> list[BaseTool]:
        if not enabled_tools:
            return []
        enabled = set(enabled_tools)
        return [tool for tool in self.tools if tool.name in enabled]

    def _prepare_run(
        self, input_data: dict[str, Any], config: RunnableConfig | None
    ) -> tuple[Any, list[Any], list[BaseTool], type[DefaultAgentState]]:
        configurable = config.get("configurable", {}) if config else {}
        user_info = cast(AuthenticationResult | None, configurable.get("user_info"))
        if not user_info:
            raise ValueError("user_info is required in config for MUCGPTReActAgent")

        llm_user = configurable.get("llm_user")
        extra_body = configurable.get("llm_extra_body")
        enabled_tools = configurable.get("enabled_tools")
        selected_llm = configurable.get("llm")

        # Keep MCP auth token map up-to-date for forwarded auth providers.
        McpBearerAuthProvider.set_token(user_info.user_id, user_info.token)

        model = self.model
        if selected_llm:
            # Select the configured model alternative before adding request-specific bindings.
            model = model.with_config(configurable={"llm": selected_llm})
        if extra_body:
            model = model.bind(extra_body=extra_body)
        if llm_user:
            model = model.bind(user=llm_user)

        messages = input_data.get("messages", [])
        tools_to_use = self._select_tools(enabled_tools)

        # Select agent state schema based on enabled tools (defines agent scope/policy)
        agent_state_schema = _ConfiguredLangChainAgentGraph.get_schema_from_tools(
            tools_to_use
        )
        logger.info(f"Using agent state schema: {agent_state_schema}")
        return model, messages, tools_to_use, agent_state_schema

    async def astream(
        self,
        input_data: dict[str, Any],
        *,
        stream_mode: list[str] | str | None = None,
        config: RunnableConfig | None = None,
        **kwargs,
    ):
        model, messages, tools_to_use, agent_state_schema = self._prepare_run(
            input_data, config
        )
        configurable = config.get("configurable", {}) if config else {}
        data_sources = configurable.get("data_sources", [])

        active_agent = self.agent
        if (
            tools_to_use != self.tools
            or model is not self.model
            or agent_state_schema
            != _ConfiguredLangChainAgentGraph.get_schema_from_tools(self.tools)
            or data_sources
        ):
            active_agent = create_agent(
                model=cast(Any, model),
                tools=tools_to_use,
                middleware=[
                    ContextMiddleware(
                        state_schema=agent_state_schema, data_sources=data_sources
                    ),
                    ToolErrorMiddleware(),
                ],
                system_prompt=DEFAULT_INSTRUCTIONS
                if messages[0].content != DEFAULT_INSTRUCTIONS
                else None,
                debug=self.debug,
                state_schema=agent_state_schema,
            )
        async for item in active_agent.astream(
            {"messages": messages},
            stream_mode=stream_mode,
            config=config,
            **kwargs,
        ):
            yield item

    async def ainvoke(
        self,
        input_data: dict[str, Any],
        *,
        config: RunnableConfig | None = None,
        **kwargs,
    ):
        model, messages, tools_to_use, agent_state_schema = self._prepare_run(
            input_data, config
        )
        configurable = config.get("configurable", {}) if config else {}
        data_sources = configurable.get("data_sources", [])

        active_agent = self.agent
        if (
            tools_to_use != self.tools
            or model is not self.model
            or agent_state_schema
            != _ConfiguredLangChainAgentGraph.get_schema_from_tools(self.tools)
            or data_sources
        ):
            active_agent = create_agent(
                model=cast(Any, model),
                tools=tools_to_use,
                middleware=[
                    ContextMiddleware(
                        state_schema=agent_state_schema, data_sources=data_sources
                    ),
                    ToolErrorMiddleware(),
                ],
                system_prompt=DEFAULT_INSTRUCTIONS
                if messages[0].content != DEFAULT_INSTRUCTIONS
                else None,
                debug=self.debug,
                state_schema=agent_state_schema,
            )
        return await active_agent.ainvoke(
            {"messages": messages}, config=config, **kwargs
        )


class MUCGPTReActAgent:
    """Minimal ReAct agent."""

    def __init__(
        self,
        llm: BaseChatModel,
        tool_collection: ToolCollection,
        tools: list[BaseTool],
        logger=None,
        debug: bool = True,
    ):
        self.logger = logger if logger else getLogger(name="mucgpt-core-react-agent")
        self.model = llm  # required for non-streaming calls, e.g. assisted MUCGPT-Assistant generation.
        self.graph = _ConfiguredLangChainAgentGraph(
            llm=llm,
            tool_collection=tool_collection,
            tools=tools,
            logger=self.logger,
            debug=debug,
        )
