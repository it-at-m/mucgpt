import logging

from langchain_core.messages import SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langgraph.config import get_stream_writer

from agent.tools.brainstorm import brainstorming
from agent.tools.prompts_fallback import TOOL_INSTRUCTIONS_TEMPLATE
from agent.tools.simplify import simplify
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState
from agent.tools.weather import weather
from core.logtools import getLogger


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


def make_weather_tool(logger: logging.Logger = None):
    @tool(
        "Wettervorhersage", description="Get the current weather for a given location."
    )
    def weather_tool(location: str):
        writer = get_stream_writer()
        writer(
            ToolStreamChunk(
                state=ToolStreamState.STARTED,
                content=f"Wetterabfrage für: {location} gestartet",
                tool_name="Wettervorhersage",
            ).model_dump_json()
        )
        result = weather(location, logger)
        writer(
            ToolStreamChunk(
                state=ToolStreamState.ENDED,
                content=result,
                tool_name="Wettervorhersage",
            ).model_dump_json()
        )
        return result

    return weather_tool


class ToolCollection:
    """Collection of chat tools for brainstorming and simplification."""

    def __init__(self, model: RunnableSerializable, logger: logging.Logger = None):
        self.model = model
        self.logger = logger or getLogger(name="mucgpt-core-tools")
        self._brainstorm_tool = make_brainstorm_tool(self.model, self.logger)
        self._simplify_tool = make_simplify_tool(self.model, self.logger)
        self._weather_tool = make_weather_tool(self.logger)

    @property
    def simplify(self):
        return self._simplify_tool

    @property
    def brainstorm(self):
        return self._brainstorm_tool

    def get_tools(self):
        """Return a list of all tool callables."""
        return [self._brainstorm_tool, self._simplify_tool, self._weather_tool]

    def get_all(self, enabled_tools: list[str] = None) -> list:
        """Return a list of tools, optionally filtered by enabled_tools."""
        all_tools = [self._brainstorm_tool, self._simplify_tool, self._weather_tool]
        if enabled_tools:
            return self.filter_tools_by_names(enabled_tools)
        return all_tools

    def filter_tools_by_names(self, tool_names: list[str]) -> list:
        """Return only tools whose name is in tool_names."""
        return [tool for tool in self.get_all() if tool.name in tool_names]

    @staticmethod
    def list_tool_metadata():
        """Dynamically return metadata for all available tools (name, description) without requiring a model."""

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
        tools = [
            make_brainstorm_tool(DummyModel(), dummy_logger),
            make_simplify_tool(DummyModel(), dummy_logger),
            make_weather_tool(dummy_logger),
        ]
        return [{"name": t.name, "description": t.description} for t in tools]

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
