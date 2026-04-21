from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from langchain.agents.middleware import (
    AgentMiddleware,
    ModelRequest,
    ModelResponse,
    ToolCallRequest,
)
from langchain.messages import SystemMessage, ToolMessage
from langgraph.types import Command

from agent.state_models.default_state import DefaultAgentState
from core.logtools import getLogger

logger = getLogger(name="agent-middleware")

DEFAULT_SCOPE = "general"
AGENT_STATE_KEY = "agent_state"

# TODO:
# - refactor to support multiple policies and more flexible state management (e.g. separate state for each policy or shared state with defined schema)
# - each tool should have explicit metadata for scope and other relevant attributes (at least a source identifier for policy selection)
# - mcp tools may require additional description metadata (see mcp-tools/mcp-atlassian.json for example) to enable effective policy decisions and agent reasoning about tool selection.
#
# - for future: consider more advanced policy implementations, e.g. using a separate LLM for policy decisions, i.e. a router


class ToolSelectionPolicy(Protocol):
    """Policy contract for state-aware scope inference and tool filtering."""

    def infer_scope(
        self, request: ModelRequest, agent_state: dict[str, Any]
    ) -> str: ...

    def select_tools(
        self,
        request: ModelRequest,
        scope: str,
        agent_state: dict[str, Any],
    ) -> list[Any]: ...


def _last_assistant_message_text(request: ModelRequest) -> str | None:
    for message in reversed(request.messages):
        message_type = str(getattr(message, "type", "")).lower()
        if message_type in {"ai", "assistant"}:
            text = getattr(message, "text", None)
            if isinstance(text, str) and text:
                return text
    return None


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


def _tool_scope(tool: Any) -> str | None:
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


class ScopePolicy:
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


class ContextMiddleware(AgentMiddleware):
    """Make Context driven adjustments to the model call, e.g. adjust system prompt or toolset based on conversation context or agent state."""

    def __init__(self, policy: ToolSelectionPolicy | None = None):
        self.policy = policy or ScopePolicy()

    @staticmethod
    def _context_system_message(system_text: str, scope: str) -> str:
        if not system_text:
            return f"[CONTEXT] Current MCP scope is: {scope}"
        separator = "" if system_text.endswith("\n") else "\n"
        return f"{system_text}{separator}[CONTEXT] Current MCP scope is: {scope}"

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        if type(request.state) is DefaultAgentState:
            return handler(request)

        


        agent_state = _get_or_create_agent_state(request)
        scope = self.policy.infer_scope(request, agent_state)
        request = request.override(
            tools=self.policy.select_tools(request, scope, agent_state)
        )

        system_text = request.system_message.text if request.system_message else ""
        new_system_message = self._context_system_message(system_text, scope)
        return handler(
            request.override(system_message=SystemMessage(content=new_system_message))
        )

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], Awaitable[ModelResponse]],
    ) -> ModelResponse:
        agent_state = _get_or_create_agent_state(request)
        scope = self.policy.infer_scope(request, agent_state)
        request = request.override(
            tools=self.policy.select_tools(request, scope, agent_state)
        )
        logger.info(
            "Using MCP scope '%s' with %s selected tools",
            scope,
            len(request.tools or []),
        )

        system_text = request.system_message.text if request.system_message else ""
        new_system_message = self._context_system_message(system_text, scope)
        return await handler(
            request.override(system_message=SystemMessage(content=new_system_message))
        )


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
