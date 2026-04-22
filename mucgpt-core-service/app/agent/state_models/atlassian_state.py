from typing import Literal

from .default_state import DefaultAgentState
from agent.tools.policies import DefaultScopePolicy


class AtlassianAgentState(DefaultAgentState):
    """Task-specific state consumed by generalized tool-selection policies."""
    policy: type[DefaultScopePolicy]
    current_scope: Literal["confluence", "jira", "general"]
    scope_confidence: float
    task_hints: dict[str, str]
