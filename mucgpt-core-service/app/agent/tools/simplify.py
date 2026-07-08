import logging

from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.types import StreamWriter

from agent.tools.simplify_agent import SimplifyAgent
from agent.tools.spec import LocalTool
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState

# Single-line summary shown to the LLM as this tool's description.
SIMPLIFY_SUMMARY = (
    "Simplifies complex German text to A2 Easy Language (Leichte Sprache)."  # one-line
)

# User-facing name/description per language, shown in the /v1/tools tool picker.
SIMPLIFY_METADATA = {
    "deutsch": {
        "name": "Vereinfachen",
        "description": "Vereinfacht komplexe deutsche Texte auf A2-Niveau nach Prinzipien der Leichten Sprache.",
    },
    "english": {
        "name": "Simplify",
        "description": "Simplifies complex German text to A2 level using Easy Language principles.",
    },
    "français": {
        "name": "Simplifier",
        "description": "Simplifie les textes allemands complexes au niveau A2 selon les principes du langage facile.",
    },
    "bairisch": {
        "name": "Eifacher machen",
        "description": "Macht schwere deutsche Text eifacher auf A2-Level mit da Leichten Sprach.",
    },
    "ukrainisch": {
        "name": "Спростити",
        "description": "Спрощує складні німецькі тексти до рівня A2 за принципами простої мови.",
    },
}


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


def make_simplify_tool(model: RunnableSerializable, logger: logging.Logger) -> BaseTool:
    @tool(
        "Vereinfachen",
        description=SIMPLIFY_SUMMARY,
    )
    def simplify_tool(text: str):
        writer = get_stream_writer()
        result = simplify(text, model, logger, writer=writer)
        return result

    return simplify_tool


TOOL = LocalTool(
    id="Vereinfachen",
    factory=make_simplify_tool,
    metadata=SIMPLIFY_METADATA,
)
