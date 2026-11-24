from collections.abc import Mapping
from typing import Annotated, Any, NotRequired, cast

from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.agents.middleware.tool_call_limit import ToolCallLimitState
from langchain.agents.middleware.types import AgentState, PrivateStateAttr
from langchain.tools.tool_node import ToolCallRequest
from langchain_core.messages import AIMessage, ToolCall
from langchain_core.tools import BaseTool


class ToolRunLimitState(AgentState):
    thread_tool_call_count: NotRequired[Annotated[dict[str, int], PrivateStateAttr]]
    run_tool_call_count: NotRequired[Annotated[dict[str, int], PrivateStateAttr]]


class ToolRunLimitMiddleware(ToolCallLimitMiddleware):
    """Use LangChain's limiter with a budget that survives approval pauses."""

    # Same fields as LangChain's schema, with the run counter checkpointed.
    state_schema = cast(type[ToolCallLimitState], ToolRunLimitState)

    def before_agent(self, state, runtime):
        # This entry hook runs for a new turn, but is skipped on Command(resume=...).
        return {"run_tool_call_count": {}}

    async def abefore_agent(self, state, runtime):
        return self.before_agent(state, runtime)

    def within_budget(self, request: ToolCallRequest) -> bool:
        """Approval predicate: interrupt only for calls this limiter lets through.

        Approval interrupts run before this limiter's after_model hook, so
        without it the user would approve calls that are then blocked.
        """
        return self.allows(request.state, request.tool_call)

    def allows(self, state: Mapping[str, Any], tool_call: ToolCall) -> bool:
        """Mirror after_model's decision for one call of the latest AI message."""
        last_ai_message = next(
            (m for m in reversed(state["messages"]) if isinstance(m, AIMessage)),
            None,
        )
        if last_ai_message is None:
            return True
        count_key = self.tool_name or "__all__"
        _allowed, blocked, _thread, _run = self._separate_tool_calls(
            last_ai_message.tool_calls,
            state.get("thread_tool_call_count", {}).get(count_key, 0),
            state.get("run_tool_call_count", {}).get(count_key, 0),
        )
        return tool_call["id"] not in {call["id"] for call in blocked}


def tool_run_limit_middleware(
    tools: list[BaseTool],
) -> dict[str, ToolRunLimitMiddleware]:
    # One limiter per name: duplicate middleware names fail agent creation, so
    # tools sharing a name (e.g. from two MCP sources) share the strictest limit.
    limits: dict[str, int] = {}
    for tool in tools:
        if (limit := (tool.metadata or {}).get("run_limit")) is not None:
            limits[tool.name] = min(limit, limits.get(tool.name, limit))
    return {
        name: ToolRunLimitMiddleware(tool_name=name, run_limit=limit)
        for name, limit in limits.items()
    }
