import { describe, expect, it } from "vitest";
import { markdownToSpeechText } from "./markdownToSpeechText";

describe("markdownToSpeechText", () => {
    it("keeps plain prose unchanged", () => {
        expect(markdownToSpeechText("Einfacher Satz ohne Markup.")).toBe("Einfacher Satz ohne Markup.");
    });

    it("returns empty string for empty input", () => {
        expect(markdownToSpeechText("")).toBe("");
    });

    it("drops fenced code blocks entirely, including unterminated ones", () => {
        expect(markdownToSpeechText("Before\n```python\nprint('hi')\n```\nAfter")).toBe("Before After");
        expect(markdownToSpeechText("Before\n```python\nprint('hi')")).toBe("Before");
    });

    it("drops display and inline LaTeX", () => {
        expect(markdownToSpeechText("Siehe \\[ E = mc^2 \\] genau.")).toBe("Siehe genau.");
        expect(markdownToSpeechText("Siehe $$ E = mc^2 $$ genau.")).toBe("Siehe genau.");
        expect(markdownToSpeechText("Fläche \\( A = x^2 \\) groß.")).toBe("Fläche groß.");
        expect(markdownToSpeechText("Wert $x_1$ setzen.")).toBe("Wert setzen.");
    });

    it("replaces links with their label and drops images", () => {
        expect(markdownToSpeechText("[München](https://muenchen.de) ist schön.")).toBe("München ist schön.");
        expect(markdownToSpeechText("![Logo](https://example.org/logo.png) Text")).toBe("Text");
    });

    it("drops table rows but keeps list and heading text", () => {
        const markdown = ["## Überschrift", "", "| A | B |", "|---|---|", "| 1 | 2 |", "", "- Punkt eins", "2. Punkt zwei"].join("\n");
        const result = markdownToSpeechText(markdown);
        expect(result).toContain("Überschrift");
        expect(result).toContain("Punkt eins");
        expect(result).toContain("Punkt zwei");
        expect(result).not.toContain("|");
        expect(result).not.toContain("#");
        expect(result).not.toContain("-");
    });

    it("strips emphasis markers and inline code backticks", () => {
        expect(markdownToSpeechText("**Wichtig** und *dezent* und `code()` und ~~weg~~")).toBe("Wichtig und dezent und code() und weg");
    });

    it("keeps blockquote text without the marker", () => {
        expect(markdownToSpeechText("> Zitatzeile")).toBe("Zitatzeile");
    });

    it("yields an empty string when there is nothing speakable", () => {
        expect(markdownToSpeechText("```\nonly code\n```")).toBe("");
        expect(markdownToSpeechText("| a | b |\n|---|---|")).toBe("");
    });
});
