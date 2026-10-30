// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

import { CANVAS_EXPORT_LIMIT_CHARS, CANVAS_WARN_CHARS } from "./canvasLimits";
import { CANVAS_PASTE_CLIPPED_EVENT, canvasTextLimitKey, textLength, textPosForCharIndex } from "./canvasTextLimit";
import { canvasExtensions } from "./canvasExtensions";

// The initial editor content bypasses transactions, so the guard only sees
// content that arrives via setContent/insert — exactly like the production
// controller, which creates the editor empty and loads documents afterwards.
const editorWith = (markdown: string): Editor => {
    const editor = new Editor({ extensions: canvasExtensions, content: "" });
    editor.commands.setContent(markdown);
    return editor;
};

const docText = (editor: Editor): string => editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", "\n");

describe("canvas text limit", () => {
    it("clips oversized content to the export limit", () => {
        const editor = editorWith("x".repeat(CANVAS_EXPORT_LIMIT_CHARS + 10_000));

        expect(textLength(editor.state.doc)).toBe(CANVAS_EXPORT_LIMIT_CHARS);
        editor.destroy();
    });

    it("fires the paste-clipped event when a paste transaction is clipped", () => {
        const listener = vi.fn();
        window.addEventListener(CANVAS_PASTE_CLIPPED_EVENT, listener);
        const editor = editorWith("");
        try {
            // ProseMirror marks real paste transactions with the "paste" meta
            const tr = editor.state.tr.insertText("y".repeat(CANVAS_EXPORT_LIMIT_CHARS + 1));
            tr.setMeta("paste", true);
            editor.view.dispatch(tr);

            expect(textLength(editor.state.doc)).toBe(CANVAS_EXPORT_LIMIT_CHARS);
            expect(listener).toHaveBeenCalled();
        } finally {
            window.removeEventListener(CANVAS_PASTE_CLIPPED_EVENT, listener);
            editor.destroy();
        }
    });

    it("rejects mid-document insertions that would exceed the limit", () => {
        const editor = editorWith("a".repeat(CANVAS_EXPORT_LIMIT_CHARS - 4_000));
        const before = docText(editor);

        editor.commands.insertContentAt(0, "b".repeat(10_000));

        expect(docText(editor)).toBe(before);
        expect(docText(editor)).not.toContain("b");
        editor.destroy();
    });

    it("allows insertions within the limit", () => {
        const editor = editorWith("a".repeat(CANVAS_EXPORT_LIMIT_CHARS - 4_000));

        editor.commands.insertContentAt(0, "b".repeat(1_000));

        expect(docText(editor)).toContain("b".repeat(1_000));
        editor.destroy();
    });

    it("decorates content beyond the warning threshold without changing it", () => {
        const editor = editorWith("a".repeat(CANVAS_WARN_CHARS + 1_000));

        const decorations = canvasTextLimitKey.getState(editor.state)?.find() ?? [];
        expect(decorations.length).toBe(1);
        const [decoration] = decorations;
        expect(decoration.from).toBe(textPosForCharIndex(editor.state.doc, CANVAS_WARN_CHARS));
        expect(decoration.to).toBe(editor.state.doc.content.size);
        // decoration only: the document text is unchanged
        expect(textLength(editor.state.doc)).toBe(CANVAS_WARN_CHARS + 1_000);
        editor.destroy();
    });

    it("does not decorate below the warning threshold", () => {
        const editor = editorWith("a".repeat(CANVAS_WARN_CHARS - 1_000));

        const decorations = canvasTextLimitKey.getState(editor.state)?.find() ?? [];
        expect(decorations.length).toBe(0);
        editor.destroy();
    });
});

describe("text helpers", () => {
    it("counts plain text across paragraphs", () => {
        const editor = editorWith("First\n\nSecond");
        // two paragraphs with one block separator
        expect(textLength(editor.state.doc)).toBe(12);
    });

    it("maps a text char index to its position", () => {
        const editor = editorWith("Hello world");
        // the text node starts one position after the paragraph opening
        expect(textPosForCharIndex(editor.state.doc, 5)).toBe(6);
    });
});
