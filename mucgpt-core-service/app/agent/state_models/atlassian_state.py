from typing import Literal
from pydantic import BaseModel, Field

from .default_state import DefaultAgentState


class AtlassianAgentState(DefaultAgentState):
    """State for assistants that have Atlassian (Jira/Confluence) tools."""

    current_scope: Literal["confluence", "jira", "general"]
    locked_scope: Literal["confluence", "jira", "general"]
    initial_scope_checked: bool
    scope_confidence: float


class ScopeDecision(BaseModel):
        scope: str
        confidence: float = Field(ge=0.0, le=1.0)