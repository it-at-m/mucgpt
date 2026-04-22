from typing import Any

from langchain.agents.middleware import ModelRequest

DEFAULT_SCOPE = "general"


def _last_assistant_message_text(request: ModelRequest) -> str | None:
    """Return the text of the last AI/assistant message in the request, if any."""
    for message in reversed(request.messages):
        message_type = str(getattr(message, "type", "")).lower()
        if message_type in {"ai", "assistant"}:
            text = getattr(message, "text", None)
            if isinstance(text, str) and text:
                return text
    return None


def _tool_scope(tool: Any) -> str | None:
    """Infer the MCP scope for a tool from its metadata or name."""
    metadata = getattr(tool, "metadata", None)
    if isinstance(metadata, dict):
        scoped = metadata.get("mcp_scope")
        if scoped:
            return str(scoped).lower()

    tool_name = str(getattr(tool, "name", "")).lower()
    if "jira" in tool_name:
        return "jira"
    if "confluence" in tool_name:
        return "confluence"
    return None


class DefaultScopePolicy:
    """Default (no-op) scope policy — passes all tools through unchanged."""

    def infer_scope(self, request: ModelRequest, agent_state: dict[str, Any]) -> str:
        return DEFAULT_SCOPE

    def select_tools(
        self,
        request: ModelRequest,
        scope: str,
        agent_state: dict[str, Any],
    ) -> list[Any]:
        return list(request.tools or [])

    def modify_system_message(self, system_text: str, scope: str) -> str:
        """Return an optionally augmented system prompt.  Default: no change."""
        return system_text


class AtlassianScopePolicy(DefaultScopePolicy):
    """Scope policy that narrows the active tool set to Jira or Confluence based on conversation context."""

    def infer_scope(self, request: ModelRequest, agent_state: dict[str, Any]) -> str:
        scope = str(agent_state.get("current_scope", DEFAULT_SCOPE)).lower()

        last_message = _last_assistant_message_text(request)
        last_chunk = last_message.lower()[-50:] if last_message else ""
        if "confluence" in last_chunk:
            scope = "confluence"
        elif "jira" in last_chunk:
            scope = "jira"

        agent_state["current_scope"] = scope
        return scope

    def select_tools(
        self,
        request: ModelRequest,
        scope: str,
        agent_state: dict[str, Any],
    ) -> list[Any]:
        tools = list(request.tools or [])
        if scope == DEFAULT_SCOPE:
            return tools

        selected: list[Any] = []
        for tool in tools:
            tool_scope = _tool_scope(tool)
            if tool_scope is None:
                # Keep generic tools available for all scopes.
                selected.append(tool)
                continue
            if tool_scope == scope:
                selected.append(tool)

        return selected or tools

    def modify_system_message(self, system_text: str, scope: str) -> str:
        """Append the active MCP scope so the model is aware of the current tool context."""
        if scope == DEFAULT_SCOPE:
            return system_text
        separator = "" if system_text.endswith("\n") else "\n"
        return f"{system_text}{separator}[CONTEXT] Current MCP scope is: {scope}"


# ---------------------------------------------------------------------------
# Registry: maps AgentState *types* → policy instances.
# Import here is deferred to avoid circular imports at module level.
# ---------------------------------------------------------------------------


def _build_policy_registry() -> dict[type, DefaultScopePolicy]:
    from agent.state_models.atlassian_state import AtlassianAgentState  # noqa: PLC0415

    return {
        AtlassianAgentState: AtlassianScopePolicy(),
    }


# Lazily initialised on first access so that the import graph stays clean.
_POLICY_REGISTRY: dict[type, DefaultScopePolicy] | None = None
_DEFAULT_POLICY = DefaultScopePolicy()


def get_policy_for_state(state_type: type) -> DefaultScopePolicy:
    """Return the policy instance registered for *state_type*, falling back to the default."""
    global _POLICY_REGISTRY
    if _POLICY_REGISTRY is None:
        _POLICY_REGISTRY = _build_policy_registry()
    return _POLICY_REGISTRY.get(state_type, _DEFAULT_POLICY)
