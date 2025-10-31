import logging
import re
from typing import Optional, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, StateGraph
from langgraph.types import StreamWriter

from agent.tools.bpmn_generator import BPMNGenerator
from agent.tools.bpmn_models import ProcessStructure
from agent.tools.bpmn_validator import BPMNValidationError, BPMNValidator
from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


# Agent State
class BPMNCreationState(TypedDict):
    original_text: str
    process_structure: Optional[ProcessStructure]
    bpmn_xml: str
    validation_errors: list[BPMNValidationError]
    generation_error: Optional[str]  # Store generation errors for critique
    revisions: int
    error: Optional[str]


# Prompts
EXTRACT_SYSTEM_MESSAGE = """You are an expert business process analyst.
Your task is to extract structured process information from text descriptions.

Identify:
1. The main process steps (tasks)
2. Decision points (gateways)
3. Start and end events
4. The flow between these elements

Be thorough and accurate. Extract all relevant steps mentioned in the text."""


EXTRACT_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""Analyze the following text and extract the business process structure.

Text:
--------------------------------------------------------------------------------
{text}
--------------------------------------------------------------------------------

Extract:
1. Process name and description
2. All process steps (tasks, decisions, events)
3. The sequence/flow between steps
4. Any conditions or branching logic

Provide the structured output following the ProcessStructure schema.""",
)


VALIDATE_CRITIQUE_PROMPT = PromptTemplate(
    input_variables=["original_text", "bpmn_xml", "validation_errors"],
    template="""You are a BPMN quality assurance expert.

Original Process Description:
{original_text}

Generated BPMN (summary):
{bpmn_xml}

Validation Errors Found:
{validation_errors}

Analyze whether the BPMN correctly represents the process described in the original text.
Check for:
1. Missing process steps
2. Incorrect flow logic
3. Missing decision points
4. Structural issues

If there are significant issues, provide specific recommendations for improvement.
If the BPMN is acceptable, respond with "No issues found."

Critique:
""",
)


REFINE_PROMPT = PromptTemplate(
    input_variables=["original_text", "current_structure", "critique"],
    template="""You are an expert business process analyst.
Your task is to refine the process structure based on feedback.

Original Process Description:
{original_text}

Current Process Structure:
{current_structure}

Critique and Issues:
{critique}

Please provide an improved ProcessStructure that addresses all the issues mentioned in the critique.
Ensure all steps from the original text are included and the flow is logical.

Refined Process Structure:
""",
)


MAX_REVISIONS = 3


class BPMNAgent:
    """Agent for creating BPMN diagrams from process descriptions."""

    def __init__(
        self,
        model: RunnableSerializable,
        logger: logging.Logger,
        writer: Optional[StreamWriter] = None,
    ):
        self.model = model
        self.logger = logger
        self.writer = writer
        self.generator = BPMNGenerator()
        self.validator = BPMNValidator(logger)
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
                    tool_name="BPMN Creator",
                ).model_dump_json()
            )

    def _normalize_identifier(self, value: str, fallback_prefix: str = "step") -> str:
        """Normalize identifiers to BPMN-friendly format."""
        value = (value or "").strip()
        if not value:
            value = fallback_prefix
        value = re.sub(r"\s+", "_", value)
        value = re.sub(r"[^a-zA-Z0-9_-]", "_", value)
        if not value:
            value = fallback_prefix
        if value[0].isdigit():
            value = f"{fallback_prefix}_{value}"
        return value.lower()

    def _sanitize_process_structure(
        self, structure: ProcessStructure
    ) -> tuple[ProcessStructure, list[str]]:
        """Ensure unique, sanitized IDs and valid flow references."""
        data = structure.model_dump()
        adjustments: list[str] = []

        id_map: dict[str, list[str]] = {}
        used_ids: dict[str, int] = {}

        # Sanitize step identifiers and collect mapping
        for step in data["steps"]:
            original_id = step.get("step_id") or ""
            base_source = original_id or step.get("name") or "step"
            normalized = self._normalize_identifier(base_source)

            # Ensure uniqueness
            count = used_ids.get(normalized, 0)
            if count:
                candidate = f"{normalized}_{count + 1}"
                while candidate in used_ids:
                    count += 1
                    candidate = f"{normalized}_{count + 1}"
                normalized = candidate
            used_ids[normalized] = 1

            if original_id in id_map:
                # Duplicate source identifier detected
                adjustments.append(
                    f"Schritt-ID '{original_id}' mehrfach gefunden – neue ID '{normalized}' zugewiesen."
                )
            elif original_id != normalized:
                adjustments.append(
                    f"Schritt-ID '{original_id or '<leer>'}' in '{normalized}' umbenannt."
                )

            id_map.setdefault(original_id, [])
            id_map[original_id].append(normalized)
            # Ensure sanitized identifier can also be resolved directly
            id_map.setdefault(normalized, [])
            if normalized not in id_map[normalized]:
                id_map[normalized].append(normalized)
            step["step_id"] = normalized

        valid_ids = {step["step_id"] for step in data["steps"]}

        # Update flows and remove invalid references
        sanitized_flows = []
        for flow in data["flows"]:
            original_from = flow["from_step"]
            original_to = flow["to_step"]

            mapped_from = id_map.get(original_from, [original_from])
            mapped_to = id_map.get(original_to, [original_to])

            new_from = mapped_from[0]
            new_to = mapped_to[0]

            if new_from not in valid_ids:
                adjustments.append(
                    f"Verbindung von '{original_from}' entfernt (Schritt nicht gefunden)."
                )
                continue
            if new_to not in valid_ids:
                adjustments.append(
                    f"Verbindung zu '{original_to}' entfernt (Schritt nicht gefunden)."
                )
                continue

            flow["from_step"] = new_from
            flow["to_step"] = new_to
            sanitized_flows.append(flow)

        if len(sanitized_flows) != len(data["flows"]):
            data["flows"] = sanitized_flows

        sanitized_structure = ProcessStructure.model_validate(data)
        return sanitized_structure, adjustments

    def _build_graph(self):
        """Build the LangGraph workflow."""
        workflow = StateGraph(BPMNCreationState)

        workflow.add_node("extract", self._extract_node)
        workflow.add_node("generate", self._generate_node)
        workflow.add_node("validate", self._validate_node)
        workflow.add_node("refine", self._refine_node)

        workflow.set_entry_point("extract")
        workflow.add_edge("extract", "generate")
        workflow.add_edge("generate", "validate")
        workflow.add_conditional_edges(
            "validate",
            self._should_refine,
            {
                "refine": "refine",
                "end": END,
            },
        )
        workflow.add_edge("refine", "generate")

        return workflow.compile()

    def _extract_node(self, state: BPMNCreationState):
        """Extract structured process information from text."""
        self.logger.info("Extracting process structure from text...")
        self._stream_update(
            "\n\n📝 Analysiere Prozessbeschreibung...", ToolStreamState.APPEND
        )

        prompt = EXTRACT_PROMPT.format(text=state["original_text"])
        messages = [
            SystemMessage(content=EXTRACT_SYSTEM_MESSAGE),
            HumanMessage(content=prompt),
        ]

        # Use structured output
        llm = self.model.with_structured_output(ProcessStructure).with_config(
            {
                "llm_temperature": 0.0,
            }
        )

        try:
            process_structure = llm.invoke(messages)

            # Stream the extracted structure details
            self._stream_update(
                f"\n\n✓ **Prozess erkannt:** {process_structure.process_name}",
                ToolStreamState.APPEND,
            )

            if process_structure.process_description:
                self._stream_update(
                    f"\n📄 {process_structure.process_description}",
                    ToolStreamState.APPEND,
                )

            self._stream_update(
                f"\n\n**Extrahierte Schritte ({len(process_structure.steps)}):**",
                ToolStreamState.APPEND,
            )

            for i, step in enumerate(process_structure.steps, 1):
                step_type_icon = {
                    "event": "🔵"
                    if step.event_type == "start"
                    else "🔴"
                    if step.event_type == "end"
                    else "⚪",
                    "gateway": "◆",
                    "task": "▢",
                }.get(step.step_type, "▢")

                self._stream_update(
                    f"\n{i}. {step_type_icon} **{step.name}** ({step.step_type})",
                    ToolStreamState.APPEND,
                )
                if step.description:
                    self._stream_update(
                        f"\n   ↳ {step.description}",
                        ToolStreamState.APPEND,
                    )

            if process_structure.flows:
                self._stream_update(
                    f"\n\n**Prozessfluss ({len(process_structure.flows)} Verbindungen):**",
                    ToolStreamState.APPEND,
                )
                for flow in process_structure.flows:
                    condition_text = f" [{flow.condition}]" if flow.condition else ""
                    self._stream_update(
                        f"\n• {flow.from_step} → {flow.to_step}{condition_text}",
                        ToolStreamState.APPEND,
                    )

            return {
                **state,
                "process_structure": process_structure,
            }
        except Exception as e:
            self.logger.error(f"Error during extraction: {e}")
            self._stream_update(
                f"\n\n❌ Fehler bei der Analyse: {str(e)}", ToolStreamState.APPEND
            )
            return {
                **state,
                "error": f"Extraction failed: {str(e)}",
            }

    def _generate_node(self, state: BPMNCreationState):
        """Generate BPMN XML from process structure."""
        self.logger.info("Generating BPMN XML...")
        self._stream_update("\n🔨 Erstelle BPMN-Diagramm...", ToolStreamState.APPEND)

        if state["process_structure"] is None:
            error = "No process structure available for generation"
            self.logger.error(error)
            return {
                **state,
                "error": error,
            }

        sanitized_structure, adjustments = self._sanitize_process_structure(
            state["process_structure"]
        )

        if adjustments:
            self._stream_update(
                "\n🔁 Korrigiere Prozessstruktur für gültiges BPMN...",
                ToolStreamState.APPEND,
            )
            for note in adjustments:
                self._stream_update(f"\n• {note}", ToolStreamState.APPEND)

        try:
            bpmn_xml = self.generator.generate(
                sanitized_structure,
                callback=lambda msg: self._stream_update(
                    f"\n{msg}", ToolStreamState.APPEND
                ),
            )
            self._stream_update(
                "\n✓ BPMN-XML erfolgreich generiert", ToolStreamState.APPEND
            )

            return {
                **state,
                "process_structure": sanitized_structure,
                "bpmn_xml": bpmn_xml,
                "generation_error": None,  # Clear any previous generation error
            }
        except Exception as e:
            self.logger.error(f"Error during generation: {e}")
            self._stream_update(
                f"\n⚠️ Generierungsfehler: {str(e)} - wird in nächster Revision korrigiert",
                ToolStreamState.APPEND,
            )
            # Don't stop the process - store the error for critique
            return {
                **state,
                "process_structure": sanitized_structure,
                "bpmn_xml": state.get("bpmn_xml", ""),  # Keep previous XML if available
                "generation_error": str(e),  # Store error for critique
            }

    def _validate_node(self, state: BPMNCreationState):
        """Validate the generated BPMN."""
        self.logger.info("Validating BPMN...")
        self._stream_update(
            f"\n🔍 Validiere BPMN (Revision #{state.get('revisions', 0) + 1})...",
            ToolStreamState.APPEND,
        )

        # Check if there was a generation error
        generation_error = state.get("generation_error")
        if generation_error:
            self._stream_update(
                "\n⚠️ Generierungsfehler muss korrigiert werden",
                ToolStreamState.APPEND,
            )
            # Skip XML validation if generation failed
            return {
                **state,
                "validation_errors": [],
                "revisions": state.get("revisions", 0) + 1,
                "critique": f"CRITICAL: XML generation failed with error: {generation_error}\n\n"
                f"This indicates a problem with the process structure. Common causes:\n"
                f"- Duplicate step IDs\n"
                f"- Invalid characters in element IDs or names\n"
                f"- Flows referencing non-existent steps\n\n"
                f"Please revise the ProcessStructure to fix these issues. "
                f"Ensure all step_id values are unique and contain only valid characters (alphanumeric, underscore, hyphen).",
            }

        is_valid, errors = self.validator.validate(state["bpmn_xml"])

        error_count = sum(1 for e in errors if e.severity == "error")
        warning_count = sum(1 for e in errors if e.severity == "warning")

        if is_valid:
            if warning_count > 0:
                self._stream_update(
                    f"\n✓ BPMN strukturell valide ({warning_count} Warnung(en))",
                    ToolStreamState.APPEND,
                )
            else:
                self._stream_update(
                    "\n✓ BPMN vollständig valide!", ToolStreamState.APPEND
                )
        else:
            self._stream_update(
                f"\n⚠️ Validierungsprobleme gefunden: {error_count} Fehler, {warning_count} Warnungen",
                ToolStreamState.APPEND,
            )

        for entry in errors:
            prefix = "⚠️" if entry.severity == "warning" else "❌"
            detail = f"{prefix} {entry.severity.upper()}: {entry.message}" + (
                f" (Element: {entry.element_id})" if entry.element_id else ""
            )
            self._stream_update(f"\n{detail}", ToolStreamState.APPEND)

        # Perform semantic validation with LLM
        if is_valid or state.get("revisions", 0) > 0:
            self._stream_update(
                "\n🤖 Prüfe semantische Korrektheit...", ToolStreamState.APPEND
            )
            critique = self._get_semantic_critique(state, errors)
        else:
            critique = "Structural validation failed. " + "\n".join(
                str(e) for e in errors
            )

        return {
            **state,
            "validation_errors": errors,
            "revisions": state.get("revisions", 0) + 1,
            "critique": critique,
        }

    def _get_semantic_critique(
        self, state: BPMNCreationState, validation_errors: list[BPMNValidationError]
    ) -> str:
        """Use LLM to critique the BPMN semantically."""
        # Create a summary of the BPMN for the LLM
        if state["process_structure"]:
            bpmn_summary = f"""Process: {state["process_structure"].process_name}
Steps: {len(state["process_structure"].steps)}
- {", ".join(step.name for step in state["process_structure"].steps)}
Flows: {len(state["process_structure"].flows)}"""
        else:
            bpmn_summary = "Structure not available"

        validation_summary = (
            "\n".join(str(e) for e in validation_errors)
            if validation_errors
            else "No validation errors"
        )

        prompt = VALIDATE_CRITIQUE_PROMPT.format(
            original_text=state["original_text"],
            bpmn_xml=bpmn_summary,
            validation_errors=validation_summary,
        )

        critique_llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
            }
        )

        critique = ""
        for chunk in critique_llm.stream([HumanMessage(content=prompt)]):
            if isinstance(chunk, BaseMessage) and chunk.content:
                critique += chunk.content

        critique = critique.strip()

        if critique:
            self._stream_update(
                f"\n🧠 {critique}",
                ToolStreamState.APPEND,
            )

        self.logger.info(f"Semantic critique: {critique}")

        if "no issues found" in critique.lower():
            self._stream_update(
                "\n✓ Semantische Prüfung bestanden!", ToolStreamState.APPEND
            )
        else:
            self._stream_update(
                "\n⚠️ Verbesserungspotenzial erkannt", ToolStreamState.APPEND
            )

        return critique

    def _refine_node(self, state: BPMNCreationState):
        """Refine the process structure based on critique."""
        self.logger.info("Refining process structure...")
        self._stream_update(
            "\n\n🔧 **Überarbeite Prozessstruktur...**", ToolStreamState.APPEND
        )

        current_structure_str = (
            state["process_structure"].model_dump_json(indent=2)
            if state["process_structure"]
            else "None"
        )

        prompt = REFINE_PROMPT.format(
            original_text=state["original_text"],
            current_structure=current_structure_str,
            critique=state.get("critique", ""),
        )

        refine_llm = self.model.with_structured_output(ProcessStructure).with_config(
            {
                "llm_temperature": 0.0,
            }
        )

        try:
            refined_structure = refine_llm.invoke([HumanMessage(content=prompt)])

            # Stream the refined structure details
            self._stream_update(
                f"\n\n✓ **Überarbeiteter Prozess:** {refined_structure.process_name}",
                ToolStreamState.APPEND,
            )

            self._stream_update(
                f"\n**Schritte ({len(refined_structure.steps)}):**",
                ToolStreamState.APPEND,
            )

            for i, step in enumerate(refined_structure.steps, 1):
                step_type_icon = {
                    "event": "🔵"
                    if step.event_type == "start"
                    else "🔴"
                    if step.event_type == "end"
                    else "⚪",
                    "gateway": "◆",
                    "task": "▢",
                }.get(step.step_type, "▢")

                self._stream_update(
                    f"\n{i}. {step_type_icon} {step.name}",
                    ToolStreamState.APPEND,
                )

            self._stream_update(
                f"\n**Verbindungen:** {len(refined_structure.flows)}",
                ToolStreamState.APPEND,
            )

            return {
                **state,
                "process_structure": refined_structure,
            }
        except Exception as e:
            self.logger.error(f"Error during refinement: {e}")
            self._stream_update(
                f"\n\n❌ Fehler bei der Überarbeitung: {str(e)}", ToolStreamState.APPEND
            )
            # Return original structure on error
            return state

    def _should_refine(self, state: BPMNCreationState):
        """Decide whether to refine or end."""
        critique = state.get("critique", "")
        revisions = state.get("revisions", 0)
        has_structural_errors = any(
            e.severity == "error" for e in state.get("validation_errors", [])
        )
        has_generation_error = state.get("generation_error") is not None

        if state.get("error"):
            self.logger.error("Error in state, ending")
            return "end"

        # Continue refining if there are generation errors
        if has_generation_error and revisions < MAX_REVISIONS:
            self.logger.info("Generation error found, refining...")
            return "refine"

        if "no issues found" in critique.lower() and not has_structural_errors:
            self.logger.info("No issues found, ending")
            return "end"

        if revisions >= MAX_REVISIONS:
            self.logger.warning("Max revisions reached, ending")
            self._stream_update(
                f"\n\nℹ️ Maximale Anzahl an Revisionen ({MAX_REVISIONS}) erreicht.",
                ToolStreamState.APPEND,
            )
            return "end"

        self.logger.info("Issues found, refining...")
        return "refine"

    def run(self, process_text: str) -> str:
        """Run the BPMN creation agent."""
        self._stream_update("🚀 Starte BPMN-Erstellung...", ToolStreamState.STARTED)

        initial_state = {
            "original_text": process_text,
            "process_structure": None,
            "bpmn_xml": "",
            "validation_errors": [],
            "generation_error": None,
            "revisions": 0,
            "error": None,
        }

        try:
            final_state = self.graph.invoke(initial_state)

            if final_state.get("error"):
                self._stream_update(
                    f"\n\n❌ Fehler: {final_state['error']}", ToolStreamState.ENDED
                )
                return f"Fehler bei der BPMN-Erstellung: {final_state['error']}"

            self._stream_update(
                "\n\n✅ BPMN-Erstellung abgeschlossen!\n\n<bpmn>\n",
                ToolStreamState.APPEND,
            )
            self._stream_update(final_state["bpmn_xml"], ToolStreamState.APPEND)
            self._stream_update("\n</bpmn>", ToolStreamState.ENDED)

            return final_state["bpmn_xml"]

        except Exception as e:
            error_message = f"Error during BPMN creation: {str(e)}"
            self.logger.error(error_message)
            self._stream_update(f"\n\n❌ {error_message}", ToolStreamState.ENDED)
            return f"Fehler bei der BPMN-Erstellung: {str(e)}"
