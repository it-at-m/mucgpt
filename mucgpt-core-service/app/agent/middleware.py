from collections.abc import Awaitable, Callable

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    ModelResponse,
    ToolCallRequest,
)
from langchain.messages import ToolMessage
from langgraph.types import Command

from agent.state_models.default_state import DefaultAgentState
from agent.tools.policies import get_policy_for_state
from core.logtools import getLogger

logger = getLogger(name="agent-middleware")

# TODO:
# - Ensure the frontend is stateful and can send the current scope in the request
class ContextMiddleware(AgentMiddleware):
    """Adjust model calls based on agent state and its associated policy.

    The policy is resolved from the state type via the policy registry:
    - ``DefaultAgentState``   → ``DefaultScopePolicy`` (no-op, all tools forwarded)
    - ``AtlassianAgentState`` → ``AtlassianScopePolicy`` (scope-aware tool filtering)

    Additional state types can be registered in ``agent.tools.policies``.
    """

    state_schema: type = DefaultAgentState

    def __init__(self, state_schema: type = DefaultAgentState):
        self.state_schema = state_schema

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        # infer policy from state type and apply to request
        policy = get_policy_for_state(self.state_schema)

        request = policy.infer_scope(request)
        request = request.override(
            tools=policy.select_tools(request)
        )
        logger.info(f"selected Tools: {len(request.tools or [])}")
        request = policy.modify_system_message(request)

        return handler(request)

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        # infer policy from state type and apply to request
        policy = get_policy_for_state(self.state_schema)

        request = await policy.ainfer_scope(request)
        request = request.override(
            tools=policy.select_tools(request),
        )
        logger.info(f"selected Tools: {len(request.tools or [])}")
        request = await policy.amodify_system_message(request)

        return await handler(request)


class ToolErrorMiddleware(AgentMiddleware):
    """Convert tool exceptions into tool messages for both sync and async execution."""

    def wrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], ToolMessage | Command],
    ) -> ToolMessage | Command:
        try:
            return handler(request)
        except Exception as exc:
            logger.exception(
                "Exception during tool call '%s'", request.tool_call["name"]
            )
            return ToolMessage(
                content=f"Tool execution failed: {exc}",
                tool_call_id=request.tool_call["id"],
            )

    async def awrap_tool_call(
        self,
        request: ToolCallRequest,
        handler: Callable[[ToolCallRequest], Awaitable[ToolMessage | Command]],
    ) -> ToolMessage | Command:
        try:
            return await handler(request)
        except Exception as exc:
            logger.exception(
                "Exception during tool call '%s'", request.tool_call["name"]
            )
            return ToolMessage(
                content=f"Tool execution failed: {exc}",
                tool_call_id=request.tool_call["id"],
            )
