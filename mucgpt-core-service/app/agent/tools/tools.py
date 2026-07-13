import logging
from typing import cast

from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools.base import BaseTool

from agent.state_models.default_state import DefaultAgentState
from agent.state_models.registry import registry as AGENT_STATE_SCHEMA_REGISTRY
from agent.tools import brainstorm, internet_search, simplify
from agent.tools.mcp import McpLoader
from agent.tools.spec import LocalTool
from core.auth import AuthenticationResult
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-tools-schema")

# Registering a new local tool: add its `TOOL = LocalTool(...)` here.
LOCAL_TOOLS: list[LocalTool] = [brainstorm.TOOL, simplify.TOOL, internet_search.TOOL]


def _metadata_value(metadata, key: str, default=None):
    if isinstance(metadata, dict):
        return metadata.get(key, default)
    return getattr(metadata, key, default)


def select_agent_state_schema(tools: list[BaseTool]) -> type[DefaultAgentState]:
    tool_groups: set[str] = set()
    tool_group_details: list[str] = []

    for tool in tools:
        metadata = getattr(tool, "metadata", None)
        if metadata:
            group = _metadata_value(metadata, "mcp_group", "default") or "default" # if mcp_group has been set to none or empty string, treat it as "default" group
            source = _metadata_value(metadata, "mcp_source", "unknown-source")

            tool_groups.add(group)
            tool_group_details.append(f"{tool.name}:{group} (source={source})")

    if not tool_groups:
        logger.info(
            "Schema decision: DefaultAgentState because no tool groups were found on %d selected tools.",
            len(tools),
        )
        return DefaultAgentState

    if len(tool_groups) > 1:
        logger.warning(
            "Schema decision: DefaultAgentState because multiple mcp_group values were detected: %s. Tool/group mapping: %s",
            sorted(tool_groups),
            ", ".join(tool_group_details),
        )
        return DefaultAgentState

    group = list(tool_groups)[0]
    selected_schema = AGENT_STATE_SCHEMA_REGISTRY.get(group)
    if selected_schema is None:
        logger.info(
            "Schema decision: DefaultAgentState because group '%s' has no registered state schema. Registry keys: %s",
            group,
            sorted(AGENT_STATE_SCHEMA_REGISTRY.keys()),
        )
        return DefaultAgentState

    logger.info(
        "Schema decision: %s because all selected tools resolve to single group '%s'. Tool/group mapping: %s",
        selected_schema.__name__,
        group,
        ", ".join(tool_group_details),
    )
    return selected_schema


class ToolCollection:
    """Collection of chat tools for brainstorming and simplification."""

    def __init__(self, model: RunnableSerializable, logger: logging.Logger = None):
        self.model = model
        self.logger = logger or getLogger(name="mucgpt-core-tools")

    def _bind_model(self, tool_name: str) -> RunnableSerializable:
        """Bind a per-tool Langfuse tag onto the model for tools that call the LLM themselves.

        This used to also bind llm_user/assistant_id, but that data isn't available
        yet at this point: tools are built in init_agent() before AgentExecutor.
        run_with_streaming/run_without_streaming ever compute llm_user/assistant_id
        for the request. See app/agent/tools/README.md for the full story and the
        proper fix.
        """
        return cast(
            RunnableSerializable,
            self.model.bind(
                extra_body={"metadata": {"tags": [f"MUCGPT_TOOL_NAME:{tool_name}"]}}
            ),
        )

    def _build_tools(self) -> list[BaseTool]:
        return [
            t.build(self._bind_model(tool_name=t.id), self.logger)
            for t in LOCAL_TOOLS
            if t.is_configured()
        ]

    async def get_tools(
        self,
        user_info: AuthenticationResult,
        enabled_tools: list[str] = None,
    ) -> list[BaseTool]:
        """Return the tools available for this request, filtered by enabled_tools if given."""
        tools = self._build_tools() + await McpLoader.load_mcp_tools(
            user_info=user_info
        )
        if enabled_tools:
            return [tool for tool in tools if tool.name in enabled_tools]
        return tools
