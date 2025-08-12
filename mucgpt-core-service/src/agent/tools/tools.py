import logging

from langchain_core.messages import SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langgraph.config import get_stream_writer

from agent.tools.brainstorm import brainstorming
from agent.tools.simplify import simplify
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from api.api_models import ToolInfo, ToolListResponse
from core.logtools import getLogger

TOOL_INSTRUCTIONS_TEMPLATE = """
You have access to the following tools:
<tools>{tool_descriptions}\n\n</tools>
Follow the guidelines below when using tools:
<guidelines>
- Invoke tools when they are helpful for the user's request.
</guidelines>
"""


def make_brainstorm_tool(model: RunnableSerializable, logger: logging.Logger = None):
    @tool(
        "Brainstorming",
        description="""
Generates a detailed mind map for a given topic in markdown format.
The output uses headings for main ideas and subheadings for related subtopics,
structured as a markdown code block. This helps visualize and organize concepts,
subtopics, and relationships for the specified topic.
""",
    )
    def brainstorm_tool(topic: str, context: str = None):
        writer = get_stream_writer()
        writer(
            ToolStreamChunk(
                state=ToolStreamState.STARTED,
                content=f"Starte Brainstorming für Thema: {topic}",
                tool_name="Brainstorming",
            ).model_dump_json()
        )
        result = brainstorming(topic, context, model, logger, writer)
        writer(
            ToolStreamChunk(
                state=ToolStreamState.ENDED,
                content="Brainstorming abgeschlossen.",
                tool_name="Brainstorming",
            ).model_dump_json()
        )
        return result

    return brainstorm_tool


def make_simplify_tool(model: RunnableSerializable, logger: logging.Logger = None):
    @tool(
        "Vereinfachen",
        description="""Simplifies complex German text to A2 level using Leichte Sprache (Easy Language) principles.

This tool transforms difficult texts into simple, accessible language following strict German accessibility standards.
It uses short sentences (max 15 words), simple vocabulary, active voice, and clear structure with line breaks.

IMPORTANT: Always pass the COMPLETE text that needs to be simplified in a single tool call.
Do NOT split long texts into multiple parts - the tool is designed to handle entire documents at once
and will maintain context and coherence across the full text when simplifying.""",
    )
    def simplify_tool(text: str):
        writer = get_stream_writer()
        result = simplify(text, model, logger, writer=writer)
        return result

    return simplify_tool


class ToolCollection:
    """Collection of chat tools for brainstorming and simplification."""

    def __init__(self, model: RunnableSerializable, logger: logging.Logger = None):
        self.model = model
        self.logger = logger or getLogger(name="mucgpt-core-tools")
        self._brainstorm_tool = make_brainstorm_tool(self.model, self.logger)
        self._simplify_tool = make_simplify_tool(self.model, self.logger)

    @property
    def simplify(self):
        return self._simplify_tool

    @property
    def brainstorm(self):
        return self._brainstorm_tool

    def get_tools(self):
        """Return a list of all tool callables."""
        return [self._brainstorm_tool, self._simplify_tool]

    def get_all(self, enabled_tools: list[str] = None) -> list:
        """Return a list of tools, optionally filtered by enabled_tools."""
        all_tools = [self._brainstorm_tool, self._simplify_tool]
        if enabled_tools:
            return self.filter_tools_by_names(enabled_tools)
        return all_tools

    def filter_tools_by_names(self, tool_names: list[str]) -> list:
        """Return only tools whose name is in tool_names."""
        return [tool for tool in self.get_all() if tool.name in tool_names]

    @staticmethod
    def list_tool_metadata(lang: str = "Deutsch") -> ToolListResponse:
        """
        Dynamically returns metadata for all available tools, including their name and description, without requiring a model.
        Args:
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
                    "description": "Erstellt eine detaillierte Mindmap zu einem Thema im Markdown-Format.",
                },
                "Vereinfachen": {
                    "name": "Vereinfachen",
                    "description": "Vereinfacht komplexe deutsche Texte auf A2-Niveau nach Prinzipien der Leichten Sprache.",
                },
            },
            "english": {
                "Brainstorming": {
                    "name": "Brainstorming",
                    "description": "Generates a detailed mind map for a given topic in markdown format.",
                },
                "Vereinfachen": {
                    "name": "Simplify",
                    "description": "Simplifies complex German text to A2 level using Easy Language principles.",
                },
            },
            "français": {
                "Brainstorming": {
                    "name": "Remue-méninges",
                    "description": "Génère une carte mentale détaillée pour un sujet donné au format markdown.",
                },
                "Vereinfachen": {
                    "name": "Simplifier",
                    "description": "Simplifie les textes allemands complexes au niveau A2 selon les principes du langage facile.",
                },
            },
            "bairisch": {
                "Brainstorming": {
                    "name": "Brainstorming",
                    "description": "Macht a genaue Mindmap zu am Thema im Markdown-Format.",
                },
                "Vereinfachen": {
                    "name": "Eifacher machen",
                    "description": "Macht schwere deutsche Text eifacher auf A2-Level mit da Leichten Sprach.",
                },
            },
            "ukrainisch": {
                "Brainstorming": {
                    "name": "Мозковий штурм",
                    "description": "Створює детальну ментальну карту для заданої теми у форматі markdown.",
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

        # Build the list using actual tool names for lookup
        tools = []
        for tool_id in [brainstorm_tool, simplify_tool]:
            tool_name = tool_id.name
            meta = tool_metadata.get(lang_key, {}).get(tool_name)
            if meta:
                tools.append(
                    ToolInfo(
                        id=tool_name,
                        name=meta.get("name", tool_name),
                        description=meta.get("description", tool_id.description),
                    )
                )
            else:
                # fallback to tool's own name/description
                tools.append(
                    ToolInfo(
                        id=tool_name, name=tool_name, description=tool_id.description
                    )
                )
        return ToolListResponse(tools=tools)

    def add_instructions(self, messages, enabled_tools):
        """Inject a system message describing available tools and XML tag instructions."""
        if not enabled_tools or len(enabled_tools) == 0:
            return messages
        tool_descriptions = []
        for t in enabled_tools:
            if hasattr(t, "name") and hasattr(t, "description"):
                tool_descriptions.append(f"- {t.name}: {t.description}")
            else:
                tool = next((tool for tool in self.get_all() if tool.name == t), None)
                if tool:
                    tool_descriptions.append(f"- {tool.name}: {tool.description}")
        tool_instructions = TOOL_INSTRUCTIONS_TEMPLATE.format(
            tool_descriptions="\n".join(tool_descriptions)
        )
        if messages and isinstance(messages[0], SystemMessage):
            updated = f"{messages[0].content}\n\n{tool_instructions}"
            messages[0] = SystemMessage(content=updated)
        else:
            messages.insert(0, SystemMessage(content=tool_instructions))
        return messages
