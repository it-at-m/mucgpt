from typing import Literal

from langchain.agents.middleware import AgentState


class AtlassianAgentState(AgentState):
    """Task-specific state consumed by generalized tool-selection policies."""

    current_scope: Literal["confluence", "jira", "general"]
    scope_confidence: float
    task_hints: dict[str, str]


# saml authentication geht nicht mit mucgpt sso token forwarding
