from typing import Annotated, NotRequired, cast

from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.agents.middleware.tool_call_limit import ToolCallLimitState
from langchain.agents.middleware.types import AgentState, PrivateStateAttr
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


def tool_run_limit_middleware(tools: list[BaseTool]) -> list[ToolRunLimitMiddleware]:
    return [
        ToolRunLimitMiddleware(tool_name=tool.name, run_limit=limit)
        for tool in tools
        if (limit := (tool.metadata or {}).get("run_limit")) is not None
    ]
