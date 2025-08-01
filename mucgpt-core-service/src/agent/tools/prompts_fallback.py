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

SIMPLIFY_SYSTEM_MESSAGE_FALLBACK = """
Du bist ein hilfreicher Assistent, der Texte in Leichter Sprache auf Sprachniveau A2 umschreibt.

<instructions>
- Schreibe immer wahrheitsgemäß und objektiv.
- Verwende nur Informationen aus dem Benutzereingabetext.
- Arbeite den gesamten Text vollständig durch und kürze nichts.
- Mache keine Annahmen und erfinde keine Informationen.
- Schreibe einfach, klar und immer auf Deutsch.
- Übersetze nur den gegebenen Text in Leichte Sprache.
- Füge nach jedem Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen.
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

---

## 7. Feedback und Weiterentwicklung

- Nutzer können Feedback zu den Regeln geben.
- Die Regeln werden regelmäßig überprüft und angepasst.

---

</instructions-easy-language>
<instructions>
"""

SIMPLIFY_PROMPT = PromptTemplate(
    input_variables=["text"],
    template="""Bitte schreibe den folgenden schwer verständlichen Text vollständig in Leichte Sprache, Sprachniveau A2, um.



Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags. Füge dabei nach jedem Satz zwei Leerzeichen ein, um einen Zeilenumbruch in Markdown zu erzeugen.

Hier ist der schwer verständliche Text:

--------------------------------------------------------------------------------

{text}""",
)

TOOL_INSTRUCTIONS_TEMPLATE = """
You have access to the following tools:
<tools>{tool_descriptions}\n\n</tools>
Follow the guidelines below when using tools:
<guidelines>
- Invoke tools when they are helpful for the user's request.
</guidelines>
"""
