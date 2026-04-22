


from typing import Any


class DefaultScopePolicy:
    """Default scope policy that does not filter tools."""
    ...

class AtlassianScopePolicy(DefaultScopePolicy):
    """Default scope policy based on assistant context and tool metadata."""

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