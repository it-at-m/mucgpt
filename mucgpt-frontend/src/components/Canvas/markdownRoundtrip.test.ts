// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";

import { canvasExtensions } from "./canvasExtensions";

/**
 * Round-trip property test: the markdown serializer must be
 * idempotent for every structure the canvas allows —
 * serialize(parse(serialize(doc))) == serialize(doc). Fixture-driven.
 */
const FIXTURES: Array<{ name: string; markdown: string }> = [
    {
        name: "paragraph with inline marks",
        markdown: "Einfacher Text mit **fett**, *kursiv*, `Code` und einem [Link](https://muenchen.de)."
    },
    {
        name: "headings",
        markdown: "# Überschrift 1\n\n## Überschrift 2\n\n### Überschrift 3\n\nText danach."
    },
    {
        name: "nested lists",
        markdown: "- Erster Punkt\n  - Verschachtelt\n    - Doppelt verschachtelt\n- Zweiter Punkt\n\n1. Erster Schritt\n2. Zweiter Schritt"
    },
    {
        name: "hard breaks",
        markdown: "Erste Zeile\nZweite Zeile im selben Absatz."
    },
    {
        name: "blockquote",
        markdown: "> Ein zitiertes Verwaltungsstück.\n>\n> Zweite Zitatzeile."
    },
    {
        name: "code block",
        markdown: "```text\nfunction render() {\n    return list;\n}\n```"
    },
    {
        name: "table",
        markdown: "| Verfahren | Zuständigkeit | Frist |\n| --- | --- | --- |\n| Auskunft | Amt A | 2 Wochen |\n| Genehmigung | Amt B | 6 Wochen |"
    },
    {
        name: "table with alignment",
        markdown: "| Verfahren | Zuständigkeit |\n| :--- | ---: |\n| Auskunft | Amt A |"
    },
    {
        name: "lists inside tables and blockquotes",
        markdown: "> - zitierter Punkt\n> - zweiter zitatpunkt\n\n| Spalte |\n| --- |\n| Inhalt |"
    },
    {
        name: "mixed document",
        markdown:
            "# Bescheid\n\nEinleitender Satz mit **Hervorhebung**.\n\n- [Bescheid](https://muenchen.de) prüfen\n- Frist beachten\n\n| Schritt | Status |\n| --- | --- |\n| Antrag | offen |\n\n> Hinweis: Fristen gelten ab Zustellung."
    }
];

const serialize = (editor: Editor): string => {
    const storage = (editor.storage as unknown as Record<string, { serializer: { serialize(node: unknown): string } }>).markdown;
    return storage.serializer.serialize(editor.state.doc);
};

describe("markdown round trip", () => {
    for (const fixture of FIXTURES) {
        it(`is idempotent for: ${fixture.name}`, () => {
            const editor = new Editor({ extensions: canvasExtensions, content: fixture.markdown });
            try {
                const first = serialize(editor);
                editor.commands.setContent(first);
                const second = serialize(editor);
                expect(second).toBe(first);
            } finally {
                editor.destroy();
            }
        });
    }
});
