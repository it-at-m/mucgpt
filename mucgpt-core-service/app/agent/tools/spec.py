from collections.abc import Callable
from dataclasses import dataclass
from logging import Logger

from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools.base import BaseTool

ToolMetadata = dict[str, dict[str, str]]  # language -> {"name": ..., "description": ...}


@dataclass(frozen=True)
class LocalTool:
    """Self-contained description of a locally-defined (non-MCP) tool.

    To register a new local tool: add a `TOOL = LocalTool(...)` to its module
    and append it to `LOCAL_TOOLS` in tools.py. Nothing else needs to change.
    """

    id: str
    factory: Callable[..., BaseTool]
    metadata: ToolMetadata
    needs_model: bool = True
    is_configured: Callable[[], bool] = lambda: True
    # Mirrors the mcp_group the built tool sets on its own BaseTool.metadata (used
    # by select_agent_state_schema at runtime); repeated here so the /v1/tools
    # listing can report it without constructing the tool.
    mcp_group: str | None = None

    def build(self, model: RunnableSerializable, logger: Logger) -> BaseTool:
        return self.factory(model, logger) if self.needs_model else self.factory(logger)

    def display(self, lang: str) -> dict[str, str]:
        return self.metadata.get(lang) or self.metadata["english"]
