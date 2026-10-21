// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "@tiptap/core";

import { canvasExtensions } from "../components/Canvas/canvasExtensions";
import { caretMarkdownOffset, markdownStorage, useCanvasController, type CanvasControllerInstance } from "./useCanvasController";
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
});
