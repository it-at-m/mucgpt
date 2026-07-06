import re

from agent.tools.mcp import McpLoader
from agent.tools.tools import LOCAL_TOOLS
from api.api_models import ToolInfo, ToolListResponse
from config.settings import get_mcp_settings
from core.auth import AuthenticationResult

# Aliases accepted for each supported UI language; anything unrecognized falls
# back to "deutsch" (this app's default language).
_LANG_ALIASES = {
    "english": "english",
    "français": "français",
    "francais": "français",
    "french": "français",
    "bairisch": "bairisch",
    "bavarian": "bairisch",
    "bayerisch": "bairisch",
    "українська": "ukrainisch",
    "ukrainisch": "ukrainisch",
    "ukrainian": "ukrainisch",
}


def _resolve_lang(lang: str) -> str:
    return _LANG_ALIASES.get(lang.lower(), "deutsch")


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


async def list_tool_metadata(
    user_info: AuthenticationResult,
    lang: str = "Deutsch",
    force_reload: bool = False,
) -> ToolListResponse:
    """Return name/description metadata for all tools available to user_info, in the given language.

    Local tools are static (id, name, description, mcp_group all come straight off
    LOCAL_TOOLS - no tool construction needed). MCP tools are dynamic and come from
    McpLoader, same as the tools actually handed to the agent.
    """
    lang_key = _resolve_lang(lang)

    tools_info = [
        ToolInfo(
            id=t.id,
            name=t.display(lang_key)["name"],
            description=t.display(lang_key)["description"],
            mcp_source=None,
            mcp_scope=t.mcp_group,
            mcp_group=t.mcp_group,
        )
        for t in LOCAL_TOOLS
        if t.is_configured()
    ]

    mcp_tools = await McpLoader.load_mcp_tools(
        user_info=user_info, force_reload=force_reload
    )
    mcp_source_keys = set((get_mcp_settings().SOURCES or {}).keys())
    for tool in mcp_tools:
        runtime_metadata = getattr(tool, "metadata", None) or {}
        mcp_group = runtime_metadata.get("mcp_group")
        mcp_source = runtime_metadata.get("mcp_source") or _infer_mcp_source(
            tool_name=tool.name,
            mcp_sources=mcp_source_keys,
        )
        tools_info.append(
            ToolInfo(
                id=tool.name,
                name=tool.name,
                description=tool.description,
                mcp_source=mcp_source,
                mcp_scope=mcp_group,
                mcp_group=mcp_group,
            )
        )

    return ToolListResponse(tools=tools_info)
