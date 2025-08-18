import importlib.util
import logging
import re
import subprocess
import tempfile
import time  # added for timing instrumentation
from typing import List, Literal, Optional, Tuple, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, StateGraph  # re-added for workflow construction
from langgraph.types import StreamWriter

from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


# Check if libraries are available using importlib.util
def is_package_available(package_name: str) -> bool:
    """Check if a package is available without importing it."""
    return importlib.util.find_spec(package_name) is not None


GRAPHVIZ_AVAILABLE = is_package_available("graphviz")
# Try multiple possible distribution names for the mermaid parser
MERMAID_AVAILABLE = any(
    is_package_available(name) for name in ("py-mermaid", "mermaid-py", "py_mermaid")
)


# Add structured validation result type
class ValidationDetails(TypedDict, total=False):
    is_valid: bool
    message: str
    errors: List[str]
    warnings: List[str]
    library_used: Optional[str]


def validate_mermaid(mermaid_code: str) -> Tuple[bool, str, ValidationDetails]:
    """Validate Mermaid diagram code and return structured details."""
    details: ValidationDetails = {
        "is_valid": False,
        "message": "",
        "errors": [],
        "warnings": [],
        "library_used": None,
    }
    if MERMAID_AVAILABLE:
        try:  # pragma: no cover - external import
            try:
                import py_mermaid as mermaid_parser  # type: ignore
            except ImportError:  # try alternate names
                import mermaid_py as mermaid_parser  # type: ignore  # noqa
            mermaid_parser.parse(mermaid_code)
            details.update(
                {
                    "is_valid": True,
                    "message": "Mermaid syntax is valid.",
                    "library_used": getattr(mermaid_parser, "__name__", "py_mermaid"),
                }
            )
            return True, details["message"], details
        except Exception as e:  # pragma: no cover - external lib
            msg = f"Mermaid syntax error: {str(e)}"
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
    # Basic heuristic validation
    try:
        code = mermaid_code.strip()
        if not code:
            msg = "Empty diagram code."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        lines = [line for line in code.split("\n") if line.strip()]
        if len(lines) < 2:
            msg = "Diagram is too short, likely incomplete."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        diagram_types = [
            "graph",
            "flowchart",
            "sequenceDiagram",
            "classDiagram",
            "stateDiagram",
            "gantt",
            "pie",
            "journey",
            "erDiagram",
        ]
        first_token = re.split(r"\s+", lines[0].strip())[0]
        if not any(first_token.lower().startswith(d.lower()) for d in diagram_types):
            msg = (
                f"Unknown diagram type '{first_token}'. Must start with one of: "
                + ", ".join(diagram_types)
            )
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        if not re.search(r"(-->|---|-\.->|==>|:::|:::)", code):
            details["warnings"].append(
                "No explicit edges/arrows detected; verify relationships are defined."
            )
        stack: List[str] = []
        matching = {"(": ")", "[": "]", "{": "}", '"': '"', "'": "'"}
        in_quote: Optional[str] = None
        for line in lines:
            for ch in line:
                if in_quote:
                    if ch == in_quote:
                        in_quote = None
                    continue
                if ch in ('"', "'"):
                    in_quote = ch
                elif ch in "([{":
                    stack.append(ch)
                elif ch in ")]}":
                    if not stack or matching[stack.pop()] != ch:
                        msg = f"Mismatched brackets near: {line.strip()[:40]}"
                        details["errors"].append(msg)
                        details["message"] = msg
                        return False, msg, details
        if stack or in_quote:
            msg = "Unclosed bracket or quote detected."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        details.update(
            {
                "is_valid": True,
                "message": "Basic Mermaid validation passed (heuristic).",
                "library_used": None,
            }
        )
        return True, details["message"], details
    except Exception as e:  # pragma: no cover - defensive
        msg = f"Error during basic validation: {str(e)}"
        details["errors"].append(msg)
        details["message"] = msg
        return False, msg, details


def validate_graphviz(dot_code: str) -> Tuple[bool, str, ValidationDetails]:
    """Validate Graphviz DOT language code. Returns (is_valid, summary_message, details)."""
    details: ValidationDetails = {
        "is_valid": False,
        "message": "",
        "errors": [],
        "warnings": [],
        "library_used": None,
    }
    if GRAPHVIZ_AVAILABLE:
        try:
            import graphviz  # type: ignore

            try:
                graph = graphviz.Source(dot_code)
                # Rendering to memory to avoid tmp artifacts; use png (fast)
                graph.pipe(format="png")  # no file write
                details.update(
                    {
                        "is_valid": True,
                        "message": "Graphviz syntax is valid.",
                        "library_used": "graphviz",
                    }
                )
                return True, details["message"], details
            except Exception as e:  # pragma: no cover - external
                msg = f"Graphviz syntax error: {str(e)}"
                details["errors"].append(msg)
                details["message"] = msg
                return False, msg, details
        except Exception as e:  # pragma: no cover
            msg = f"Error validating with Graphviz: {str(e)}"
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
    # Fallback to dot CLI if installed
    try:
        with tempfile.NamedTemporaryFile(suffix=".dot", mode="w", delete=False) as tmp:
            tmp.write(dot_code)
            tmp_path = tmp.name
        try:
            process = subprocess.run(
                ["dot", "-Tpng", tmp_path], capture_output=True, text=True, check=False
            )
            if process.returncode != 0:
                msg = f"Graphviz validation failed: {process.stderr.strip()[:400]}"
                details["errors"].append(msg)
                details["message"] = msg
                return False, msg, details
            details.update(
                {
                    "is_valid": True,
                    "message": "Graphviz syntax is valid (dot CLI).",
                    "library_used": "dot",
                }
            )
            return True, details["message"], details
        finally:  # cleanup
            import os  # noqa

            try:
                os.unlink(tmp_path)
            except Exception:  # pragma: no cover
                pass
    except Exception:
        pass  # move to basic
    # Basic heuristic
    basic_ok, basic_msg, basic_details = basic_graphviz_validation(dot_code)
    return basic_ok, basic_msg, basic_details


def basic_graphviz_validation(dot_code: str) -> Tuple[bool, str, ValidationDetails]:
    """Basic validation for Graphviz DOT language without the graphviz library."""
    details: ValidationDetails = {
        "is_valid": False,
        "message": "",
        "errors": [],
        "warnings": [],
        "library_used": None,
    }
    try:
        code = dot_code.strip()
        if not code:
            msg = "Empty diagram code."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        lines = [
            line
            for line in code.split("\n")
            if line.strip() and not line.strip().startswith("//")
        ]
        if len(lines) < 2:
            msg = "Diagram is too short, likely incomplete."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        first_line = lines[0].strip().lower()
        valid_starts = ["graph", "digraph", "strict graph", "strict digraph"]
        if not any(first_line.startswith(v) for v in valid_starts):
            msg = f"Invalid DOT syntax. Must start with: {', '.join(valid_starts)}"
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        open_braces = code.count("{")
        close_braces = code.count("}")
        if open_braces != close_braces:
            msg = "Mismatched number of braces."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        if not ("->" in code or "--" in code):
            msg = "No relationships (-> or --) found in the diagram."
            details["errors"].append(msg)
            details["message"] = msg
            return False, msg, details
        if "label=" not in code:
            details["warnings"].append(
                "No labels detected; consider adding node/edge labels."
            )
        details.update(
            {
                "is_valid": True,
                "message": "Basic Graphviz validation passed (heuristic).",
            }
        )
        return True, details["message"], details
    except Exception as e:  # pragma: no cover
        msg = f"Error during basic validation: {str(e)}"
        details["errors"].append(msg)
        details["message"] = msg
        return False, msg, details


# Agent State
class DiagramGenerationState(TypedDict):
    diagram_type: Literal["mermaid", "graphviz"]
    diagram_description: str
    diagram_code: str
    validation_result: str
    critique: str
    revisions: int
    error: Optional[str]
    validation_details: Optional[ValidationDetails]
    max_revisions: int


# Prompts
DIAGRAM_RULES = """
<instructions>
# Rules for Creating Good Diagrams

## 1. General Rules
- Keep diagrams clear and concise
- Use appropriate labels and titles
- Maintain consistent styling
- Focus on the key elements and relationships
- Ensure the diagram communicates the intended message

## 2. Mermaid Diagram Rules
- Start with a direction / type (e.g. `graph TD`, `flowchart LR`, `sequenceDiagram`)
- Organize nodes in a logical structure
- Use directional arrows to show relationships (--> or --- for lines, -.- for dotted)
- Include descriptive labels for nodes and edges
- Use appropriate diagram types (flowchart, sequence, class, state, etc.)
- Avoid crossing lines when possible
- Group related elements (subgraphs / class groupings) when helpful
- Ensure identifiers avoid spaces (use underscores or quotes if needed)

## 3. Graphviz (DOT) Diagram Rules
- Begin with `digraph Name {` (directed) or `graph Name {` (undirected)
- Terminate braces properly; balance `{` and `}`
- Use `->` for directed edges, `--` for undirected
- Apply defaults with `node [shape=box];` or `edge [color=gray];` at top
- Use subgraph clusters: `subgraph cluster_api { label="API"; ... }`
- Prefer concise node names; quote only when spaces or special chars
- Add meaningful labels (`label=`, optionally `xlabel=`) and ranks when ordering matters

## 4. Validation Requirements (Checklist)
- Mermaid: valid type line; balanced brackets/quotes; at least one relationship unless intentionally absent
- DOT: starts with (di)graph; balanced braces; at least one edge; no orphaned attribute statements
- All: readable layout intent, clear labels, accurate representation of description

## 5. Mermaid Examples
Flowchart:
```mermaid
graph TD
  A[User] --> B[API]
  B --> C{Auth?}
  C -->|Yes| D[Service]
  C -->|No| E[Error]
```
Sequence:
```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant S as Service
  U->>A: Request
  A->>S: Validate
  S-->>A: Data
  A-->>U: Response
```
Class:
```mermaid
classDiagram
  class User {
    +id: UUID
    +name: string
    +login()
  }
  class Session {
    +token: string
    +expires: Date
  }
  User --> Session : creates
```

## 6. Graphviz Examples
Directed service graph:
```dot
digraph Services {
  rankdir=LR;
  node [shape=box style=filled fillcolor=lightyellow];
  User -> API -> Auth -> DB;
  API -> Cache;
  Auth -> Audit [label="logs"];
}
```
Clustered architecture:
```dot
digraph Arch {
  graph [fontsize=10 labelloc=t label="Example Architecture"];
  node [shape=ellipse];
  subgraph cluster_ingest { label="Ingest"; style=filled; color=lightgrey; I1->I2; }
  subgraph cluster_core { label="Core"; ServiceA -> ServiceB; }
  I2 -> ServiceA -> DB;
  DB [shape=cylinder];
}
```

## 7. Output Formatting
- Return ONLY a single fenced code block with the correct language tag (`mermaid` or `dot`). No prose before or after.
- Do not wrap in additional XML/JSON; no explanations.
- Provide complete, self-contained code ready to render.

## 8. Common Mistakes to Avoid
- Missing opening type line (Mermaid) or opening graph line (DOT)
- Unbalanced braces / quotes
- Mixing directed / undirected edge styles improperly
- Forgetting language tag in fenced block
- Adding extraneous commentary outside the code block
</instructions>
"""


DIAGRAM_SYSTEM_MESSAGE = (
    """
You are a helpful assistant that creates clear and effective diagrams based on user descriptions.
You can generate diagrams in two formats:
1. Mermaid - For flowcharts, sequence diagrams, class diagrams, etc.
2. Graphviz (DOT language) - For more complex network graphs and hierarchies.

Your goal is to create a diagram that accurately represents the user's description while following best practices for diagram creation.
"""
    + DIAGRAM_RULES
)


GENERATE_DIAGRAM_PROMPT = PromptTemplate(
    input_variables=["diagram_type", "description"],
    template="""Please create a {diagram_type} diagram based on the following description.

Description:
--------------------------------------------------------------------------------
{description}
--------------------------------------------------------------------------------

Generate the complete diagram code for the described concept. Be comprehensive but clear.

STRICT OUTPUT REQUIREMENTS:
1. Return ONLY a fenced code block.
2. Use the language tag `mermaid` (for Mermaid) or `dot` (for Graphviz) immediately after the opening backticks.
3. No explanatory text before or after the fenced block.
4. Provide fully valid syntax.

Templates (for guidance - adapt as needed):
Mermaid flowchart:
```mermaid
graph TD
  Start --> Step1
```
Graphviz digraph:
```dot
digraph Name {\n  A -> B;\n}
```

{diagram_type} Diagram Code:
""",
)


VALIDATE_DIAGRAM_PROMPT = PromptTemplate(
    input_variables=["diagram_type", "diagram_code"],
    template="""You are a diagram validation expert. Please check the following {diagram_type} diagram code for syntax errors and logical issues.

{diagram_type} Diagram Code:
```{diagram_type}
{diagram_code}
```

Please validate:
1. Syntax: Is the code correctly formatted with no syntax errors?
2. Structure: Are all elements properly connected and arranged?
3. Clarity: Are labels descriptive and clear?
4. Accuracy: Does this diagram make logical sense?

For each issue found, indicate the specific line or element and explain the problem.
If no issues are found, state "The diagram is valid and correctly formatted."

Validation result:
""",
)


CRITIQUE_DIAGRAM_PROMPT = PromptTemplate(
    input_variables=[
        "diagram_type",
        "description",
        "diagram_code",
        "validation_result",
    ],
    template="""You are an expert in {diagram_type} diagrams. Review this diagram against the original description and validation results.

Original Description:
<description>
{description}
</description>

{diagram_type} Diagram Code:
```{diagram_type}
{diagram_code}
```

Validation Result:
<validation>
{validation_result}
</validation>

Provide a detailed critique of this diagram. Focus on:
1. Does it accurately represent the description?
2. Are there missing elements or relationships?
3. Is the layout optimal for understanding?
4. Are there improvements needed based on the validation results?

Be specific about what could be improved. If the diagram is excellent and validation passed, respond with "No issues found."

Critique:
""",
)


REFINE_DIAGRAM_PROMPT = PromptTemplate(
    input_variables=["diagram_type", "description", "diagram_code", "critique"],
    template="""You are an expert {diagram_type} diagram creator. Your task is to revise a diagram based on a critique.

Original Description:
<description>
{description}
</description>

Current Diagram Code:
```{diagram_type}
{diagram_code}
```

Critique:
<critique>
{critique}
</critique>

Please rewrite the entire {diagram_type} diagram code, incorporating all the feedback from the critique. Ensure your revised diagram is syntactically correct and addresses all issues mentioned.

Revised {diagram_type} Diagram Code:
""",
)


MAX_REVISIONS = 3  # default; can be overridden per run


class DiagramAgent:
    def __init__(
        self,
        model: RunnableSerializable,
        logger: logging.Logger,
        writer: Optional[StreamWriter] = None,
        max_revisions: int = MAX_REVISIONS,
    ):
        self.model = model
        self.logger = logger
        self.writer = writer
        self.max_revisions = max_revisions
        self.graph = self._build_graph()

    def _build_graph(self):
        """Construct the LangGraph workflow for the diagram generation/refinement process.

        Flow:
          generate -> validate -> critique -> (refine loop or end)
          refine -> validate (so refined code is re-validated) -> critique
        """
        workflow = StateGraph(DiagramGenerationState)

        # Register nodes
        workflow.add_node("generate", self._generate_node)
        workflow.add_node("validate", self._validate_node)
        workflow.add_node("critique", self._critique_node)
        workflow.add_node("refine", self._refine_node)

        # Linear initial path
        workflow.set_entry_point("generate")
        workflow.add_edge("generate", "validate")
        workflow.add_edge("validate", "critique")

        # Conditional refinement loop
        workflow.add_conditional_edges(
            "critique",
            self._should_refine,
            {
                "refine": "refine",
                "end": END,
            },
        )
        # After refinement, re-validate before critiquing again
        workflow.add_edge("refine", "validate")

        compiled = workflow.compile()
        self.logger.debug("DiagramAgent graph built!")
        return compiled

    def _stream_update(
        self, content: str, state: ToolStreamState = ToolStreamState.APPEND
    ):
        """Helper method to stream updates if a writer is available."""
        if self.writer:
            try:
                self.writer(
                    ToolStreamChunk(
                        state=state,
                        content=content,
                        tool_name="DiagramGenerator",
                    ).model_dump_json()
                )
            except Exception:
                self.logger.exception("Streaming update failed (state=%s).", state)

    # --- Logging helpers ---
    def _log_node_start(self, node: str, extra: Optional[dict] = None):
        self.logger.info(
            "[DiagramAgent] Starting node '%s'%s",
            node,
            f" extra={extra}" if extra else "",
        )

    def _log_node_end(self, node: str, duration: float, extra: Optional[dict] = None):
        self.logger.info(
            "[DiagramAgent] Finished node '%s' in %.3fs%s",
            node,
            duration,
            f" extra={extra}" if extra else "",
        )

    def _generate_node(self, state: DiagramGenerationState):
        start_t = time.perf_counter()
        self._log_node_start("generate", {"diagram_type": state["diagram_type"]})
        try:
            self.logger.debug(
                "Generate node description length=%d chars",
                len(state["diagram_description"])
                if state.get("diagram_description")
                else 0,
            )
            if not self.model:
                raise RuntimeError("LLM model is not configured (self.model is None)")
            prompt = GENERATE_DIAGRAM_PROMPT.format(
                diagram_type=state["diagram_type"],
                description=state["diagram_description"],
            )
            self.logger.debug("Prompt (first 500 chars): %s", prompt[:500])
            messages = [
                SystemMessage(content=DIAGRAM_SYSTEM_MESSAGE),
                HumanMessage(content=prompt),
            ]
            llm = self.model.with_config(
                {
                    "llm_temperature": 0.0,
                    "llm_streaming": True,
                    "llm_max_tokens": 5000,
                }
            )
            response_content = ""
            diagram_tag = f"diagram-{state['diagram_type']}"
            self._stream_update(f"<{diagram_tag}>", ToolStreamState.UPDATE)
            chunk_counter = 0
            try:
                for chunk in llm.stream(messages):
                    if isinstance(chunk, BaseMessage):
                        result = chunk.content or ""
                        chunk_counter += 1
                        response_content += result
                        self._stream_update(result, ToolStreamState.APPEND)
                        if chunk_counter % 10 == 0:
                            self.logger.debug(
                                "Generate node streamed %d chunks, total_len=%d",
                                chunk_counter,
                                len(response_content),
                            )
            except Exception:
                self.logger.exception(
                    "Exception while streaming LLM output in generate node"
                )
                raise
            self._stream_update(f"</{diagram_tag}>", ToolStreamState.APPEND)
            if chunk_counter == 0:
                self.logger.warning(
                    "No LLM chunks received in generate node. Check model configuration/connectivity."
                )
            # Extract & normalize
            diagram_code = self._extract_diagram_code(
                response_content, state["diagram_type"]
            )
            if not diagram_code.strip():
                self.logger.error(
                    "Extracted empty diagram code. Raw response snippet: %s",
                    response_content[:300].replace("\n", "\\n"),
                )
            normalized_code = self._normalize_diagram_code(
                state["diagram_type"], diagram_code
            )
            if normalized_code != diagram_code:
                self.logger.debug(
                    "Code normalized (len before=%d after=%d)",
                    len(diagram_code),
                    len(normalized_code),
                )
            return {**state, "diagram_code": normalized_code}
        finally:
            self._log_node_end(
                "generate",
                time.perf_counter() - start_t,
                {"code_len": len(state.get("diagram_code", ""))},
            )

    def _validate_node(self, state: DiagramGenerationState):
        start_t = time.perf_counter()
        self._log_node_start("validate")
        try:
            # ...existing code...
            # (retain prior implementation, just wrap for timing)
            self.logger.info(f"Validating {state['diagram_type']} diagram code...")
            self._stream_update(
                f"\n\n**Validating {state['diagram_type']} diagram syntax and structure...**",
                ToolStreamState.APPEND,
            )
            if state["diagram_type"] == "mermaid":
                is_valid, validation_message, details = validate_mermaid(
                    state["diagram_code"]
                )
            else:
                is_valid, validation_message, details = validate_graphviz(
                    state["diagram_code"]
                )
            self.logger.debug("Technical validation details: %s", details)
            if is_valid:
                self._stream_update(
                    f"\n✓ Technical validation passed: {validation_message}",
                    ToolStreamState.APPEND,
                )
            else:
                self._stream_update(
                    f"\n⚠️ Technical validation failed: {validation_message}",
                    ToolStreamState.APPEND,
                )
            if details.get("warnings"):
                for w in details["warnings"]:
                    self._stream_update(f"\n⚠️ Warning: {w}", ToolStreamState.APPEND)
            prompt = VALIDATE_DIAGRAM_PROMPT.format(
                diagram_type=state["diagram_type"],
                diagram_code=state["diagram_code"],
            )
            validate_llm = self.model.with_config(
                {"llm_temperature": 0.0, "llm_streaming": True}
            )
            llm_validation = ""
            self._stream_update(
                "\n\nPerforming detailed review...", ToolStreamState.APPEND
            )
            chunk_counter = 0
            try:
                for chunk in validate_llm.stream([HumanMessage(content=prompt)]):
                    if isinstance(chunk, BaseMessage):
                        llm_validation += chunk.content or ""
                        chunk_counter += 1
                        self._stream_update(".", ToolStreamState.APPEND)
            except Exception:
                self.logger.exception("LLM streaming failure in validate node")
                raise
            if chunk_counter == 0:
                self.logger.warning("No LLM chunks received in validate node.")
            validation_result = f"Technical validation: {validation_message}\n\nDetailed review: {llm_validation}".strip()
            if (
                is_valid
                and "valid" in llm_validation.lower()
                and not details.get("errors")
            ):
                self._stream_update(
                    "\n✓ Complete diagram validation passed!", ToolStreamState.APPEND
                )
                final_result = "Valid diagram with no issues detected."
            else:
                self._stream_update(
                    "\n⚠️ Validation issues detected. Diagram will be reviewed and fixed...",
                    ToolStreamState.APPEND,
                )
                final_result = validation_result
            return {
                **state,
                "validation_result": final_result,
                "validation_details": details,
            }
        finally:
            self._log_node_end("validate", time.perf_counter() - start_t)

    def _critique_node(self, state: DiagramGenerationState):
        start_t = time.perf_counter()
        self._log_node_start("critique")
        try:
            self.logger.info("Critiquing diagram...")
            self._stream_update(
                f"\n\n**Review #{state.get('revisions', 0) + 1}: Evaluating diagram quality...**",
                ToolStreamState.APPEND,
            )
            critique_tag = f"critique-{state['diagram_type']}"
            self._stream_update(f"<{critique_tag}>", ToolStreamState.UPDATE)
            prompt = CRITIQUE_DIAGRAM_PROMPT.format(
                diagram_type=state["diagram_type"],
                description=state["diagram_description"],
                diagram_code=state["diagram_code"],
                validation_result=state["validation_result"],
            )
            critique_llm = self.model.with_config(
                {"llm_temperature": 0.0, "llm_streaming": True}
            )
            critique = ""
            chunk_counter = 0
            try:
                for chunk in critique_llm.stream([HumanMessage(content=prompt)]):
                    if isinstance(chunk, BaseMessage):
                        result = chunk.content or ""
                        critique += result
                        chunk_counter += 1
                        self._stream_update(result, ToolStreamState.APPEND)
            except Exception:
                self.logger.exception("LLM streaming failure in critique node")
                raise
            if chunk_counter == 0:
                self.logger.warning("No LLM chunks received in critique node.")
            self._stream_update(f"</{critique_tag}>", ToolStreamState.APPEND)
            if "no issues found" in critique.lower():
                self._stream_update(
                    "\n✓ Quality review passed! Diagram meets all requirements.",
                    ToolStreamState.APPEND,
                )
            else:
                self._stream_update(
                    "\n⚠️ Quality issues identified. Diagram will be improved...",
                    ToolStreamState.APPEND,
                )
            return {
                **state,
                "critique": critique,
                "revisions": state.get("revisions", 0) + 1,
            }
        finally:
            self._log_node_end("critique", time.perf_counter() - start_t)

    def _refine_node(self, state: DiagramGenerationState):
        start_t = time.perf_counter()
        self._log_node_start("refine")
        try:
            prompt = REFINE_DIAGRAM_PROMPT.format(
                diagram_type=state["diagram_type"],
                description=state["diagram_description"],
                diagram_code=state["diagram_code"],
                critique=state["critique"],
            )
            refine_llm = self.model.with_config(
                {"llm_temperature": 0.0, "llm_streaming": True}
            )
            refined_code = ""
            diagram_tag = f"diagram-{state['diagram_type']}"
            self._stream_update(f"<{diagram_tag}>", ToolStreamState.UPDATE)
            chunk_counter = 0
            try:
                for chunk in refine_llm.stream([HumanMessage(content=prompt)]):
                    if isinstance(chunk, BaseMessage):
                        result = chunk.content or ""
                        refined_code += result
                        chunk_counter += 1
                        self._stream_update(result, ToolStreamState.APPEND)
            except Exception:
                self.logger.exception("LLM streaming failure in refine node")
                raise
            if chunk_counter == 0:
                self.logger.warning("No LLM chunks received in refine node.")
            self._stream_update(f"</{diagram_tag}>", ToolStreamState.APPEND)
            diagram_code = self._extract_diagram_code(
                refined_code, state["diagram_type"]
            )
            diagram_code = self._normalize_diagram_code(
                state["diagram_type"], diagram_code
            )
            return {**state, "diagram_code": diagram_code}
        finally:
            self._log_node_end("refine", time.perf_counter() - start_t)

    def _should_refine(self, state: DiagramGenerationState):
        critique = state["critique"]
        revisions = state["revisions"]
        max_revs = state.get("max_revisions", self.max_revisions)
        if "no issues found" in critique.lower():
            self.logger.info("Critique found no issues. Ending.")
            return "end"
        if revisions >= max_revs:
            self.logger.warning("Max revisions reached. Ending.")
            self._stream_update(
                f"\n\nℹ️ Maximum number of revisions ({max_revs}) reached. Finalizing diagram.",
                ToolStreamState.APPEND,
            )
            return "end"
        self.logger.info("Critique found issues. Refining...")
        return "refine"

    def _extract_diagram_code(self, response: str, diagram_type: str) -> str:
        """Robust extraction of diagram code from LLM output."""
        fenced_patterns = [
            rf"```{diagram_type}([\s\S]*?)```",
            rf"```{'dot' if diagram_type == 'graphviz' else 'mermaid'}([\s\S]*?)```",
            r"```graphviz([\s\S]*?)```",
            r"```([\s\S]*?)```",
        ]
        for pat in fenced_patterns:
            m = re.search(pat, response, re.IGNORECASE)
            if m:
                code = m.group(1)
                return self._sanitize_code(code)
        # Fallback: take last code-like block separated by triple backticks or indent heuristics
        segments = re.split(r"```", response)
        if len(segments) > 1:
            return self._sanitize_code(segments[-2])
        return self._sanitize_code(response)

    def _sanitize_code(self, code: str) -> str:
        # Remove leading language hints and stray ticks
        cleaned = re.sub(
            r"^(mermaid|dot|graphviz)\n", "", code.strip(), flags=re.IGNORECASE
        )
        cleaned = cleaned.strip().strip("`")
        return cleaned.strip()

    def _normalize_diagram_code(self, diagram_type: str, code: str) -> str:
        """Normalize / auto-fix minimal or malformed diagram snippets returned by the LLM.

        Goals:
          - If Graphviz output omits digraph header/braces, wrap it.
          - If Mermaid output omits leading type line (e.g. starts straight with edges), add a sensible default.
          - Preserve user content; avoid adding duplicate fences.
        """
        original = code or ""
        if not original.strip():
            return original

        normalized = original.strip().strip("`")

        if diagram_type == "graphviz":
            # Detect presence of a graph header
            header_match = re.match(r"(?is)^\s*(strict\s+)?(di)?graph\b", normalized)
            if not header_match:
                # If it's only edges / node statements, wrap it.
                body = normalized
                # Ensure each statement ends with semicolon
                lines = [
                    line_item.strip()
                    for line_item in body.splitlines()
                    if line_item.strip()
                ]
                fixed_lines = []
                for line_item in lines:
                    if (
                        not line_item.endswith(";")
                        and not line_item.endswith("{")
                        and not line_item.endswith("}")
                    ):
                        fixed_lines.append(line_item + ";")
                    else:
                        fixed_lines.append(line_item)
                body_fixed = "\n  ".join(fixed_lines)
                normalized = f"digraph Diagram {{\n  {body_fixed}\n}}"
            else:
                # Ensure braces exist/balanced
                if normalized.count("{") == 0:
                    # add braces around remaining content after first line
                    parts = normalized.splitlines()
                    first = parts[0]
                    rest = "\n  ".join(p for p in parts[1:] if p.strip())
                    normalized = f"{first} {{\n  {rest}\n}}"
                # Balance braces if mismatched
                open_b = normalized.count("{")
                close_b = normalized.count("}")
                if open_b > close_b:
                    normalized += "\n}" * (open_b - close_b)
                elif close_b > open_b:
                    # Prepend opening braces (rare) – simpler approach
                    normalized = (
                        "digraph Diagram {\n" * (close_b - open_b)
                    ) + normalized
        else:  # mermaid
            # Known starting tokens
            mermaid_starts = (
                "graph ",
                "flowchart ",
                "sequenceDiagram",
                "classDiagram",
                "stateDiagram",
                "gantt",
                "pie ",
                "journey",
                "erDiagram",
            )
            first_line = (
                normalized.splitlines()[0].strip() if normalized.splitlines() else ""
            )
            if not any(first_line.startswith(tok) for tok in mermaid_starts):
                # Prepend a default flow direction
                normalized = "graph TD\n" + normalized
        if normalized != original:
            self.logger.debug(
                "Diagram code normalized (type=%s, before_len=%d, after_len=%d)",
                diagram_type,
                len(original),
                len(normalized),
            )
        return normalized

    def run(
        self,
        diagram_type: Literal["mermaid", "graphviz"],
        description: str,
        max_revisions: Optional[int] = None,
    ) -> str:
        run_start = time.perf_counter()
        self.logger.info(
            "[DiagramAgent] run() called with diagram_type=%s max_revisions=%s",
            diagram_type,
            max_revisions,
        )
        self._stream_update(
            f"Starting {diagram_type} diagram generation...", ToolStreamState.STARTED
        )
        effective_max = (
            max_revisions if max_revisions is not None else self.max_revisions
        )
        initial_state: DiagramGenerationState = {
            "diagram_type": diagram_type,
            "diagram_description": description,
            "diagram_code": "",
            "validation_result": "",
            "critique": "",
            "revisions": 0,
            "error": None,
            "validation_details": None,
            "max_revisions": effective_max,
        }
        try:
            self.logger.debug("Initial state: %s", initial_state)
            final_state = self.graph.invoke(initial_state)
            self.logger.debug("Final state: %s", final_state)
            self._stream_update(
                f"\n\n✅ {diagram_type.capitalize()} diagram generation completed!",
                ToolStreamState.ENDED,
            )
            return final_state["diagram_code"]
        except Exception as e:  # pragma: no cover
            error_message = f"Error during diagram generation: {str(e)}"
            self.logger.exception("Diagram generation failed")
            self._stream_update(f"\n\n❌ {error_message}", ToolStreamState.ENDED)
            return f"Error generating {diagram_type} diagram: {str(e)}"
        finally:
            self.logger.info(
                "[DiagramAgent] run() total duration %.3fs",
                time.perf_counter() - run_start,
            )
