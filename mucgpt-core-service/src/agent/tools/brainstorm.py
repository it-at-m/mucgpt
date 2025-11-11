import logging
import textwrap
from typing import List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langchain_core.tools import tool
from langchain_core.tools.base import BaseTool
from langgraph.config import get_stream_writer
from langgraph.types import StreamWriter

from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState

# Centralized single-line summaries to avoid duplication across decorator, metadata and system prompt
BRAINSTORMING_SUMMARY = "Generates or refines a detailed markdown mind map."  # one-line

# Detailed instruction templates (dedented for clean system prompts)
BRAINSTORMING_DETAILED = textwrap.dedent(
    """
    **Brainstorming**

    Description: Generates or refines a detailed mind map (pure markdown; no code fences).

    Use for:
    • New idea exploration
    • Organizing complex / hierarchical domains
    • Structured refinement based on user feedback

    Technical:
    • Hierarchical markdown (headings + bullet lists)
    • 4–7 main branches recommended; 2–4 nested levels where meaningful
    • Bold only once for central concept line

    Parameters:
    - topic (required)
    - context (optional) Supplemental info to integrate selectively
    - existing_mindmap (optional) Full previous map for refinement
    - feedback (optional) Specific change requests

    Best Practices:
    - In refinement: keep unchanged branches stable; modify only targeted areas
    - Avoid generic placeholders (e.g., "Misc")
    - Prefer parallel grammatical structure for sibling nodes
    - Reference earlier output blocks shown as ```MUCGPTBrainstorming ...``` when refining.
    """
)

BRAINSTORM_SYSTEM_MESSAGE = "You are a creative brainstorming assistant that creates and refines detailed mind maps in markdown format."

BRAINSTORM_PROMPT = PromptTemplate(
    input_variables=[
        "mode",  # CREATE or REFINE
        "topic",  # Clean topic string
        "context_block",  # Context section or NO_ADDITIONAL_CONTEXT
        "refine_block",  # Empty when creating, refinement materials when refining
    ],
    template="""
You are a specialized mind map generator and refiner that outputs ONLY pure markdown (no code fences, no explanations).

MODE: {mode}
TOPIC: {topic}

{context_block}

{refine_block}

OUTPUT REQUIREMENTS:
1. Output ONLY markdown (no backticks, no prose before/after).
2. First heading: # {topic}
3. Immediately after the first heading: a single line with the central concept in **bold**.
4. Use nested headings (##, ###) plus bullet lists for deeper levels; avoid numbering like "Main topic 1".
5. Aim for 4–7 primary branches; each may have 2–4 sublevels where meaningful.
6. Use bullet lists whenever a node has >1 children; indent consistently with two spaces.
7. Avoid generic filler nodes ("Misc", "Other"); be specific and informative.
8. Do NOT invent meta sections like "Introduction" / "Conclusion" unless integral to the domain.
9. Bold only the central concept line (no other bold for whole headings).
10. If MODE=REFINE: Preserve useful existing structure; modify only where feedback indicates gaps, redundancy, or needed expansion.
11. Integrate context selectively into relevant branches; do not dump context verbatim.
12. No trailing commentary or quality checklist in the output.

QUALITY CHECK INTERNALLY BEFORE RETURNING (do not output this list):
- No code fences
- No duplicated sibling labels
- Consistent heading hierarchy
- Central concept bolded exactly once
- No instructions leaked

Return only the final markdown.
""",
)


def cleanup_mindmap(mindmap_result: str) -> str:
    """Remove any accidental code fences or leading/trailing noise; keep plain markdown."""
    text = mindmap_result.strip()
    if text.startswith("```"):
        # Remove any fenced block wrapper generically
        parts = text.split("```")
        # Collect non-empty segments that are not language hints
        cleaned_segments = []
        for seg in parts:
            s = seg.strip()
            if not s:
                continue
            # Skip simple language identifiers
            if len(s.split()) == 1 and s.lower() in {"md", "markdown", "text"}:
                continue
            cleaned_segments.append(s)
        if cleaned_segments:
            text = "\n".join(cleaned_segments).strip()
    return text


def brainstorming(
    topic: str,
    context: Optional[str],
    model: RunnableSerializable,
    logger: logging.Logger,
    writer: StreamWriter,
    existing_mindmap: Optional[str] = None,
    feedback: Optional[str] = None,
) -> str:
    """Generate or refine a comprehensive mind map for a given topic in structured markdown format."""
    # Basic validation
    if not topic or not topic.strip():
        return "Error: Topic is required for brainstorming."
    if existing_mindmap and not (feedback and feedback.strip()):
        logger.warning(
            "Refine mode without feedback provided; proceeding but result may change little."
        )

    topic_clean = topic.strip()

    if existing_mindmap:
        logger.info("Brainstorm tool (REFINE) topic=%s", topic_clean)
    else:
        logger.info("Brainstorm tool (CREATE) topic=%s", topic_clean)

    mode = "REFINE" if existing_mindmap else "CREATE"

    context_block = (
        "CONTEXT (selectively integrate where useful):\n<<CONTEXT_START>>\n"
        f"{context.strip()}\n<<CONTEXT_END>>"
        if context and context.strip()
        else "NO_ADDITIONAL_CONTEXT"
    )

    refine_block = ""
    if existing_mindmap:
        refine_block = (
            "REFINEMENT MATERIAL:\n"
            "<<EXISTING_MINDMAP_START>>\n"
            + existing_mindmap.strip()
            + "\n<<EXISTING_MINDMAP_END>>\n\n"
            + "FEEDBACK:\n<<FEEDBACK_START>>\n"
            + (feedback.strip() if feedback else "(none provided)")
            + "\n<<FEEDBACK_END>>\n"
        )

    try:
        mindmap_prompt = BRAINSTORM_PROMPT.format(
            mode=mode,
            topic=topic_clean,
            context_block=context_block,
            refine_block=refine_block,
        )
        system_msg = SystemMessage(content=BRAINSTORM_SYSTEM_MESSAGE)
        user_msg = HumanMessage(content=mindmap_prompt)
        msgs: List[BaseMessage] = [system_msg, user_msg]

        llm = model.with_config(
            {
                "llm_temperature": 0.8,
                "llm_max_tokens": 2000,
                "llm_streaming": False,
            }
        )
        response = ""
        for chunk in llm.stream(msgs):
            # Some models may stream plain strings, others message objects
            if isinstance(chunk, BaseMessage):
                result = chunk.content
            else:
                result = str(chunk)
            response += result
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.APPEND,
                    content=result,
                    tool_name="Brainstorming",
                ).model_dump_json()
            )
        mindmap = cleanup_mindmap(response)
        writer(
            ToolStreamChunk(
                state=ToolStreamState.UPDATE,
                content=mindmap,
                tool_name="Brainstorming",
            ).model_dump_json()
        )
        return mindmap
    except Exception as e:
        logger.error("Brainstorm tool error: %s", str(e))
        return f"Error brainstorming for '{topic_clean}'"

def make_brainstorm_tool(model: RunnableSerializable, logger: logging.Logger = None) -> BaseTool:
    @tool(
        "Brainstorming",
        description=BRAINSTORMING_SUMMARY,
    )
    def brainstorm_tool(
            topic: str,
            context: str = None,
            existing_mindmap: str = None,
            feedback: str = None,
    ):
        writer = get_stream_writer()
        if existing_mindmap:
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.STARTED,
                    content=f"Verbessere Brainstorming für Thema: {topic} basierend auf Feedback",
                    tool_name="Brainstorming",
                ).model_dump_json()
            )
        else:
            writer(
                ToolStreamChunk(
                    state=ToolStreamState.STARTED,
                    content=f"Starte Brainstorming für Thema: {topic}",
                    tool_name="Brainstorming",
                ).model_dump_json()
            )
        result = brainstorming(
            topic, context, model, logger, writer, existing_mindmap, feedback
        )
        writer(
            ToolStreamChunk(
                state=ToolStreamState.ENDED,
                content="Brainstorming abgeschlossen.",
                tool_name="Brainstorming",
            ).model_dump_json()
        )
        return result

    return brainstorm_tool
