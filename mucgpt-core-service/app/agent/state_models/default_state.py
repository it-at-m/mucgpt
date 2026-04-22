from typing import Literal
from langchain.agents.middleware import AgentState


class DefaultAgentState(AgentState):
    """Default agent state used for generic chats without domain-specific routing."""
    policy_key: Literal["base"]