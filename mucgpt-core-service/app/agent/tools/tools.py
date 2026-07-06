import logging
import os
import re
import uuid
from typing import cast

from httpx import Client, HTTPStatusError
from langchain_core.messages import SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool as langchain_tool
from langchain_core.tools.base import BaseTool

from agent.state_models.default_state import DefaultAgentState
from agent.state_models.registry import registry as AGENT_STATE_SCHEMA_REGISTRY
from agent.tools import brainstorm, internet_search, simplify
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

TOOL_INSTRUCTIONS_TEMPLATE = """
# Tools
## Available tools:
{tool_descriptions}

## General Tool guidelines
- Use as many tool calls as needed to complete the request correctly.
- Never say you will use a tool later. If you decide a tool is needed, call it now.
- If no tool is suitable, answer directly without a tool call.

"""

@langchain_tool("RetrievePMDocs", description="Retrieves relevant project management documents from the configured retrieval backend.")
def retrieve_pm_tools(query: str, max_results: int = 3) -> str:
    """Retrieve relevant project management documents from the configured retrieval backend.

    Sends the query to the retrieval service, requests full results from the configured
    knowledge-base collection, and returns a readable list of matching documents with
    title, source URL, metadata, and page content. Use this tool for questions that
    need grounding in project management documentation.
    Args:
        query: Search query or user question to retrieve supporting documents for.
        limit: Maximum number of retrieved documents to include. Defaults to 3.
    Returns:
        A formatted string containing the retrieved documents, or an explanatory
        message if no matches are found or retrieval fails.
    """
    # using the dlf search backend for document retrieval
    retrieval_endpoint = os.getenv(
        "DLF_RETRIEVAL_API_URL",
        "http://host.docker.internal:8080/api/retrieval",
    )

    payload = {
        "query": query,
        "enhance_query": True,
        "keywords": None,
        "categories": None,
        "run_id": str(uuid.uuid4()),
        "result": "full",  # if the answer tool is used to generate an answer using the dlf answer endpoint, "minimal" would sufficient here
        "collections": ["ki_pm_documents_3072", "LACE_documents_3072", "ProjektPlus_documents_3072"],  # default for dlf
        "category_match": "any",
        "rerank": True,
        "easy_language": False,
    }

    headers = {
        "accept": "application/json",
        "Content-Type": "application/json",
    }
    with Client(timeout=60.0) as client:
        response = client.post(
            url=retrieval_endpoint,
            json=payload,
            headers=headers,
        )

        try:
            response.raise_for_status()
        except HTTPStatusError as e:
            print(f"Retrieval request failed: {e}")
            print(f"Response body: {response.text}")
            raise

        data = response.json()

    n = min(
        4, len(data.get("retrieval_documents", []))
    )  # 10 if len(data.get("retrieval_documents", [])) > 10 else len(data.get("retrieval_documents", []))
    docs = data.get("retrieval_documents", [])[:n]

    # parse to string
    docs_str = "\n\n".join(
        f"Result {i+1}: {doc.get('name', 'Untitled')}\nSource: {doc.get('url', 'unknown source')}\nMetadata: {doc.get('metadata', 'no metadata')}\n{doc.get('page_content', '')}"
        for i, doc in enumerate(docs)
    )

    print(f"tool> Retrieved {len(docs)} documents for query: {query}")
    print(f"tool> Retrieved documents:\n{docs_str[:100]}....")

    return docs_str if docs_str else "No matching documents found."

#####################################################################################################


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

    def _bind_model(
        self,
        llm_user: str | None = None,
        assistant_id: str | None = None,
        tool_name: str | None = None,
    ) -> RunnableSerializable:
        model = self.model
        if llm_user:
            model = model.bind(user=llm_user)
        extra_tags: list[str] = []
        if assistant_id:
            extra_tags.append(f"MUCGPT_ASSISTANT_ID:{assistant_id}")
        if tool_name:
            extra_tags.append(f"MUCGPT_TOOL_NAME:{tool_name}")
        if extra_tags:
            model = model.bind(extra_body={"metadata": {"tags": extra_tags}})
        return cast(RunnableSerializable, model)

    def _build_tools(self, model: RunnableSerializable) -> list[BaseTool]:
        brainstorm_model = self._bind_model(tool_name="Brainstorming")
        simplify_model = self._bind_model(tool_name="Vereinfachen")
        return [
            make_brainstorm_tool(brainstorm_model, self.logger),
            make_simplify_tool(simplify_model, self.logger),
            retrieve_pm_tools, 
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
        llm_user: str | None = None,
        assistant_id: str | None = None,
    ) -> list[BaseTool]:
        """Return available tools, binding model per-request with user and assistant metadata."""
        base_model = self._bind_model(llm_user=llm_user, assistant_id=assistant_id)
        tools = self._build_tools(base_model) + await McpLoader.load_mcp_tools(
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
                "RetrievePMDocs": {
                    "name": "PM-Dokumente suchen",
                    "description": "Sucht relevante Projektmanagement-Dokumente in der konfigurierten Wissensbasis und liefert Quellen mit Metadaten und Inhalten.",
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
                "RetrievePMDocs": {
                    "name": "Search PM Documents",
                    "description": "Searches relevant project management documents in the configured knowledge base and returns sources with metadata and content.",
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

        tools = [brainstorm_tool, simplify_tool, retrieve_pm_tools] + configured_tools + mcp_tools

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

    @staticmethod
    def add_instructions(messages, enabled_tools: list[str], tools: list[BaseTool]):
        """Inject a system message describing available tools with concise summaries and detailed guidance."""
        if not enabled_tools:
            return messages

        # Map tool name to detailed block
        detailed_map = {
            "Brainstorming": brainstorm.BRAINSTORMING_DETAILED,
            "Vereinfachen": simplify.SIMPLIFY_DETAILED,
            "InternetSearch": internet_search.INTERNET_SEARCH_DETAILED,
        }

        tool_descriptions = []  # single-line summaries
        tool_detailed_instructions = []

        for t in enabled_tools:
            tool_obj = next((tool for tool in tools if tool.name == t), None)
            if not tool_obj:
                continue
            summary = tool_obj.description.strip().replace("\n", " ")
            tool_descriptions.append(f"- {tool_obj.name}: {summary}")
            detailed = detailed_map.get(tool_obj.name)
            if detailed:
                tool_detailed_instructions.append(detailed.strip())

        if not tool_descriptions:
            return messages

        tool_instructions = TOOL_INSTRUCTIONS_TEMPLATE.format(
            tool_descriptions="\n".join(tool_descriptions),
        )

        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(
                content=f"{messages[0].content}\n\n{tool_instructions}"
            )
        else:
            messages.insert(0, SystemMessage(content=tool_instructions))
        return messages
