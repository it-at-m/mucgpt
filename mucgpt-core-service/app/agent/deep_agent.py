import os
from typing import Any, cast

from deepagents import create_deep_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import RunnableConfig
from langchain_core.runnables.config import merge_configs
from langchain_core.tools.base import BaseTool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from agent.middleware import (
    ContextMiddleware,
    RequestContext,
    TokenUsage,
    TokenUsageMiddleware,
    ToolErrorMiddleware,
)
from agent.state_models.default_state import DefaultAgentState
from agent.tools.mcp import McpBearerAuthProvider
from core.auth_models import AuthenticationResult
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-react-agent")

DEFAULT_INSTRUCTIONS = ""
with open(
    os.path.join(os.path.dirname(__file__), "prompt_pool", "default_instructions.md")
) as fp:
    DEFAULT_INSTRUCTIONS = fp.read()


class _ConfiguredLangChainDeepAgentGraph:
    """Simple wrapper around a LangChain agent to configure it with user info and tools on each run."""

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[BaseTool],
        logger,
        debug: bool = True,
        checkpointer: AsyncPostgresSaver | None = None,
    ):
        self.model = llm
        self.tools = tools
        self.logger = logger
        self.debug = debug

        # After PR #1177 the agent graph is not compiled per request anymore.
        # dynamically selecting the state schema based on the tools is not supported anymore --> defautling to DefaultAgentState for now.
        self.state_schema = DefaultAgentState
        self.agent = create_deep_agent(
            model=cast(Any, self.model),
            tools=self.tools,
            middleware=[
                ContextMiddleware(state_schema=self.state_schema),
                ToolErrorMiddleware(),
                TokenUsageMiddleware(),
            ],  # type: ignore
            system_prompt=DEFAULT_INSTRUCTIONS,
            debug=self.debug,
            state_schema=self.state_schema,
            context_schema=RequestContext,
            checkpointer=checkpointer,
        )

    def _prepare_run(
        self, input_data: dict[str, Any], config: RunnableConfig | None
    ) -> tuple[
        list[Any],
        list[dict[str, Any]] | None,
        RequestContext,
    ]:
        configurable = config.get("configurable", {}) if config else {}
        user_info = cast(AuthenticationResult | None, configurable.get("user_info"))
        if not user_info:
            raise ValueError("user_info is required in config for MUCGPTAgent")

        llm_user = configurable.get("llm_user")
        extra_body = configurable.get("llm_extra_body")
        enabled_tools = configurable.get("enabled_tools")
        selected_llm = configurable.get("llm")
        assistant_id = configurable.get("assistant_id")
        token_usage = configurable.get("token_usage")

        # Keep MCP auth token map up-to-date for forwarded auth providers.
        McpBearerAuthProvider.set_token(user_info.user_id, user_info.token)

        messages = input_data.get("messages", [])
        data_sources = configurable.get("data_sources", [])

        request_context = RequestContext(
            assistant_id=str(assistant_id) if assistant_id else None,
            model_name=selected_llm,
            user=llm_user,
            temperature=configurable.get("llm_temperature", RequestContext.temperature),
            stream=configurable.get("llm_streaming", False),
            extra_body=extra_body,
            enabled_tools=enabled_tools,
            token_usage=token_usage if isinstance(token_usage, TokenUsage) else None,
        )

        return messages, data_sources, request_context

    async def astream(
        self,
        input_data: dict[str, Any],
        *,
        stream_mode: list[str] | str | None = None,
        config: RunnableConfig | None = None,
        **kwargs,
    ):
        messages, data_sources, request_context = self._prepare_run(input_data, config)

        # Keep the stable graph schema visible in trace metadata without
        # mutating the caller's config dict.
        config = merge_configs(
            config or {},
            RunnableConfig(metadata={"agent_state_schema": self.state_schema.__name__}),
        )

        input_payload = {"messages": messages}
        if data_sources:
            input_payload["data_sources"] = data_sources  # type: ignore

        async for item in self.agent.astream(
            input_payload,
            stream_mode=stream_mode,
            config=config,
            context=request_context,
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
        messages, data_sources, request_context = self._prepare_run(input_data, config)

        # Merge agent_state_schema into trace metadata.
        config = merge_configs(
            config or {},
            RunnableConfig(metadata={"agent_state_schema": self.state_schema.__name__}),
        )

        input_payload = {"messages": messages}
        if data_sources:
            input_payload["data_sources"] = data_sources  # type: ignore

        return await self.agent.ainvoke(
            input_payload, config=config, context=request_context, **kwargs
        )


class MUCGPTAgent:
    """MUCGPT Deep Agent."""

    def __init__(
        self,
        llm: BaseChatModel,
        tools: list[BaseTool],
        logger=None,
        debug: bool = True,
        checkpointer: AsyncPostgresSaver | None = None,
    ):
        self.logger = logger if logger else getLogger(name="mucgpt-core-react-agent")
        self.model = llm  # required for non-streaming calls, e.g. assisted MUCGPT-Assistant generation.
        self.graph = _ConfiguredLangChainDeepAgentGraph(
            llm=llm,
            tools=tools,
            logger=self.logger,
            debug=debug,
            checkpointer=checkpointer,
        )
