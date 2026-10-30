// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "@tiptap/core";

import { canvasExtensions } from "../components/Canvas/canvasExtensions";
import { caretMarkdownOffset, markdownStorage, tableSelectionMarkdown, useCanvasController, type CanvasControllerInstance } from "./useCanvasController";
import { CANVAS_STREAM_CONTENT_LIMIT, parseCanvasStreamEvent } from "../utils/canvasStream";
import { CANVAS_CONTENT_LIMIT_CHARS } from "../components/Canvas/canvasLimits";
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
                if (!root) root = createRoot(container);
                root.render(createElement(Probe, { id }));
            });
        },
        async rerender(id: string | undefined) {
            await act(async () => {
                root?.render(createElement(Probe, { id }));
            });
        },
        get current(): CanvasControllerInstance {
            return latest!;
        }
    };
};

const editorFor = (markdown: string) => new Editor({ extensions: canvasExtensions, content: markdown });

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

const select = (editor: Editor, from: number, to: number) => {
    editor.chain().setTextSelection({ from, to }).run();
    return editor;
};

describe("tableSelectionMarkdown", () => {
    const TABLE = "| Verfahren | Zuständigkeit | Frist |\n| --- | --- | --- |\n| Auskunft | Amt A | 2 Wochen |\n| Genehmigung | Amt B | 6 Wochen |";

    it("quotes a body-cell selection with row, column header and text", () => {
        const editor = editorFor(TABLE);
        const start = posOf(editor, "2 Wochen");
        const markdown = tableSelectionMarkdown(select(editor, start, start + "2 Wochen".length).state);
        expect(markdown).toBe('[table, row 2, col "Frist", referenced text: "2 Wochen"]');
    });

    it("quotes a header-cell selection without a column header name", () => {
        const editor = editorFor(TABLE);
        const start = posOf(editor, "Zuständigkeit");
        const markdown = tableSelectionMarkdown(select(editor, start, start + "Zuständigkeit".length).state);
        expect(markdown).toBe('[table, row 1, col 2, referenced text: "Zuständigkeit"]');
    });

    it("reports a coordinate range for a selection spanning cells", () => {
        const editor = editorFor(TABLE);
        const from = posOf(editor, "Auskunft");
        const to = posOf(editor, "Amt A") + "Amt".length;
        const markdown = tableSelectionMarkdown(select(editor, from, to).state);
        expect(markdown).toMatch(/^\[table, row 2, cols 1-2, referenced text: ".+"\]$/);
    });

    it("returns null outside a table", () => {
        const editor = select(editorFor("Hello world"), 3, 8);
        expect(tableSelectionMarkdown(editor.state)).toBeNull();
        expect(markdownStorage(editor).serializer.serialize(editor.state.doc.cut(3, 8))).toBe("llo w");
    });

    it("keeps the generic serialization for a selection covering the table from outside", () => {
        const editor = editorFor(`Intro\n\n${TABLE}`);
        const markdown = tableSelectionMarkdown(select(editor, 1, editor.state.doc.content.size).state);
        expect(markdown).toBeNull();
    });
});

const offsetAt = (markdown: string, pos: number) => {
    const editor = editorFor(markdown);
    editor.chain().setTextSelection(pos).run();
    return caretMarkdownOffset(editor);
};

describe("caretMarkdownOffset", () => {
    it("is null without an editor", () => {
        expect(caretMarkdownOffset(null)).toBeNull();
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
        expect(caretMarkdownOffset(editor)).toBe(markdownStorage(editor).serializer.serialize(editor.state.doc).length);
    });

    it("uses the selection start when a passage is selected", () => {
        const editor = editorFor("Hello world");
        editor.chain().setTextSelection({ from: 3, to: 8 }).run();
        expect(caretMarkdownOffset(editor)).toBe(2);
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

    it("applies a first-of-run UPDATE with canvas_revision 0 after lock()", () => {
        const harness = renderController();
        harness.render(undefined);
        act(() => {
            harness.current.lock();
            harness.current.applyStreamEvent({ state: "UPDATE", content: "zeroth", metadata: { canvas_revision: 0 } });
        });
        expect(harness.current.getMarkdown()).toBe("zeroth");
        act(() => {
            harness.current.applyStreamEvent({ state: "UPDATE", content: "replayed", metadata: { canvas_revision: 0 } });
        });
        expect(harness.current.getMarkdown()).toBe("zeroth");
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
});

describe("conversation id assignment", () => {
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

        await harness.rerender("conv-1");

        expect(harness.current.isOpen).toBe(true);
        expect(harness.current.getMarkdown()).toBe("# Mine");
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
        const big = "x".repeat(CANVAS_CONTENT_LIMIT_CHARS + 10_000);
        act(() => {
            harness.current.setMarkdown(big);
            harness.current.editor!.chain().setTextSelection(harness.current.editor!.state.doc.content.size).run();
        });

        const state = harness.current.toCanvasState();
        expect(state?.content).toBe(big.slice(0, CANVAS_CONTENT_LIMIT_CHARS));
        expect(state?.cursor).toBeNull();
        expect(state?.selection).toBeNull();
    });
});
