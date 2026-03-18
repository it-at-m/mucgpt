import logging
from typing import Optional, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables.base import RunnableSerializable
from langgraph.graph import END, StateGraph
from langgraph.types import StreamWriter

from agent.tools.tool_chunk import ToolStreamChunk, ToolStreamState


# Agent State
class ReflectiveSimplificationState(TypedDict):
    original_text: str
    simplified_text: str
    critique: str
    revisions: int
    error: Optional[str]


# Prompts
SIMPLFIY_RULES = """

<instructions>
- Schreibe immer wahrheitsgemäß und objektiv.
- Verwende nur Informationen aus dem Benutzereingabetext.
- Arbeite den gesamten Text vollständig durch und kürze nichts.
- Mache keine Annahmen und erfinde keine Informationen.
- Schreibe einfach, klar und immer auf Deutsch.
- Übersetze nur den gegebenen Text in Leichte Sprache.
- Schreibe jeden Satz in eine eigene Zeile.
- Gib bei Links immer nur den Link selbst zurück.
- Erstelle niemals eigenständig Links.
- Beachte alle folgenden Regeln für Leichte Sprache (A2):
<instructions-easy-language>
# Regeln für die Umformulierung in Leichte Sprache

## Inhaltsverzeichnis

1. Zielgruppe und Zweck
2. Wortebene
3. Satzebene
4. Textebene
5. Typographie und Layout
6. URLs und Links
7. Feedback und Weiterentwicklung

---

## 1. Zielgruppe und Zweck

Diese Regeln richten sich an Sprachmodelle und Menschen, die Texte in Leichte Sprache umformulieren. Ziel ist es, Texte für Menschen mit kognitiven Einschränkungen, Sprachlernende und alle, die einfache Sprache benötigen, verständlich zu machen.

---

## 2. Wortebene

### 2.1 Wortschatz

- Verwende kurze, anschauliche und häufig genutzte Wörter aus dem Alltag.
- Vermeide Fach- und Fremdwörter. Wenn sie notwendig sind, erkläre sie einfach.
- Vermeide Synonyme für dasselbe Wort im Text. Benenne Gleiches immer gleich.
- Vermeide Metaphern, Ironie und bildhafte Sprache, außer sie sind allgemein bekannt und werden erklärt.

**Beispiel:**

- Falsch: „Das ist ein Kinderspiel.“
- Richtig: „Das ist sehr einfach.“

### 2.2 Erläuterungen

- Erkläre schwierige Begriffe mit einfachen Worten oder Beispielen.
- Die Erklärung kann vor oder nach dem Begriff stehen.
- Hebe Erklärungen visuell hervor (z. B. durch Einrückung oder Fettdruck).

**Beispiel:**

- „Sie haben sehr starke Kopfschmerzen. Dann haben Sie vielleicht Migräne.“
- „Vielleicht haben Sie Migräne. Das sind sehr starke Kopfschmerzen.“

### 2.3 Abkürzungen und Kurzwörter

- Verwende nur geläufige Abkürzungen (z. B. „Lkw“, „Kita“).
- Erkläre alle anderen Abkürzungen beim ersten Auftreten.
- Schreibe Mengen- und Längenangaben aus, wenn sie nicht allgemein bekannt sind.

| Erlaubt | Nicht erlaubt / Erklären |
| :--- | :--- |
| Lkw, Kita, WC | GroKo (Große Koalition) |

### 2.4 Lange und schwer lesbare Wörter

- Vermeide lange Wörter (mehr als drei Silben) und solche, die nicht zum zentralen Wortschatz gehören.
- Gliedere lange Wörter mit Bindestrich oder Mediopunkt.

**Beispiel:**

- Falsch: „Blutdruckmessgerät“
- Richtig: „Mit dem Gerät misst man den Blutdruck.“

### 2.5 Zahlen und Zeichen

- Schreibe Zahlen als Ziffern (z. B. 5, 10, 100).
- Verwende arabische Ziffern, keine römischen.
- Schreibe Zeitangaben als „Stunden Punkt Minuten Uhr“ (z. B. 14.00 Uhr).
- Vermeide hohe Zahlen und Prozentangaben, nutze stattdessen Begriffe wie „viele“ oder „einige“.

---

## 3. Satzebene

- Bilde kurze Sätze mit maximal 15 Wörtern.
- Jeder Satz enthält nur eine Aussage.
- Verwende eine einfache Satzstruktur (Subjekt-Prädikat-Objekt).
- Vermeide Nebensätze, Konjunktiv und Passiv.

**Beispiel:**

- Falsch: „Nachdem der Antrag, der viele Seiten umfasste, eingereicht worden war, wurde er geprüft.“
- Richtig: „Sie haben einen Antrag gestellt. Der Antrag hatte viele Seiten. Jemand hat den Antrag geprüft.“

---

## 4. Textebene

- Gliedere den Text in kurze Abschnitte mit eigenen Überschriften.
- Fasse zusammengehörige Informationen in einem Absatz zusammen.
- Verwende Aufzählungen und Listen, um Informationen übersichtlich darzustellen.
- Spreche die Leser direkt an (z. B. „Sie können ...“).

---

## 5. Typographie und Layout

- Verwende eine große, gut lesbare Schriftart (z. B. Arial, Verdana).
- Wähle eine Schriftgröße von mindestens 14 Punkt.
- Sorge für einen hohen Kontrast zwischen Schrift und Hintergrund.
- Verwende Fettdruck zur Hervorhebung, aber sparsam.

---

## 6. URLs und Links

- Verwende sprechende Linktexte, die das Linkziel beschreiben.
- Vermeide lange, komplexe URLs.

**Beispiel:**

- Falsch: [Klicken Sie hier](https://example.com/page123)
- Richtig: [Weitere Informationen zur Anmeldung](https://example.com/anmeldung)


</instructions-easy-language>
<instructions>
"""

SIMPLIFY_SYSTEM_MESSAGE = (
    """
Du bist ein hilfreicher Assistent, der Texte in Leichter Sprache auf Sprachniveau A2 umschreibt.

"""
    + SIMPLFIY_RULES
)


SIMPLIFY_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""Bitte schreibe den folgenden schwer verständlichen Text vollständig in Leichte Sprache, Sprachniveau A2, um.


Hier ist der schwer verständliche Text:

--------------------------------------------------------------------------------

{text}""",
)


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
{rules}

Provide a concise, point-by-point critique. Identify every rule violation, such as sentences over 15 words, use of passive voice, complex words, or missing line breaks. If the text is good, respond with "No issues found."

Critique:
""",
)

REFINE_PROMPT = PromptTemplate(
    input_variables=["simplified_text", "critique"],
    template="""You are an expert editor for Leichte Sprache (Easy Language).
Your task is to revise a text based on a critique.

Text to Revise:
{simplified_text}

Critique:
{critique}

Please rewrite the entire text, incorporating all the feedback from the critique to ensure it fully complies with Easy Language rules.

Revised Text:
""",
)

MAX_REVISIONS = 5
GENERATE_SECTION = "SIMPLIFY_GENERATE"
CRITIQUE_SECTION = "SIMPLIFY_CRITIQUE"
REFINE_SECTION = "SIMPLIFY_REFINE"


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

    def _start_stream_section(self, section_name: str, revision: int):
        tag: str = f"<{section_name} revision={revision}>"
        self._stream_update(tag, ToolStreamState.APPEND)

    def _end_stream_section(self, section_name):
        tag: str = f"</{section_name}>"
        self._stream_update(tag, ToolStreamState.APPEND)

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

        prompt = SIMPLIFY_PROMPT.format(text=state["original_text"])
        messages = [
            SystemMessage(content=SIMPLIFY_SYSTEM_MESSAGE),
            HumanMessage(content=prompt),
        ]

        llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
                "llm_streaming": True,  # Enable streaming
            }
        )

        # Stream the response
        self._start_stream_section(
            section_name=GENERATE_SECTION, revision=state.get("revisions", 0)
        )
        response_content = ""
        for chunk in llm.stream(messages):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                response_content += result
                self._stream_update(result, ToolStreamState.APPEND)

        self._end_stream_section(section_name=GENERATE_SECTION)

        return {
            **state,
            "simplified_text": response_content.strip(),
        }

    def _critique_node(self, state: ReflectiveSimplificationState):
        self.logger.info("Critiquing simplified text...")

        prompt = CRITIQUE_PROMPT.format(
            original_text=state["original_text"],
            simplified_text=state["simplified_text"],
            rules=SIMPLFIY_RULES,
        )

        critique_llm = self.model.with_config(
            {
                "llm_temperature": 0.0,
                "llm_streaming": True,  # Enable streaming
            }
        )

        critique = ""
        self._start_stream_section(
            section_name=CRITIQUE_SECTION, revision=state.get("revisions", 0)
        )
        for chunk in critique_llm.stream([HumanMessage(content=prompt)]):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                critique += result
                self._stream_update(result, ToolStreamState.APPEND)
        self._end_stream_section(section_name=CRITIQUE_SECTION)

        if "no issues found" in critique.lower():
            self._stream_update(
                "\n**Ergebnis:** Qualitätsprüfung ohne Beanstandungen.",
                ToolStreamState.APPEND,
            )
        else:
            self._stream_update(
                "\n**Ergebnis:** Qualitätsprobleme erkannt. Text wird überarbeitet.",
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
        self._start_stream_section(
            section_name=REFINE_SECTION, revision=state.get("revisions")
        )
        refined_text = ""
        for chunk in refine_llm.stream([HumanMessage(content=prompt)]):
            if isinstance(chunk, BaseMessage):
                result = chunk.content
                refined_text += result
                self._stream_update(result, ToolStreamState.APPEND)
        self._end_stream_section(section_name=REFINE_SECTION)
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
                f"\n\nMaximale Anzahl an Überarbeitungen ({MAX_REVISIONS}) erreicht.",
                ToolStreamState.APPEND,
            )
            return "end"
        self.logger.info("Critique found issues. Refining...")
        return "refine"

    def run(self, original_text: str) -> str:
        self._stream_update(
            "**Vereinfachungsprozess gestartet.**", ToolStreamState.STARTED
        )

        initial_state = {
            "original_text": original_text,
            "simplified_text": "",  # Initialize with empty string
            "critique": "",
            "revisions": 0,
            "error": None,
        }

        try:
            final_state = self.graph.invoke(initial_state)
            self._stream_update(
                "\n\n**Textvereinfachung abgeschlossen.**", ToolStreamState.ENDED
            )
            return final_state["simplified_text"]
        except Exception as e:
            error_message = f"Fehler während der Vereinfachung: {str(e)}"
            self.logger.error(error_message)
            self._stream_update(
                f"\n\nFehler beim Vereinfachen: {error_message}",
                ToolStreamState.ENDED,
            )
            return f"Fehler beim Vereinfachen des Textes: {str(e)}"
