from typing import Literal

from .default_state import DefaultAgentState


class AtlassianAgentState(DefaultAgentState):
    """State for assistants that have Atlassian (Jira/Confluence) tools.

    Uses ``AtlassianScopePolicy``, which narrows the active tool set to the
    relevant Atlassian product based on conversation context.
    """

    current_scope: Literal["confluence", "jira", "general"]
    scope_confidence: float
    task_hints: dict[str, str]
