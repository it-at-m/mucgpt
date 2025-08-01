from langchain_core.prompts import PromptTemplate

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

SIMPLIFY_SYSTEM_MESSAGE_FALLBACK = """Du bist ein hilfreicher Assistent, der Texte in Leichte Sprache, Sprachniveau A2, umschreibt. Sei immer wahrheitsgemäß und objektiv. Schreibe nur das, was du sicher aus dem Text des Benutzers weisst. Arbeite die Texte immer vollständig durch und kürze nicht. Mache keine Annahmen. Schreibe einfach und klar und immer in deutscher Sprache. Gib dein Ergebnis innerhalb von <einfachesprache> Tags aus. Füge dabei nach JEDEM Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen. Beachte ALLE Regeln der Leichten Sprache."""

SIMPLIFY_RULES_FALLBACK = """# Wortebene
## Wortschatz
- Wörter sollten kurz sein.
- Wörter sollten anschaulich sein.
- Wörter sollten häufig verwendet werden.
- Wörter sollten alltagsnah sein.

## Synonyme
- Vermeiden Sie verschiedene Bezeichnungen für dasselbe innerhalb desselben Textes.
- Bezeichnen Sie Gleiches immer gleich im Text."""

SIMPLIFY_PROMPT = PromptTemplate(
    input_variables=["rules", "message"],
    template="""Bitte schreibe den folgenden schwer verständlichen Text vollständig in Leichte Sprache, Sprachniveau A2, um.

Beachte dabei folgende Regeln für Leichte Sprache (A2):

{rules}

Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags. Füge dabei nach jedem Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen.

Hier ist der schwer verständliche Text:

--------------------------------------------------------------------------------

{message}""",
)

TOOL_INSTRUCTIONS_TEMPLATE = """
You have access to the following tools:
<tools>{tool_descriptions}\n\n</tools>
Follow the guidelines below when using tools:
<guidelines>
- Invoke tools when they are helpful for the user's request.
</guidelines>
"""


def get_brainstorm_prompt(topic, context=None):
    context_str = f"\n\nAdditional context: {context}" if context else ""
    return BRAINSTORM_PROMPT.format(topic=topic, context=context_str)


def get_fallback_rules():
    return SIMPLIFY_RULES_FALLBACK


def get_fallback_prompt():
    """Return the fallback simplify prompt as a PromptTemplate."""
    return SIMPLIFY_PROMPT
