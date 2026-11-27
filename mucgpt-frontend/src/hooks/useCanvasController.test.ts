// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "@tiptap/core";

import { canvasExtensions } from "../components/Canvas/canvasExtensions";
import { caretMarkdownOffset, markdownStorage, tableSelectionMarkdownAt, useCanvasController, type CanvasControllerInstance } from "./useCanvasController";
import { CANVAS_STREAM_CONTENT_LIMIT, parseCanvasStreamEvent } from "../utils/canvasStream";
import { DEFAULT_APP_CONFIG } from "../constants";
import type { CanvasRevisions } from "../service/canvasStorage";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const loadCanvasStateMock = vi.hoisted(() => vi.fn<(id: string) => Promise<string | null>>());
const loadCanvasRevisionsMock = vi.hoisted(() => vi.fn<(id: string) => Promise<CanvasRevisions | null>>());

vi.mock("../service/canvasStorage", async importOriginal => {
    const original = await importOriginal<typeof import("../service/canvasStorage")>();
    return {
        ...original,
        loadCanvasState: loadCanvasStateMock,
        loadCanvasRevisions: loadCanvasRevisionsMock
    };
});

const emptyRevisions = (): CanvasRevisions => ({ auto: [], manual: [] });

// Minimal renderHook replacement — @testing-library/react is not a project dependency.
const createdRoots: Root[] = [];
const renderController = () => {
    let latest: CanvasControllerInstance;
    let root: Root | undefined;
    const container = document.createElement("div");
    const Probe = ({ id }: { id: string | undefined }) => {
        latest = useCanvasController(id);
        return null;
    };
    return {
        render(id: string | undefined) {
            act(() => {
                if (!root) {
                    root = createRoot(container);
                    createdRoots.push(root);
                }
                root.render(createElement(Probe, { id }));
            });
        },
        async rerender(id: string | undefined) {
            await act(async () => {
                root?.render(createElement(Probe, { id }));
            });
        },
        async dispose() {
            const current = root;
            await act(async () => {
                current?.unmount();
                await new Promise(resolve => setTimeout(resolve, 5));
            });
            const index = current ? createdRoots.indexOf(current) : -1;
            if (index >= 0) createdRoots.splice(index, 1);
        },
        get current(): CanvasControllerInstance {
            return latest!;
        }
    };
};

// Buttons every editor created in this file, so any editor a test forgot to
// destroy is torn down in afterEach — a leaked editor's prosemirror DOMObserver
// keeps a timer alive and fires after the file's jsdom teardown with
// "ReferenceError: document is not defined".
const createdEditors: Editor[] = [];
const editorFor = (markdown: string): Editor => {
    const editor = new Editor({ extensions: canvasExtensions(), content: markdown });
    createdEditors.push(editor);
    return editor;
};

afterEach(async () => {
    for (const editor of createdEditors.splice(0)) {
        if (!editor.isDestroyed) editor.destroy();
    }
    // A leaked React root keeps the hook's tiptap editor (and its prosemirror
    // DOMObserver timer) alive past this file's jsdom teardown, producing an
    // unhandled "document is not defined" error that fails the whole run.
    for (const root of createdRoots.splice(0)) {
        await act(async () => {
            root.unmount();
        });
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    localStorage.removeItem("canvas-draft");
});

const posOf = (editor: Editor, needle: string) => {
    let found: number | undefined;
    editor.state.doc.descendants((node, pos) => {
        if (found === undefined && node.isText && node.text?.includes(needle)) {
            found = pos + node.text.indexOf(needle);
            return false;
        }
        return true;
    });
    if (found === undefined) throw new Error(`not found: ${needle}`);
    return found;
};

describe("tableSelectionMarkdownAt", () => {
    const TABLE = "| Verfahren | Zuständigkeit | Frist |\n| --- | --- | --- |\n| Auskunft | Amt A | 2 Wochen |\n| Genehmigung | Amt B | 6 Wochen |";

    it("quotes a body-cell selection with row, column header and text", () => {
        const editor = editorFor(TABLE);
        const start = posOf(editor, "2 Wochen");
        const markdown = tableSelectionMarkdownAt(editor.state.doc, start, start + "2 Wochen".length);
        expect(markdown).toBe('[table, row 2, col "Frist", referenced text: "2 Wochen"]');
    });

    it("quotes a header-cell selection without a column header name", () => {
        const editor = editorFor(TABLE);
        const start = posOf(editor, "Zuständigkeit");
        const markdown = tableSelectionMarkdownAt(editor.state.doc, start, start + "Zuständigkeit".length);
        expect(markdown).toBe('[table, row 1, col 2, referenced text: "Zuständigkeit"]');
    });

    it("reports a coordinate range for a selection spanning cells", () => {
        const editor = editorFor(TABLE);
        const from = posOf(editor, "Auskunft");
        const to = posOf(editor, "Amt A") + "Amt".length;
        const markdown = tableSelectionMarkdownAt(editor.state.doc, from, to);
        expect(markdown).toMatch(/^\[table, row 2, cols 1-2, referenced text: ".+"\]$/);
    });

    it("returns null outside a table", () => {
        const editor = editorFor("Hello world");
        expect(tableSelectionMarkdownAt(editor.state.doc, 3, 8)).toBeNull();
        expect(markdownStorage(editor).serializer.serialize(editor.state.doc.cut(3, 8))).toBe("llo w");
    });

    it("keeps the generic serialization for a selection covering the table from outside", () => {
        const editor = editorFor(`Intro\n\n${TABLE}`);
        const markdown = tableSelectionMarkdownAt(editor.state.doc, 1, editor.state.doc.content.size);
        expect(markdown).toBeNull();
    });
});

const offsetAt = (markdown: string, pos: number) => {
    const editor = editorFor(markdown);
    editor.chain().setTextSelection(pos).run();
    return caretMarkdownOffset(editor, pos);
};

describe("caretMarkdownOffset", () => {
    it("is null without an editor", () => {
        expect(caretMarkdownOffset(null, 1)).toBeNull();
    });

    it("is 0 at the start of the document", () => {
        expect(offsetAt("Hello world", 1)).toBe(0);
    });

    it("counts the markdown characters before the caret within a paragraph", () => {
        expect(offsetAt("Hello world", 4)).toBe(3);
    });

    it("matches the full markdown length at the end of the document", () => {
        const editor = editorFor("First\n\nSecond");
        editor.chain().setTextSelection(editor.state.doc.content.size).run();
        expect(caretMarkdownOffset(editor, editor.state.selection.from)).toBe(markdownStorage(editor).serializer.serialize(editor.state.doc).length);
    });

    it("offsets the given position, e.g. a selection start", () => {
        const editor = editorFor("Hello world");
        editor.chain().setTextSelection({ from: 3, to: 8 }).run();
        expect(caretMarkdownOffset(editor, editor.state.selection.from)).toBe(2);
    });
});

describe("parseCanvasStreamEvent", () => {
    it("accepts a valid event with revision metadata", () => {
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: "# Doc", metadata: { canvas_revision: 3 } })).toEqual({
            state: "UPDATE",
            content: "# Doc",
            metadata: { canvas_revision: 3 }
        });
    });

    it("accepts events without metadata and all four states", () => {
        for (const state of ["STARTED", "UPDATE", "APPEND", "ENDED"] as const) {
            expect(parseCanvasStreamEvent({ state, content: "" })).toEqual({ state, content: "" });
        }
    });

    it("ignores non-string content", () => {
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: 5 })).toBeNull();
        expect(parseCanvasStreamEvent({ state: "APPEND", content: null })).toBeNull();
    });

    it("ignores content beyond the size cap", () => {
        expect(parseCanvasStreamEvent({ state: "APPEND", content: "A".repeat(CANVAS_STREAM_CONTENT_LIMIT) })).not.toBeNull();
        expect(parseCanvasStreamEvent({ state: "APPEND", content: "A".repeat(CANVAS_STREAM_CONTENT_LIMIT + 1) })).toBeNull();
    });

    it("honours a configured content limit instead of the hardcoded default", () => {
        // The backend tools accept content up to the configured
        // CANVAS_CONTENT_MAX_CHARS; a raised limit must not silently drop
        // legitimate full-document UPDATE events.
        const limit = CANVAS_STREAM_CONTENT_LIMIT + 4096;
        const big = { state: "UPDATE", content: "A".repeat(CANVAS_STREAM_CONTENT_LIMIT + 1024), metadata: { canvas_revision: 1 } };
        expect(parseCanvasStreamEvent(big)).toBeNull();
        expect(parseCanvasStreamEvent(big, limit)).not.toBeNull();
        expect(parseCanvasStreamEvent({ state: "APPEND", content: "x".repeat(limit + 1) }, limit)).toBeNull();
    });

    it("treats null metadata like absent metadata (canvas_edit UPDATE wire shape)", () => {
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: "x", metadata: null })).toEqual({
            state: "UPDATE",
            content: "x",
            metadata: undefined
        });
    });

    it("ignores events with a non-finite canvas_revision", () => {
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: "x", metadata: { canvas_revision: "1" } })).toBeNull();
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: "x", metadata: { canvas_revision: Number.NaN } })).toBeNull();
        expect(parseCanvasStreamEvent({ state: "UPDATE", content: "x", metadata: 5 })).toBeNull();
    });

    it("ignores unknown states and non-object values", () => {
        expect(parseCanvasStreamEvent({ state: "BROKEN", content: "x" })).toBeNull();
        expect(parseCanvasStreamEvent(null)).toBeNull();
        expect(parseCanvasStreamEvent("UPDATE")).toBeNull();
    });
});

describe("applyStreamEvent", () => {
    it("appends valid APPEND events to the document", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("First");
            harness.current.applyStreamEvent({ state: "APPEND", content: " Second" });
        });
        expect(harness.current.getMarkdown()).toBe("First Second");
    });

    it("applies UPDATE events only with a rising canvas_revision", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.applyStreamEvent({ state: "UPDATE", content: "newest", metadata: { canvas_revision: 2 } });
        });
        expect(harness.current.getMarkdown()).toBe("newest");
        act(() => {
            harness.current.applyStreamEvent({ state: "UPDATE", content: "stale", metadata: { canvas_revision: 1 } });
        });
        expect(harness.current.getMarkdown()).toBe("newest");
    });

    it("applies a first-of-run UPDATE with canvas_revision 0 after beginRun()", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.beginRun();
            harness.current.applyStreamEvent({ state: "UPDATE", content: "zeroth", metadata: { canvas_revision: 0 } });
        });
        expect(harness.current.getMarkdown()).toBe("zeroth");
        act(() => {
            harness.current.applyStreamEvent({ state: "UPDATE", content: "replayed", metadata: { canvas_revision: 0 } });
        });
        expect(harness.current.getMarkdown()).toBe("zeroth");
    });

    it("beginRun resets the revision guard and locks even with the canvas closed", () => {
        // Regression: a run starting with a closed canvas previously kept the
        // guard from the previous run, so the new run's revision-1 UPDATE was
        // dropped and the auto-opened canvas stayed unlocked.
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.beginRun();
            harness.current.applyStreamEvent({ state: "UPDATE", content: "run one", metadata: { canvas_revision: 1 } });
        });
        expect(harness.current.getMarkdown()).toBe("run one");
        act(() => {
            harness.current.unlock();
            // Canvas never opened; a new run starts.
            harness.current.beginRun();
            harness.current.applyStreamEvent({ state: "UPDATE", content: "run two doc", metadata: { canvas_revision: 1 } });
        });
        expect(harness.current.getMarkdown()).toBe("run two doc");
        expect(harness.current.isLocked).toBe(true);
    });

    it("applies a canvas_edit UPDATE whose metadata serialized as null", () => {
        const harness = renderController();
        harness.render(undefined);
        const wireEvent = parseCanvasStreamEvent({ state: "UPDATE", content: "edited", metadata: null });
        expect(wireEvent).not.toBeNull();
        act(() => {
            harness.current.applyStreamEvent(wireEvent!);
        });
        expect(harness.current.getMarkdown()).toBe("edited");
    });
});

describe("loading stored revisions", () => {
    it("degrades malformed revision rings to empty rings without crashing", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue({ auto: null, manual: [] } as unknown as CanvasRevisions);

        const harness = renderController();
        harness.render(undefined);

        await harness.rerender("conv-1");

        expect(harness.current.revisions).toEqual({ auto: [], manual: [] });
    });

    it("drops malformed ring entries when loading revisions", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue({
            auto: [{ revision: 2, doc_json: { type: "doc" }, timestamp: 2, source: "agent" }, { revision: "x" }, null],
            manual: "nope"
        } as unknown as CanvasRevisions);

        const harness = renderController();
        harness.render(undefined);

        await harness.rerender("conv-1");

        expect(harness.current.revisions).toEqual({
            auto: [{ revision: 2, doc_json: { type: "doc" }, timestamp: 2, source: "agent" }],
            manual: []
        });
    });

    it("restores the newest revision when the current canvas is empty", async () => {
        loadCanvasStateMock.mockResolvedValue("");
        loadCanvasRevisionsMock.mockResolvedValue({
            auto: [
                {
                    revision: 1,
                    doc_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Older" }] }] },
                    timestamp: 1,
                    source: "agent"
                },
                {
                    revision: 2,
                    doc_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Newest" }] }] },
                    timestamp: 2,
                    source: "agent"
                }
            ],
            manual: []
        });

        const harness = renderController();
        harness.render(undefined);

        await harness.rerender("conv-1");
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(harness.current.isOpen).toBe(true);
        expect(harness.current.getMarkdown()).toBe("Newest");
    });
});

describe("conversation id assignment", () => {
    it("does not crash when the editor is destroyed during a conversation switch", async () => {
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());
        loadCanvasStateMock.mockResolvedValue(null);
        const harness = renderController();

        harness.render(undefined);
        harness.current.editor?.destroy();

        await harness.rerender("conv-1");

        expect(harness.current.isOpen).toBe(false);
        await harness.dispose();
    });

    it("restores stored content when a reload assigns the existing conversation id", async () => {
        loadCanvasStateMock.mockResolvedValue("# Stored");
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render(undefined);

        await harness.rerender("conv-1");

        expect(harness.current.isOpen).toBe(true);
        expect(harness.current.getMarkdown()).toBe("# Stored");
    });

    it("keeps live content when the first prompt of a new chat assigns the id", async () => {
        loadCanvasStateMock.mockResolvedValue("# Stored");
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("# Mine");
            harness.current.setIsOpen(true);
        });
        // The page announces the adoption before makeApiRequest assigns the id.
        const capture = harness.current.capturePreChatDraft();
        act(() => harness.current.beginAdoption(capture));

        await harness.rerender("conv-1");

        expect(harness.current.isOpen).toBe(true);
        expect(harness.current.getMarkdown()).toBe("# Mine");
    });

    it("keeps a pending open request across a fresh-chat reset and reopens for the new chat", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render("old-conv");
        await harness.rerender("old-conv");
        act(() => harness.current.requestOpen());
        expect(harness.current.isOpen).toBe(true);

        // startFreshChat resets the active chat: the switch effect closes the canvas
        await harness.rerender(undefined);
        expect(harness.current.isOpen).toBe(false);

        // the fresh chat's first prompt assigns its id: the pending request reopens
        await harness.rerender("new-conv");
        expect(harness.current.isOpen).toBe(true);
    });

    it("clears a canvas holding only a horizontal rule when switching conversations", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render("old-conv");
        await harness.rerender("old-conv");
        act(() => harness.current.setMarkdown("---"));

        // A horizontal-rule-only document has no textContent; it must still not
        // leak into the next conversation.
        await harness.rerender("new-conv");

        expect(harness.current.getMarkdown().trim()).toBe("");
    });

    it("clears a canvas holding an empty code block when switching conversations", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render("old-conv");
        await harness.rerender("old-conv");
        act(() => harness.current.setMarkdown("```\n```"));

        await harness.rerender("new-conv");

        expect(harness.current.getMarkdown().trim()).toBe("");
    });

    it("keeps a closed canvas with a horizontal rule when the first prompt assigns the id", async () => {
        loadCanvasStateMock.mockResolvedValue(null);
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render(undefined);
        let capture: ReturnType<typeof harness.current.capturePreChatDraft>;
        act(() => {
            harness.current.setMarkdown("---");
            capture = harness.current.capturePreChatDraft();
            harness.current.beginAdoption(capture);
        });

        await harness.rerender("conv-1");

        expect(harness.current.getMarkdown().trim()).not.toBe("");
    });

    it("treats an unannounced id assignment as a switch and leaves the stored draft alone", async () => {
        localStorage.setItem("canvas-draft", "# pre-chat draft");
        loadCanvasStateMock.mockResolvedValue("# Stored");
        loadCanvasRevisionsMock.mockResolvedValue(emptyRevisions());

        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("# Mine");
            harness.current.setIsOpen(true);
        });

        await harness.rerender("conv-1");

        // Live pre-chat content must not leak into the other conversation.
        expect(harness.current.getMarkdown()).toBe("# Stored");
        expect(localStorage.getItem("canvas-draft")).toBe("# pre-chat draft");
    });
});

describe("cursor anchor sampling", () => {
    const clickAt = (harness: ReturnType<typeof renderController>, docPos: number) => {
        act(() => {
            harness.current.editor!.chain().setTextSelection(docPos).run();
        });
    };

    it("samples the clicked caret position and follows it to a new click", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Hello world");
            harness.current.setIsOpen(true);
        });

        clickAt(harness, 3);
        expect(harness.current.toCanvasState()?.cursor).toBe(2);

        clickAt(harness, 9);
        expect(harness.current.toCanvasState()?.cursor).toBe(8);
    });

    it("sends no cursor after an agent rewrite until the user places the caret again", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Hello world");
            harness.current.setIsOpen(true);
            harness.current.editor!.chain().setTextSelection(5).run();
        });
        expect(harness.current.toCanvasState()?.cursor).toBe(4);

        act(() => {
            harness.current.applyStreamEvent({
                state: "UPDATE",
                content: "Agent wrote a fresh document",
                metadata: { canvas_revision: 1 }
            });
        });

        expect(harness.current.toCanvasState()?.cursor).toBeNull();

        act(() => {
            harness.current.editor!.chain().setTextSelection(7).run();
        });
        expect(harness.current.toCanvasState()?.cursor).toBe(6);
    });

    it("sends the canvas state with a closed panel when it has content", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Hello world");
            clickAt(harness, 3);
        });

        // closed with content: the document and the 'here' caret ride along,
        // the view-only selection does not
        const closed = harness.current.toCanvasState();
        expect(closed?.content).toBe("Hello world");
        expect(closed?.selection).toBeNull();
        expect(closed?.cursor).toBe(2);

        act(() => {
            harness.current.setMarkdown("");
        });
        expect(harness.current.toCanvasState()).toBeNull();
    });

    it("clips oversized documents and drops the caret beyond the clip point", () => {
        const harness = renderController();
        harness.render(undefined);
        const big = "x".repeat(DEFAULT_APP_CONFIG.canvas_content_max_chars + 10_000);
        act(() => {
            harness.current.setMarkdown(big);
            harness.current.editor!.chain().setTextSelection(harness.current.editor!.state.doc.content.size).run();
        });

        const state = harness.current.toCanvasState();
        expect(state?.content).toBe(big.slice(0, DEFAULT_APP_CONFIG.canvas_content_max_chars));
        expect(state?.truncated).toBe(true);
        expect(state?.cursor).toBeNull();
        expect(state?.selection).toBeNull();
    });

    it("does not flag content within the persistence limit as truncated", () => {
        const harness = renderController();
        harness.render(undefined);
        const small = "x".repeat(DEFAULT_APP_CONFIG.canvas_content_max_chars - 1);
        act(() => {
            harness.current.setMarkdown(small);
        });
        const state = harness.current.toCanvasState();
        expect(state?.truncated).toBeUndefined();
        expect(state?.content).toBe(small);
    });
});

/** Selection serialization: operators belong to the selection only when the
 * selection covers their boundary side. */
describe("selection markdown", () => {
    const selectRange = (harness: ReturnType<typeof renderController>, markdown: string, from: string, to: string) => {
        act(() => {
            harness.current.setMarkdown(markdown);
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const fromPos = posOf(editor, from);
            const toPos = posOf(editor, to) + to.length;
            editor.chain().setTextSelection({ from: fromPos, to: toPos }).run();
        });
        return harness.current.getSelectionMarkdown();
    };

    it("reports a plain word inside a bullet without the list prefix", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "- this is my text", "my", "my")).toBe("my");
    });

    it("delivers a trailing space in a mid-line selection", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Katzen und Hunde");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const from = posOf(editor, "und");
            editor
                .chain()
                .setTextSelection({ from, to: from + "und ".length })
                .run();
        });
        expect(harness.current.getSelectionMarkdown()).toBe("und ");
    });

    it("keeps the list prefix only when the selection starts at the item's beginning", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "- this is my text", "this", "text")).toBe("- this is my text");
    });

    it("reports a mid-heading word without the marker", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "# My heading", "head", "head")).toBe("head");
    });

    it("keeps the heading marker when the selection starts at the heading's beginning", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "# My heading", "My", "heading")).toBe("# My heading");
    });

    it("does not add inline operators for a partial bold run", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "**bold one** and more", "old", "old")).toBe("old");
    });

    it("adds inline operators when the selection covers the full mark", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "**bold one** and more", "bold", "one")).toBe("**bold one**");
    });

    it("covers operators the selection spans across", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "plain **bold face** tail", "plain", "bold")).toBe("plain **bold");
    });

    it("renders a multi-block selection exactly as it appears in the markdown", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "- alpha\n- beta tail", "lph", "be")).toBe("lpha\n- be");
    });

    it("reports text inside a code block verbatim", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "```\ncode line\n```", "code", "line")).toBe("code line");
    });

    it("sends the selection with the selection-start cursor on the canvas state", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Hello world");
            harness.current.setIsOpen(true);
            harness.current.editor!.chain().setTextSelection({ from: 3, to: 9 }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("llo wo");
        expect(state?.cursor).toBe(2);
    });

    it("aligns the cursor with the line start when the selection begins a whole block", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("- this is my text");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const from = posOf(editor, "this");
            const to = posOf(editor, "text") + 4;
            editor.chain().setTextSelection({ from, to }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("- this is my text");
        expect(state?.cursor).toBe(0);
    });

    it("keeps the collapsed caret at the line-prefix end when nothing is selected", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("- item text");
            harness.current.setIsOpen(true);
            harness.current.editor!.chain().setTextSelection(posOf(harness.current.editor!, "item")).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBeNull();
        expect(state?.cursor).toBe(2);
    });

    it("serializes a select-all selection as the full document", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("- this is my text");
            harness.current.setIsOpen(true);
            harness.current.editor!.commands.selectAll();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("- this is my text");
    });

    it("serializes doc-boundary selections when the sentinel path has no textblock boundary", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("- this is my text");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            // from = doc start (0), to = after "my" (inside the textblock)
            const to = posOf(editor, "my") + 2;
            editor.chain().setTextSelection({ from: 0, to }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("- this is my");
    });

    it("falls back to exact serialization when a line-start escape breaks the sentinel doc", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            // Markdown "\- literal tail" parses to a paragraph whose text
            // starts with "- "; the full serialization escapes it as "\-".
            harness.current.setMarkdown("\\- literal tail");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const from = posOf(editor, "literal");
            const to = posOf(editor, "tail") + 4;
            editor.chain().setTextSelection({ from, to }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("literal tail");
        expect(state?.selection!.length).toBeGreaterThan(9);
    });

    it("keeps the escaped marker when the selection starts at the block start", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("\\- literal tail");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const to = posOf(editor, "literal") + "literal".length;
            editor.chain().setTextSelection({ from: 0, to }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("\\- literal");
    });

    it("slices a doc-end boundary without fabricating mark delimiters", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("**Alpha Beta**\n\nTail");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const from = posOf(editor, "Beta");
            editor.chain().setTextSelection({ from, to: editor.state.doc.content.size }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("Beta**\n\nTail");
    });

    it("aligns the doc-end fallback with the line start", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("- item text");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const from = posOf(editor, "item");
            editor.chain().setTextSelection({ from, to: editor.state.doc.content.size }).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.selection).toBe("- item text");
        expect(state?.cursor).toBe(0);
    });

    it("reports the cursor in code-point offsets for astral characters", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("😀 cat");
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            editor.chain().setTextSelection(posOf(editor, "cat")).run();
        });
        const state = harness.current.toCanvasState();
        expect(state?.cursor).toBe(2);
    });
});

describe("canvas HTML whitelist integration", () => {
    const markNames = (harness: ReturnType<typeof renderController>): string[] => {
        const names: string[] = [];
        harness.current.editor!.state.doc.descendants(node =>
            node.marks.forEach(mark => {
                if (!names.includes(mark.type.name)) names.push(mark.type.name);
            })
        );
        return names;
    };

    it("keeps whitelisted <u> as a mark and renders other HTML as literal text", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Hello <u>world</u> and <b>bold</b>");
        });
        expect(harness.current.getMarkdown()).toContain("<u>world</u>");
        expect(markNames(harness)).toContain("underline");
        expect(markNames(harness)).not.toContain("bold");
        expect(harness.current.editor!.state.doc.textContent).toContain("<b>bold</b>");
    });

    it("keeps underline through the store/restore cycle", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Before <u>marked</u> rest");
        });
        act(() => {
            harness.current.snapshot("manual");
        });
        const revision = harness.current.listRevisions().manual[0].revision;
        act(() => {
            harness.current.setMarkdown("Replaced entirely");
        });
        act(() => {
            harness.current.restore(revision);
        });
        expect(harness.current.getMarkdown()).toBe("Before <u>marked</u> rest");
        expect(markNames(harness)).toContain("underline");
    });

    it("sanitizes stream UPDATE content the same way", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.applyStreamEvent({
                state: "UPDATE",
                content: "Agent <u>wrote</u> <b>this</b>",
                metadata: { canvas_revision: 1 }
            });
        });
        expect(harness.current.getMarkdown()).toContain("<u>wrote</u>");
        expect(markNames(harness)).not.toContain("bold");
    });
});

describe("selection markdown and caret offsets with whitelisted HTML", () => {
    const selectRange = (harness: ReturnType<typeof renderController>, markdown: string, from: string, to: string) => {
        act(() => {
            harness.current.setMarkdown(markdown);
            harness.current.setIsOpen(true);
            const editor = harness.current.editor!;
            const fromPos = posOf(editor, from);
            const toPos = posOf(editor, to) + to.length;
            editor.chain().setTextSelection({ from: fromPos, to: toPos }).run();
        });
        return harness.current.getSelectionMarkdown();
    };

    it("quotes an inner underlined segment without the enclosing tags", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "Vor <u>unterstrichener Welt hier</u> nach", "strichener", "Welt")).toBe("strichener Welt");
    });

    it("keeps the opening tag when the selection starts at the mark's start (contract)", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "Vor <u>unterstrichener Welt hier</u> nach", "unterstrichener", "Welt")).toBe("<u>unterstrichener Welt");
    });

    it("keeps the underline tags when the selection covers the whole mark", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "Vor <u>unterstrichener Welt</u> nach", "unterstrichener", "Welt")).toBe("<u>unterstrichener Welt</u>");
    });

    it("keeps verbatim markdown when the selection crosses the closing tag", () => {
        const harness = renderController();
        harness.render(undefined);
        expect(selectRange(harness, "Vor <u>unterstrichener Welt</u> nach", "strichener", "nach")).toBe("strichener Welt</u> nach");
    });

    it("reports exact caret offsets inside underlined text", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Vor <u>hallo Welt</u> nach");
        });
        const editor = harness.current.editor!;
        const offset = caretMarkdownOffset(editor, posOf(editor, "hallo") + 2);
        const markdown = harness.current.getMarkdown();
        expect(offset).toBe(markdown.indexOf("llo Welt"));
        expect(markdown.slice(offset!, offset! + 3)).toBe("llo");
    });

    it("reports exact caret offsets inside bold text", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.setMarkdown("Vor **krasser Welt** nach");
        });
        const editor = harness.current.editor!;
        const offset = caretMarkdownOffset(editor, posOf(editor, "krasser") + 3);
        const markdown = harness.current.getMarkdown();
        expect(offset).toBe(markdown.indexOf("sser Welt"));
        expect(markdown.slice(offset!, offset! + 3)).toBe("sse");
    });
});
