// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";

import { canvasExtensions } from "./canvasExtensions";
import { computeCanvasChanges, describeCanvasDiff, diffHunks, diffWords } from "./canvasDiff";

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

    it("auto-accepts whitespace-only edits instead of floating review controls", () => {
        const editor = editorFor();
        expect(computeCanvasChanges(docFrom(editor, "Der Hund läuft schnell."), docFrom(editor, "Der  Hund läuft schnell."))).toEqual([]);
        // Same for a whitespace-only bullet edit (must not fall back to a
        // whole-item block change).
        expect(computeCanvasChanges(docFrom(editor, "- Der Hund läuft schnell."), docFrom(editor, "- Der  Hund läuft schnell."))).toEqual([]);
    });

    it("splits a rewritten paragraph into independent phrase hunks", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(
            docFrom(editor, "Der Hund läuft schnell und bellt laut."),
            docFrom(editor, "Der Hund rennt schnell und bellt leise.")
        );

        expect(changes).toHaveLength(2);
        expect(changes.map(change => ({ level: change.level, kind: change.kind, oldText: change.oldText, newText: change.newText }))).toEqual([
            { level: "inline", kind: "replace", oldText: "läuft", newText: "rennt" },
            { level: "inline", kind: "replace", oldText: "laut.", newText: "leise." }
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
        expect(changes[0].newText).toBe("Sollten Sie zur Klärung weitere Angaben benötigen");
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
        expect(changes.map(change => change.newText)).toEqual(["Dritter Absatz", "Vierter Absatz"]);
    });

    it("diffs a bullet list per item and only marks the changed bullet", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(
            docFrom(editor, "- Der Hund läuft schnell\n- Zweiter Punkt"),
            docFrom(editor, "- Der Hund rennt schnell\n- Zweiter Punkt")
        );

        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "inline", kind: "replace", oldText: "läuft", newText: "rennt" });
        expect(changes[0].previewPrefix).toBe("• ");
    });

    it("reports inserted and deleted bullets as prefixed item changes", () => {
        const editor = editorFor();
        const inserted = computeCanvasChanges(docFrom(editor, "- A\n- B"), docFrom(editor, "- A\n- Neuer Punkt\n- B"));
        expect(inserted).toHaveLength(1);
        expect(inserted[0]).toMatchObject({ level: "block", kind: "insert", oldText: "", newText: "• Neuer Punkt" });

        const deleted = computeCanvasChanges(docFrom(editor, "- A\n- B\n- C"), docFrom(editor, "- A\n- C"));
        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toMatchObject({ level: "block", kind: "delete", oldText: "• B", newText: "" });
    });

    it("keeps ordered list numbering in the item marker", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "1. Eins\n2. Zwei"), docFrom(editor, "1. Eins geändert\n2. Zwei"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "inline", oldText: "Eins", newText: "Eins geändert", previewPrefix: "1. " });
    });

    it("reviews a list type change as one whole-list change", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "- A\n- B"), docFrom(editor, "1. A\n2. B"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace", oldText: "• A\n• B", newText: "1. A\n2. B" });
    });

    it("reviews an item with a nested list as one coarse item change", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "- Punkt mit Unterliste\n  - Unter A"), docFrom(editor, "- Punkt mit Unterliste\n  - Unter B"));
        expect(changes).toHaveLength(1);
        expect(changes[0]).toMatchObject({ level: "block", kind: "replace" });
        expect(changes[0].oldText.startsWith("• ")).toBe(true);
    });

    it("carries formatted fragments for both sides of a change", () => {
        const editor = editorFor();
        // Inline phrase hunks carry their text fragment without a list wrapper.
        const inline = computeCanvasChanges(
            docFrom(editor, "- Der Hund läuft schnell\n- Zweiter Punkt"),
            docFrom(editor, "- Der Hund rennt schnell\n- Zweiter Punkt")
        );
        expect(inline[0].oldFragmentTag).toBeUndefined();
        expect(JSON.stringify(inline[0].oldFragmentJson)).toContain("läuft");
        expect(JSON.stringify(inline[0].newFragmentJson)).toContain("rennt");

        // Item-level changes wrap their fragments in the list container.
        const inserted = computeCanvasChanges(docFrom(editor, "- A\n- B"), docFrom(editor, "- A\n- Neuer Punkt\n- B"));
        expect(inserted[0].newFragmentTag).toBe("ul");
        expect(JSON.stringify(inserted[0].newFragmentJson)).toContain("listItem");
        expect(inserted[0].oldFragmentJson).toBeUndefined();
    });

    it("keeps character marks in inline change fragments", () => {
        const editor = editorFor();
        const changes = computeCanvasChanges(docFrom(editor, "Der **alte** Hund."), docFrom(editor, "Der **neue** Hund."));
        expect(changes).toHaveLength(1);
        expect(changes[0].level).toBe("inline");
        expect(JSON.stringify(changes[0].oldFragmentJson)).toContain("bold");
        expect(JSON.stringify(changes[0].newFragmentJson)).toContain("bold");
    });

    it("carries fragments for unchanged preview blocks", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "A\n\nB"), docFrom(editor, "A\n\nB"));
        expect(items.every(item => Array.isArray(item.newFragmentJson))).toBe(true);
    });

    it("keeps list item markers in the static preview", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(
            docFrom(editor, "- Der Hund läuft schnell\n- Zweiter Punkt"),
            docFrom(editor, "- Der Hund rennt schnell\n- Zweiter Punkt")
        );
        expect(items.map(item => item.kind)).toEqual(["replace", "equal"]);
        expect(items[0]).toMatchObject({ kind: "replace", oldLines: ["• läuft"], newLines: ["• rennt"] });
        expect(items[1].newLines).toEqual(["• Zweiter Punkt"]);
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

describe("describeCanvasDiff", () => {
    it("reports unchanged documents as equal blocks", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "A\n\nB"), docFrom(editor, "A\n\nB"));
        expect(items.map(item => item.kind)).toEqual(["equal", "equal"]);
        expect(items[0]).toMatchObject({ kind: "equal", oldLines: [], newLines: ["A"] });
    });

    it("pairs a single changed block between unchanged blocks", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "Bleibt\n\nEntfällt"), docFrom(editor, "Bleibt\n\nNeu"));
        expect(items.map(item => item.kind)).toEqual(["equal", "replace"]);
        expect(items[0].newLines).toEqual(["Bleibt"]);
        expect(items[1]).toMatchObject({ kind: "replace", oldLines: ["Entfällt"], newLines: ["Neu"] });
    });

    it("keeps unchanged header/footer and pairs each changed block in between", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "Header\n\nEins\n\nZwei\n\nFooter"), docFrom(editor, "Header\n\nEins neu\n\nZwei neu\n\nFooter"));

        expect(items.map(item => item.kind)).toEqual(["equal", "replace", "replace", "equal"]);
        expect(items[0].newLines).toEqual(["Header"]);
        expect(items[1]).toMatchObject({ kind: "replace", oldLines: ["Eins"], newLines: ["Eins neu"] });
        expect(items[2]).toMatchObject({ kind: "replace", oldLines: ["Zwei"], newLines: ["Zwei neu"] });
        expect(items[3].newLines).toEqual(["Footer"]);
    });

    it("keeps merge/split runs as one grouped item", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "A\n\nB"), docFrom(editor, "A\n\nX\n\nY"));
        expect(items.map(item => item.kind)).toEqual(["equal", "replace"]);
        expect(items[1]).toMatchObject({ kind: "replace", oldLines: ["B"], newLines: ["X", "Y"] });
    });

    it("marks a deleted block as a delete item", () => {
        const editor = editorFor();
        const items = describeCanvasDiff(docFrom(editor, "A\n\nB"), docFrom(editor, "A"));
        expect(items.map(item => item.kind)).toEqual(["equal", "delete"]);
        expect(items[1]).toMatchObject({ kind: "delete", oldLines: ["B"], newLines: [] });
    });
});
