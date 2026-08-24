from langfuse import Langfuse


class PromptPool:
    """Connector to pull prompts from langfuse. Enables efficient versioning and management of prompts."""
    # alternatives: prompts in config or in langfuse

    def __init__(self, lf_client: Langfuse | None = None):
        ...

    def get_prompt(self) -> str:
        """Get a prompt from the pool."""
        ...