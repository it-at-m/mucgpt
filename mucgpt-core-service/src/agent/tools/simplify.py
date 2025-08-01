import logging

from langchain_core.runnables.base import RunnableSerializable
from langgraph.types import StreamWriter

from agent.tools.simplify_agent import SimplifyAgent
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


def simplify(
    text: str,
    model: RunnableSerializable,
    logger: logging.Logger,
    writer: StreamWriter = None,
) -> str:
    """Simplify complex text using a reflective agent with LangGraph."""
    try:
        # Create a SimplifyAgent instance with the writer and run the simplification workflow
        agent = SimplifyAgent(model=model, logger=logger, writer=writer)
        simplified_text = agent.run(original_text=text)
        return simplified_text
    except Exception as e:
        logger.error("Simplify tool error: %s", str(e))
        if writer:
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.ENDED,
                    content=f"Error simplifying text: {str(e)}",
                    tool_name="Simplify",
                ).model_dump_json()
            )
        return f"Error simplifying text: {str(e)}"
