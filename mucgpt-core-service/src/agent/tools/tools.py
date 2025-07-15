import logging

from langchain_core.messages import SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool

from agent.tools.brainstorm import brainstorming
from agent.tools.prompts_fallback import TOOL_INSTRUCTIONS_TEMPLATE
from agent.tools.simplify import simplify
from agent.tools.weather import weather
from core.logtools import getLogger


def make_brainstorm_tool(model: RunnableSerializable, logger: logging.Logger = None):
    @tool(
        "Brainstorming",
        description="Generate a mind map for a given topic in markdown format.",
    )
    def brainstorm_tool(topic: str, context: str = None):
        return brainstorming(topic, context, model, logger)

    return brainstorm_tool


def make_simplify_tool(model: RunnableSerializable, logger: logging.Logger = None):
    @tool(
        "Vereinfachen",
        description="Simplify complex text to A2 level using Leichte Sprache.",
    )
    def simplify_tool(text: str):
        return simplify(text, model, logger)

    return simplify_tool


def make_weather_tool(logger: logging.Logger = None):
    @tool(
        "Wettervorhersage", description="Get the current weather for a given location."
    )
    def weather_tool(location: str):
        return weather(location, logger)

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
