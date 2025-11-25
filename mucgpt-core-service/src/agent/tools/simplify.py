import logging
import textwrap

from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.types import StreamWriter

from agent.tools.simplify_agent import SimplifyAgent
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState

# Centralized single-line summaries to avoid duplication across decorator, metadata and system prompt
SIMPLIFY_SUMMARY = (
    "Simplifies complex German text to A2 Easy Language (Leichte Sprache)."  # one-line
)

# Detailed instruction templates (dedented for clean system prompts)
SIMPLIFY_DETAILED = textwrap.dedent(
    """
    **Vereinfachen (Simplify)**

    Description: Converts German text to A2 level (Leichte Sprache) while preserving meaning.

    Use for:
    • Accessibility
    • Language learning support
    • Plain-language rewrites

    Technical:
    • Short sentences (≤15 words), active voice, concrete vocabulary
    • Blank lines separate logical units
    • Preserve factual accuracy; no omissions

    Parameter:
    - text (required) Entire source text (single call; do not split)

    Best Practices:
    - Reject fragments; request full text if incomplete
    - Keep proper nouns; explain only if ambiguous
    - No idioms, passive voice, nested clauses
    - Reference earlier output blocks shown as ```MUCGPTVereinfachen ...``` when user wants adjustments.
    """
)

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

def make_simplify_tool(model: RunnableSerializable, logger: logging.Logger = None) -> BaseTool:
    @tool(
        "Vereinfachen",
        description=SIMPLIFY_SUMMARY,
    )
    def simplify_tool(text: str):
        writer = get_stream_writer()
        result = simplify(text, model, logger, writer=writer)
        return result

    return simplify_tool
