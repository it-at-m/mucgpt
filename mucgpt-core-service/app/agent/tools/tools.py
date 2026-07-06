import logging
import re
from typing import cast

from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools.base import BaseTool

from agent.state_models.default_state import DefaultAgentState
from agent.state_models.registry import registry as AGENT_STATE_SCHEMA_REGISTRY
from agent.tools.brainstorm import make_brainstorm_tool
from agent.tools.internet_search import (
    is_internet_search_configured,
    make_internet_search_tool,
)
from agent.tools.mcp import McpLoader
from agent.tools.simplify import make_simplify_tool
from api.api_models import ToolInfo, ToolListResponse
from config.settings import get_mcp_settings
from core.auth import AuthenticationResult
from core.logtools import getLogger

logger = getLogger(name="mucgpt-core-tools-schema")


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
            make_brainstorm_tool(self._bind_model(tool_name="Brainstorming"), self.logger),
            make_simplify_tool(self._bind_model(tool_name="Vereinfachen"), self.logger),
        ] + self._build_configured_tools()

    def _build_configured_tools(self) -> list[BaseTool]:
        tools: list[BaseTool] = []
        if is_internet_search_configured():
            tools.append(make_internet_search_tool(self.logger))
        return tools

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

    @staticmethod
    async def list_tool_metadata(
        user_info: AuthenticationResult,
        lang: str = "Deutsch",
        force_reload: bool = False,
    ) -> ToolListResponse:
        """
        Dynamically returns metadata for all available tools, including their name and description, without requiring a model.
        Args:
            user_info (str): The authenticated user context.
            lang (str, optional): The language for the tool metadata. Defaults to "Deutsch".
        Returns:
            ToolListResponse: An object containing a list of ToolInfo instances, each representing a tool's id, name, and description.
        """

        class DummyModel(RunnableSerializable):
            def with_config(self, *args, **kwargs):
                return self

            def with_structured_output(self, *args, **kwargs):
                return self

            def __init__(self):
                self.__pregel_runtime = {}

            def invoke(self, *args, **kwargs):
                return type("DummyResponse", (), {"content": ""})()

        dummy_logger = getLogger(name="dummy")
        # Define tool metadata with languages as top-level keys
        tool_metadata = {
            "deutsch": {
                "Brainstorming": {
                    "name": "Brainstorming",
                    "description": "Erstellt oder verbessert eine detaillierte Mindmap zu einem Thema im Markdown-Format, basierend auf Nutzer-Feedback.",
                },
                "Vereinfachen": {
                    "name": "Vereinfachen",
                    "description": "Vereinfacht komplexe deutsche Texte auf A2-Niveau nach Prinzipien der Leichten Sprache.",
                },
                "InternetSearch": {
                    "name": "Internetsuche",
                    "description": "Sucht im Internet ueber die konfigurierte SearXNG-Instanz und liefert Quellen mit Titeln, URLs und Textauszuegen.",
                },
            },
            "english": {
                "Brainstorming": {
                    "name": "Brainstorming",
                    "description": "Generates or refines a detailed mind map for a given topic in markdown format based on user feedback.",
                },
                "Vereinfachen": {
                    "name": "Simplify",
                    "description": "Simplifies complex German text to A2 level using Easy Language principles.",
                },
                "InternetSearch": {
                    "name": "Internet Search",
                    "description": "Searches the internet via the configured SearXNG engine and returns sourced titles, URLs and snippets.",
                },
            },
            "français": {
                "Brainstorming": {
                    "name": "Remue-méninges",
                    "description": "Génère ou améliore une carte mentale détaillée pour un sujet donné au format markdown selon les commentaires de l'utilisateur.",
                },
                "Vereinfachen": {
                    "name": "Simplifier",
                    "description": "Simplifie les textes allemands complexes au niveau A2 selon les principes du langage facile.",
                },
            },
            "bairisch": {
                "Brainstorming": {
                    "name": "Brainstorming",
                    "description": "Macht a genaue Mindmap zu am Thema im Markdown-Format oder verbessert eine, wenn da Nutzer Feedback gibt.",
                },
                "Vereinfachen": {
                    "name": "Eifacher machen",
                    "description": "Macht schwere deutsche Text eifacher auf A2-Level mit da Leichten Sprach.",
                },
            },
            "ukrainisch": {
                "Brainstorming": {
                    "name": "Мозковий штурм",
                    "description": "Створює або вдосконалює детальну ментальну карту для заданої теми у форматі markdown на основі відгуків користувачів.",
                },
                "Vereinfachen": {
                    "name": "Спростити",
                    "description": "Спрощує складні німецькі тексти до рівня A2 за принципами простої мови.",
                },
            },
        }

        # Determine language key
        lang_key = "deutsch"
        if lang.lower() == "english":
            lang_key = "english"
        elif lang.lower() in ["français", "francais", "french"]:
            lang_key = "français"
        elif lang.lower() in ["bairisch", "bavarian", "bayerisch"]:
            lang_key = "bairisch"
        elif lang.lower() in ["українська", "ukrainisch", "ukrainian"]:
            lang_key = "ukrainisch"

        # Create tool instances
        brainstorm_tool = make_brainstorm_tool(DummyModel(), dummy_logger)
        simplify_tool = make_simplify_tool(DummyModel(), dummy_logger)
        configured_tools = []
        if is_internet_search_configured():
            configured_tools.append(make_internet_search_tool(dummy_logger))
        mcp_tools = await McpLoader.load_mcp_tools(
            user_info=user_info, force_reload=force_reload
        )

        tools = [brainstorm_tool, simplify_tool] + configured_tools + mcp_tools

        mcp_source_keys = set((get_mcp_settings().SOURCES or {}).keys())

        # Build the list using actual tool names for lookup
        tools_info = []
        for tool in tools:
            tool_name = tool.name
            meta = tool_metadata.get(lang_key, {}).get(tool_name)
            tool_runtime_metadata = getattr(tool, "metadata", None) or {}
            mcp_group = tool_runtime_metadata.get("mcp_group")
            mcp_source = tool_runtime_metadata.get(
                "mcp_source"
            ) or ToolCollection._infer_mcp_source(
                tool_name=tool_name,
                mcp_sources=mcp_source_keys,
            )
            mcp_scope = tool_runtime_metadata.get("mcp_group")
            if meta:
                tools_info.append(
                    ToolInfo(
                        id=tool_name,
                        name=meta.get("name", tool_name),
                        description=meta.get("description", tool.description),
                        mcp_source=mcp_source,
                        mcp_scope=mcp_scope,
                        mcp_group=mcp_group,
                    )
                )
            else:
                # fallback to tool's own name/description
                tools_info.append(
                    ToolInfo(
                        id=tool_name,
                        name=tool_name,
                        description=tool.description,
                        mcp_source=mcp_source,
                        mcp_scope=mcp_scope,
                        mcp_group=mcp_group,
                    )
                )
        return ToolListResponse(tools=tools_info)

    @staticmethod
    def _infer_mcp_source(tool_name: str, mcp_sources: set[str]) -> str | None:
        lowered = tool_name.lower()
        for source in mcp_sources:
            source_lowered = source.lower()
            if lowered == source_lowered:
                return source
            for separator in ("__", ":", ".", "/", "-", "_"):
                if lowered.startswith(f"{source_lowered}{separator}"):
                    return source

        match = re.search(r"(mcp-[a-z0-9][a-z0-9_-]*)", lowered)
        if match:
            return match.group(1)
        return None
