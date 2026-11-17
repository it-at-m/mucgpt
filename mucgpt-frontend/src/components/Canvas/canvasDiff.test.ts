// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { canvasExtensions } from "./canvasExtensions";
import { computeCanvasChanges, diffWords } from "./canvasDiff";

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

describe("computeCanvasChanges", () => {
    it("reports no changes for identical documents", () => {
        const editor = editorFor();
        expect(computeCanvasChanges(docFrom(editor, "Gleicher Text"), docFrom(editor, "Gleicher Text"))).toEqual([]);
    });

    it("reports an inserted block run", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Erster Absatz"), docFrom(editor, "Erster Absatz\n\nZweiter Absatz"));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("insert");
        expect(changes[0].oldSliceJson).toBeNull();
        expect(changes[0].from).toBeGreaterThan(0);
        expect(changes[0].to).toBeGreaterThan(changes[0].from);
    });

    it("reports a deleted block run with the restorable baseline content", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Erster Absatz\n\nZweiter Absatz"), docFrom(editor, "Erster Absatz"));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("delete");
        expect(changes[0].oldSliceJson).not.toBeNull();
        expect(changes[0].oldLines).toEqual(["Zweiter Absatz"]);
        expect(changes[0].from).toBe(changes[0].to);
    });

    it("uses an inline word diff for a rewritten paragraph", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Der Hund läuft schnell."), docFrom(editor, "Der Hund rennt sehr schnell."));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("replace");
        expect(changes[0].inline).toBeDefined();
        expect(changes[0].oldSliceJson).not.toBeNull();
        expect(changes[0].inline?.some(segment => segment.kind === "delete")).toBe(true);
        expect(changes[0].inline?.some(segment => segment.kind === "insert")).toBe(true);
    });

    it("keeps structural changes at block level", () => {
        const editor = editorFor();
        const table = "| A | B |\n| --- | --- |\n| 1 | 2 |";
        const changes = computeCanvasChanges(docFrom(editor, `# Titel\n\n${table}`), docFrom(editor, `## Titel\n\n${table}`));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("replace");
        expect(changes[0].inline).toBeUndefined();
        expect(changes[0].oldLines).toEqual(["Titel"]);
    });

    it("keeps table edits at block level", () => {
        const editor = editorFor();
        const oldTable = "| A | B |\n| --- | --- |\n| 1 | 2 |";
        const newTable = "| A | B |\n| --- | --- |\n| 1 | 3 |";
        const changes = computeCanvasChanges(docFrom(editor, oldTable), docFrom(editor, newTable));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("replace");
        expect(changes[0].inline).toBeUndefined();
        expect(changes[0].oldLines).toEqual(["A | B", "1 | 2"]);
    });

    it("groups non-equal runs between unchanged blocks", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "A\n\nB\n\nC"), docFrom(editor, "A\n\nX\n\nY\n\nC"));
        expect(changes).toHaveLength(1);
        expect(changes[0].kind).toBe("replace");
        expect(changes[0].oldLines).toEqual(["B"]);
    });
});
