// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { canvasExtensions } from "./canvasExtensions";
import { computeCanvasChanges, diffHunks, diffWords } from "./canvasDiff";

const editors: Editor[] = [];

// Both documents must come from the same schema: ProseMirror node types are
// compared by identity, so two separate editors never produce equal nodes.
const editorFor = (): Editor => {
    const editor = new Editor({ extensions: canvasExtensions(), content: "" });
    editors.push(editor);
    return editor;
};

const docFrom = (editor: Editor, markdown: string): PMNode => {
    editor.commands.setContent(markdown);
    return editor.state.doc;
};

afterEach(() => {
    for (const editor of editors.splice(0)) {
        if (!editor.isDestroyed) editor.destroy();
    }
});

describe("diffWords", () => {
    it("merges tokens into equal/insert/delete segments", () => {
        expect(diffWords("Der Hund läuft schnell.", "Der Hund rennt sehr schnell.")).toEqual([
            { kind: "equal", text: "Der Hund " },
            { kind: "delete", text: "läuft" },
            { kind: "insert", text: "rennt" },
            { kind: "equal", text: " " },
            { kind: "insert", text: "sehr " },
            { kind: "equal", text: "schnell." }
        ]);
    });

    it("returns null beyond the safe inline size", () => {
        expect(diffWords("a".repeat(40_000), "b".repeat(40_000))).toBeNull();
    });
});

describe("diffHunks", () => {
    it("splits changes separated by unchanged words into independent hunks", () => {
        const hunks = diffHunks("Der Hund läuft schnell und bellt laut.", "Der Hund rennt schnell und bellt leise.");
        expect(hunks).toEqual([
            { oldStart: 9, oldEnd: 14, newStart: 9, newEnd: 14, oldText: "läuft", newText: "rennt" },
            { oldStart: 33, oldEnd: 38, newStart: 33, newEnd: 39, oldText: "laut.", newText: "leise." }
        ]);
    });

    it("reports insertion-only and deletion-only hunks", () => {
        expect(diffHunks("Der Hund bellt heute.", "Der Hund bellt auch heute.")).toEqual([
            { oldStart: 15, oldEnd: 15, newStart: 15, newEnd: 20, oldText: "", newText: "auch " }
        ]);
        expect(diffHunks("Der Hund bellt auch heute.", "Der Hund bellt heute.")).toEqual([
            { oldStart: 15, oldEnd: 20, newStart: 15, newEnd: 15, oldText: "auch ", newText: "" }
        ]);
    });
});

describe("computeCanvasChanges", () => {
    it("reports no changes for identical documents", () => {
        const editor = editorFor();
        expect(computeCanvasChanges(docFrom(editor, "Gleicher Text"), docFrom(editor, "Gleicher Text"))).toEqual([]);
    });

    it("reports an inserted block run", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Erster Absatz"), docFrom(editor, "Erster Absatz\n\nZweiter Absatz"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "insert", oldText: "" });
        expect(changes[0].oldSliceJson).toBeNull();
        expect(changes[0].to).toBeGreaterThan(changes[0].from);
    });

    it("reports a deleted block run with the restorable baseline content", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Erster Absatz\n\nZweiter Absatz"), docFrom(editor, "Erster Absatz"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "delete", oldText: "Zweiter Absatz" });
        expect(changes[0].oldSliceJson).not.toBeNull();
        expect(changes[0].from).toBe(changes[0].to);
    });

    it("splits a rewritten paragraph into independent phrase hunks", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(
            docFrom(editor, "Der Hund läuft schnell und bellt laut."),
            docFrom(editor, "Der Hund rennt schnell und bellt leise.")
        );

        expect(changes).toHaveLength(2);
        expect(changes.map(change => ({ level: change.level, kind: change.kind, oldText: change.oldText, summary: change.summary }))).toEqual([
            { level: "inline", kind: "replace", oldText: "läuft", summary: "rennt" },
            { level: "inline", kind: "replace", oldText: "laut.", summary: "leise." }
        ]);
        for (const change of changes) {
            expect(change.from).toBeLessThan(change.to);
            expect(change.oldSliceJson).not.toBeNull();
        }
    });

    it("merges hunks separated by at most two unchanged words", () => {
        const hunks = diffHunks(
            "Der schnelle braune Hund läuft hier heute schnell durch den großen Garten.",
            "Der schnelle braune Hund rennt hier heute rasch durch den großen Garten."
        );
        expect(hunks).toHaveLength(1);
        expect(hunks![0].oldText).toContain("läuft hier heute schnell");
        expect(hunks![0].newText).toContain("rennt hier heute rasch");
    });

    it("makes a fundamental rewrite one decision between the complete strings", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(
            docFrom(editor, "Falls zusätzliche Informationen benötigt werden"),
            docFrom(editor, "Sollten Sie zur Klärung weitere Angaben benötigen")
        );

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "inline", kind: "replace" });
        expect(changes[0].oldText).toBe("Falls zusätzliche Informationen benötigt werden");
        expect(changes[0].summary).toBe("Sollten Sie zur Klärung weitere Angaben benötigen");
        expect(changes[0].oldSliceJson).not.toBeNull();
    });

    it("reports inline insertion and deletion hunks", () => {
        const editor = editorFor();
        const inserted = computeCanvasChanges(docFrom(editor, "Der Hund bellt heute."), docFrom(editor, "Der Hund bellt auch heute."));
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({ level: "inline", kind: "insert", oldText: "" });
        expect(inserted[0].oldSliceJson).toBeNull();
        expect(inserted[0].from).toBeLessThan(inserted[0].to);

        const deleted = computeCanvasChanges(docFrom(editor, "Der Hund bellt auch heute."), docFrom(editor, "Der Hund bellt heute."));
        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toMatchObject({ level: "inline", kind: "delete", oldText: "auch " });
        expect(deleted[0].oldSliceJson).not.toBeNull();
        expect(deleted[0].from).toBe(deleted[0].to);
    });

    it("reviews adjacent rewritten paragraphs as separate inline changes", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Erster Absatz\n\nZweiter Absatz"), docFrom(editor, "Dritter Absatz\n\nVierter Absatz"));

        expect(changes).toHaveLength(2);
        expect(changes.every(change => change.level === "inline")).toBe(true);
        expect(changes.map(change => change.summary)).toEqual(["Dritter Absatz", "Vierter Absatz"]);
    });

    it("keeps structural changes at block level", () => {
        const editor = editorFor();
        const table = "| A | B |\n| --- | --- |\n| 1 | 2 |";
        const changes = computeCanvasChanges(docFrom(editor, `# Titel\n\n${table}`), docFrom(editor, `## Titel\n\n${table}`));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace", oldText: "Titel" });
    });

    it("keeps table edits at block level", () => {
        const editor = editorFor();
        const oldTable = "| A | B |\n| --- | --- |\n| 1 | 2 |";
        const newTable = "| A | B |\n| --- | --- |\n| 1 | 3 |";
        const changes = computeCanvasChanges(docFrom(editor, oldTable), docFrom(editor, newTable));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace", oldText: "A | B\n1 | 2" });
    });

    it("keeps merge/split runs with unequal block counts as one block change", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "A\n\nB"), docFrom(editor, "A\n\nX\n\nY"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace", oldText: "B" });
    });

    it("keeps a multi-block deletion run as one change", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "A\n\nB\n\nC"), docFrom(editor, "A"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "delete", oldText: "B\nC" });
    });

    it("keeps hard-break paragraphs at block level", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Line one\\\nline two"), docFrom(editor, "Line one\\\nline three"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace" });
    });
});
