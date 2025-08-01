import logging
from typing import List, Optional, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, StateGraph
from langgraph.types import StreamWriter

from agent.tools.prompts_fallback import (
    SIMPLIFY_PROMPT,
    SIMPLIFY_SYSTEM_MESSAGE_FALLBACK,
)
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


# Agent State
class ReflectiveSimplificationState(TypedDict):
    original_text: str
    simplified_text: str
    critique: str
    revisions: int
    messages: List[BaseMessage]
    error: Optional[str]


# Prompts
CRITIQUE_PROMPT = PromptTemplate(
    input_variables=["original_text", "simplified_text", "rules"],
    template="""You are an expert quality assurance agent specializing in Leichte Sprache (Easy Language).
Your task is to critique a simplified text.

Original Text:
<original>
{original_text}
</original>

Simplified Text to Critique:
<simplified>
{simplified_text}
</simplified>

Review the simplified text against the following rules and the original text.
<rules>
{rules}
</rules>

Provide a concise, point-by-point critique. Identify every rule violation, such as sentences over 15 words, use of passive voice, complex words, or missing line breaks. If the text is good, respond with "No issues found."

Critique:
""",
)

REFINE_PROMPT = PromptTemplate(
    input_variables=["simplified_text", "critique"],
    template="""You are an expert editor for Leichte Sprache (Easy Language).
Your task is to revise a text based on a critique.

Text to Revise:
<text>
{simplified_text}
</text>

Critique:
<critique>
{critique}
</critique>

Please rewrite the entire text, incorporating all the feedback from the critique to ensure it fully complies with Easy Language rules.

Revised Text:
""",
)

MAX_REVISIONS = 3


class SimplifyAgent:
    def __init__(
        self,
        model: RunnableSerializable,
        logger: logging.Logger,
        writer: Optional[StreamWriter] = None,
    ):
        self.model = model
        self.logger = logger
        self.writer = writer
        self.graph = self._build_graph()

    def _stream_update(
        self, content: str, state: ToolStreamState = ToolStreamState.APPEND
    ):
        """Helper method to stream updates if a writer is available."""
        if self.writer:
            self.writer(
                ToolStreamChunk(
                    state=state,
                    content=content,
                    tool_name="Simplify",
                ).model_dump_json()
            )

    def _build_graph(self):
        workflow = StateGraph(ReflectiveSimplificationState)

        workflow.add_node("generate", self._generate_node)
        workflow.add_node("critique", self._critique_node)
        workflow.add_node("refine", self._refine_node)

        workflow.set_entry_point("generate")
        workflow.add_edge("generate", "critique")
        workflow.add_conditional_edges(
            "critique",
            self._should_refine,
            {
                "refine": "refine",
                "end": END,
            },
        )
        workflow.add_edge("refine", "critique")

        return workflow.compile()

    def _generate_node(self, state: ReflectiveSimplificationState):
        self.logger.info("Generating initial simplification...")
        self._stream_update(
            "Generating initial simplified version...", ToolStreamState.STARTED
        )

        prompt = SIMPLIFY_PROMPT.format(text=state["original_text"])
        messages = [
            SystemMessage(content=SIMPLIFY_SYSTEM_MESSAGE_FALLBACK),
            HumanMessage(content=prompt),
        ]

        llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
                "llm_streaming": True,  # Enable streaming
                "llm_max_tokens": 5000,
            }
        )

        # Stream the response
        response_content = ""
        last_chunk = None
        for chunk in llm.stream(messages):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                response_content += result
                self._stream_update(result)
                last_chunk = chunk

        # Update with complete simplified text
        self._stream_update(response_content, ToolStreamState.UPDATE)

        return {
            **state,
            "simplified_text": response_content.strip(),
            "messages": messages + [last_chunk] if last_chunk else messages,
        }

    def _critique_node(self, state: ReflectiveSimplificationState):
        self.logger.info("Critiquing simplified text...")
        self._stream_update(
            f"\n\n**Revision #{state.get('revisions', 0) + 1}: Analyzing text quality...**",
            ToolStreamState.APPEND,
        )

        prompt = CRITIQUE_PROMPT.format(
            original_text=state["original_text"],
            simplified_text=state["simplified_text"],
            rules=SIMPLIFY_SYSTEM_MESSAGE_FALLBACK,
        )

        critique_llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
                "llm_streaming": True,  # Enable streaming
            }
        )

        critique = ""
        for chunk in critique_llm.stream([HumanMessage(content=prompt)]):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                critique += result
                # Don't stream the critique to the user directly

        self.logger.info("Critique: %s", critique)

        if "no issues found" in critique.lower():
            self._stream_update(
                "\n✓ Text quality check passed! No issues found.",
                ToolStreamState.APPEND,
            )
        else:
            self._stream_update(
                "\n⚠️ Quality issues identified. Refining text...",
                ToolStreamState.APPEND,
            )

        return {
            **state,
            "critique": critique,
            "revisions": state.get("revisions", 0) + 1,
        }

    def _refine_node(self, state: ReflectiveSimplificationState):
        self.logger.info("Refining text based on critique...")
        prompt = REFINE_PROMPT.format(
            simplified_text=state["simplified_text"],
            critique=state["critique"],
        )

        refine_llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
                "llm_streaming": True,  # Enable streaming
            }
        )

        refined_text = ""
        for chunk in refine_llm.stream([HumanMessage(content=prompt)]):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                refined_text += result
                self._stream_update(result)

        # Update with complete refined text
        self._stream_update(refined_text, ToolStreamState.UPDATE)

        return {
            **state,
            "simplified_text": refined_text.strip(),
        }

    def _should_refine(self, state: ReflectiveSimplificationState):
        critique = state["critique"]
        revisions = state["revisions"]

        if "no issues found" in critique.lower():
            self.logger.info("Critique found no issues. Ending.")
            return "end"
        if revisions >= MAX_REVISIONS:
            self.logger.warning("Max revisions reached. Ending.")
            self._stream_update(
                f"\n\nℹ️ Maximum revisions ({MAX_REVISIONS}) reached. Finalizing text.",
                ToolStreamState.APPEND,
            )
            return "end"
        self.logger.info("Critique found issues. Refining...")
        return "refine"

    def run(self, original_text: str) -> str:
        self._stream_update(
            "Starting text simplification process...", ToolStreamState.STARTED
        )

        initial_state = {
            "original_text": original_text,
            "simplified_text": "",  # Initialize with empty string
            "critique": "",
            "revisions": 0,
            "messages": [],
            "error": None,
        }

        try:
            final_state = self.graph.invoke(initial_state)
            self._stream_update(
                "\n\n✅ Text simplification complete!", ToolStreamState.APPEND
            )
            return final_state["simplified_text"]
        except Exception as e:
            error_message = f"Error during simplification: {str(e)}"
            self.logger.error(error_message)
            self._stream_update(f"\n\n❌ {error_message}", ToolStreamState.ENDED)
            return f"Error simplifying text: {str(e)}"
