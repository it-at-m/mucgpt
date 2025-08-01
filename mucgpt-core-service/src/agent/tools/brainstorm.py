import logging
from typing import List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables.base import RunnableSerializable
from langgraph.types import StreamWriter

from agent.tools.prompts_fallback import (
    BRAINSTORM_PROMPT,
    BRAINSTORM_SYSTEM_MESSAGE,
)
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


def cleanup_mindmap(mindmap_result: str) -> str:
    """Remove leading explanation and extract markdown content."""
    if "```" in mindmap_result:
        splitted = str(mindmap_result).split("```")
        if len(splitted) == 3:
            mindmap_result = splitted[1]
            lines = mindmap_result.split("\n")
            if lines and lines[0].strip().lower() in ["markdown", "md"]:
                mindmap_result = "\n".join(lines[1:])
    return mindmap_result.strip()


def brainstorming(
    topic: str,
    context: Optional[str],
    model: RunnableSerializable,
    logger: logging.Logger,
    writer: StreamWriter,
) -> str:
    """Generate a comprehensive mind map for a given topic in structured markdown format."""
    logger.info("Brainstorm tool called for topic: %s", topic)
    mindmap_prompt = BRAINSTORM_PROMPT.format(topic=topic, context=context)
    system_msg = SystemMessage(content=BRAINSTORM_SYSTEM_MESSAGE)
    user_msg = HumanMessage(content=mindmap_prompt)
    msgs: List[BaseMessage] = [system_msg, user_msg]
    try:
        llm = model.with_config(
            {
                "llm_temperature": 0.8,
                "llm_max_tokens": 2000,
                "llm_streaming": False,
            }
        )
        response = ""
        for chunk in llm.stream(msgs):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
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
        return "Error brainstorming for '{topic}'"
