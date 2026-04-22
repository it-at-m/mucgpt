from collections.abc import Awaitable, Callable
from typing import Any

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    ModelResponse,
    ToolCallRequest,
)
from langchain.messages import SystemMessage, ToolMessage
from langgraph.types import Command

from agent.state_models.default_state import DefaultAgentState
from agent.tools.policies import DEFAULT_SCOPE, get_policy_for_state
from core.logtools import getLogger

logger = getLogger(name="agent-middleware")

AGENT_STATE_KEY = "agent_state"

# TODO:
# - for future: consider more advanced policy implementations, e.g. using a separate LLM for policy decisions, i.e. a router


def _get_or_create_agent_state(request: ModelRequest) -> dict[str, Any]:
    runtime = getattr(request, "runtime", None)
    context = getattr(runtime, "context", None)

    if isinstance(context, dict):
        configurable = context.get("configurable")
        if isinstance(configurable, dict):
            state = configurable.get(AGENT_STATE_KEY)
            if isinstance(state, dict):
                state.setdefault("current_scope", DEFAULT_SCOPE)
                return state
            configurable[AGENT_STATE_KEY] = {"current_scope": DEFAULT_SCOPE}
            return configurable[AGENT_STATE_KEY]

        state = context.get(AGENT_STATE_KEY)
        if isinstance(state, dict):
            state.setdefault("current_scope", DEFAULT_SCOPE)
            return state

        context[AGENT_STATE_KEY] = {"current_scope": DEFAULT_SCOPE}
        return context[AGENT_STATE_KEY]

    return {"current_scope": DEFAULT_SCOPE}


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
        policy = get_policy_for_state(self.state_schema)

        agent_state = _get_or_create_agent_state(request)
        scope = policy.infer_scope(request, agent_state)
        request = request.override(
            tools=policy.select_tools(request, scope, agent_state)
        )

        system_text = request.system_message.text if request.system_message else ""
        new_system_text = policy.modify_system_message(system_text, scope)
        if new_system_text != system_text:
            request = request.override(
                system_message=SystemMessage(content=new_system_text)
            )

        return handler(request)

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        policy = get_policy_for_state(self.state_schema)

        agent_state = _get_or_create_agent_state(request)
        scope = policy.infer_scope(request, agent_state)
        request = request.override(
            tools=policy.select_tools(request, scope, agent_state)
        )
        logger.info(
            "State '%s' → policy '%s' → scope '%s' with %s selected tools",
            self.state_schema.__name__,
            type(policy).__name__,
            scope,
            len(request.tools or []),
        )

        system_text = request.system_message.text if request.system_message else ""
        new_system_text = policy.modify_system_message(system_text, scope)
        if new_system_text != system_text:
            request = request.override(
                system_message=SystemMessage(content=new_system_text)
            )

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
