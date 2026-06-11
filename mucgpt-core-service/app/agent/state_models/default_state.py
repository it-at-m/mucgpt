from typing import Any

from langchain.agents.middleware import AgentState


class DefaultAgentState(AgentState):
    """Default agent state for generic chats without domain-specific routing.

    Uses ``DefaultScopePolicy`` (no-op) — all available tools are forwarded
    to the model unchanged.  This is the classic ReAct agent behaviour.
    """

    data_sources: list[Any] | None
