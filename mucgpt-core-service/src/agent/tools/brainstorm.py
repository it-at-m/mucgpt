import logging
from typing import List, Optional

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langgraph.types import StreamWriter

from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState

BRAINSTORM_SYSTEM_MESSAGE = "You are a creative brainstorming assistant that creates detailed mind maps in markdown format."

BRAINSTORM_PROMPT = PromptTemplate(
    input_variables=["topic", "context"],
    template="""
Plan out a mind map in a markdown file on the topic {topic} using the provided format.
{context}

Follow the following rules:
- Be very creative and very detailed
- Format the texts in markdown, where it fits.
  - Display the text for the most important topic in bold.
  - Use always more sublists, if more than one subtopic is available.
  - Do just include the topics without structuring information (like topic 1, topic 2, etc.)

Use the following structure to ensure clarity and organization:

# Central topic

## Main topic 1

### Subtopic 1

- Subsubtopic 1
 - Subsubsubtopic 1
 - Subsubsubtopic 2
  - Subsubsubsubtopic 1
- Subsubtopic 2
- Subsubtopic 3

### Subtopic 2

- Subsubtopic 1
- Subsubtopic 2
- Subsubtopic 3

## Main topic 2

### Subtopic 1

- Subsubtopic 1
- Subsubtopic 2
- Subsubtopic 3

# Output Format

1. The output should be formatted in the previous format.
2. Just return plain markdown. No Code blocks!
3. Include all elements in the markdown structure specified above, maintaining organized headings and bullet points.
""",
)


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
