from langchain.agents.middleware import AgentState

class DefaultAgentState(AgentState):
    """Default agent state with no specific structure, can be used as a simple key-value store for policies that don't require specific state schema."""
    pass