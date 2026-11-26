// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadCanvasRevisions, loadCanvasState, saveCanvasContent } from "../service/canvasStorage";
import { CanvasPanel } from "../components/Canvas/CanvasPanel";
import { useCanvasController } from "./useCanvasController";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../components/Canvas/canvasLimits", () => ({
    useCanvasLimits: () => ({ editorLimitChars: 512000, contentLimitChars: 256000, warnChars: 243200 })
}));
vi.mock("../components/Canvas/CanvasEditor", () => ({ CanvasEditor: () => <div data-testid="canvas-editor" /> }));
vi.mock("../components/Canvas/CanvasToolbar", () => ({ CanvasToolbar: () => <div /> }));
vi.mock("../components/Canvas/CanvasVersionsDrawer", () => ({ CanvasVersionsDrawer: () => <div /> }));

vi.mock("../service/canvasStorage", async importOriginal => {
    const original = await importOriginal<typeof import("../service/canvasStorage")>();
    return {
        ...original,
        saveCanvasContent: vi.fn(),
        loadCanvasState: vi.fn(async () => null),
        loadCanvasRevisions: vi.fn(async () => null)
    };
});

vi.mock("../api/core-client", async importOriginal => {
    const original = await importOriginal<typeof import("../api/core-client")>();
    return { ...original, putCanvasRevisionsApi: vi.fn(async () => undefined) };
});

const saveMock = vi.mocked(saveCanvasContent);
const loadStateMock = vi.mocked(loadCanvasState);
const loadRevisionsMock = vi.mocked(loadCanvasRevisions);

/** Serializes a ProseMirror-style doc JSON into simple text (for the stub). */
const docToMarkdown = (doc: unknown): string => {
    if (typeof doc === "string") return doc;
    const node = doc as { type?: string; text?: string; content?: unknown[] } | null;
    if (!node) return "";
    if (node.type === "text") return node.text ?? "";
    return (node.content ?? []).map(docToMarkdown).join("\n");
};

const docWithText = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

/** Editor stub that mirrors the controller-relevant ProseMirror behavior. */
const makeEditorStub = () => {
    const stub = {
        isDestroyed: false,
        markdownText: "",
        state: {
            doc: {
                // equals the empty document unless (stubbed) content was set
                eq: () => stub.markdownText.trim() === ""
            },
            tr: { setMeta: () => ({}) }
        },
        schema: { topNodeType: { createAndFill: () => ({}) } },
        storage: { markdown: { serializer: { serialize: () => stub.markdownText } } },
        getJSON: () => docWithText(stub.markdownText),
        view: { dispatch: vi.fn() },
        listeners: new Map<string, Set<(payload?: unknown) => void>>(),
        commands: {
            // Real setContent updates the document and emits an update event.
            setContent: (content: unknown) => {
                stub.markdownText = docToMarkdown(content);
                stub.emit("update");
            }
        },
        on(event: string, listener: (payload?: unknown) => void) {
            if (!stub.listeners.has(event)) stub.listeners.set(event, new Set());
            stub.listeners.get(event)!.add(listener);
        },
        off(event: string, listener: (payload?: unknown) => void) {
            stub.listeners.get(event)?.delete(listener);
        },
        emit(event: string) {
            stub.listeners.get(event)?.forEach(listener => listener());
        }
    };
    return stub;
};

const editors = vi.hoisted(() => ({ active: undefined as unknown }));
const editorStub = makeEditorStub();
editors.active = editorStub;

vi.mock("@tiptap/react", () => ({ useEditor: () => editors.active }));

let capturedController: ReturnType<typeof useCanvasController> | undefined;

const Owner = ({ conversationId }: { conversationId: string | undefined }) => {
    const controller = useCanvasController(conversationId);
    capturedController = controller;
    return <CanvasPanel controller={controller} conversationId={conversationId} />;
};

const advanceDebounce = () => new Promise(resolve => setTimeout(resolve, 1100));

const clearedRings = {
    auto: [
        { revision: 5, doc_json: docWithText("pre-clear"), timestamp: 1, source: "autosave" as const },
        { revision: 6, doc_json: { type: "doc", content: [] }, timestamp: 2, source: "cleared" as const }
    ],
    manual: []
};

beforeEach(() => {
    // The editor stub is shared across tests; leftover content would make the
    // switch effect's reset emit a real update and pollute the next test.
    editorStub.markdownText = "";
    saveMock.mockResolvedValue(true);
    loadStateMock.mockResolvedValue(null);
    loadRevisionsMock.mockResolvedValue(null);
    localStorage.clear();
});

afterEach(() => {
    cleanup();
    saveMock.mockClear();
    loadStateMock.mockReset();
    loadRevisionsMock.mockReset();
});

describe("useCanvasController notify flush", () => {
    it("flushes a pending draft when the owner and the panel unmount together", async () => {
        const view = render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# drafted";
        editorStub.emit("update");
        view.unmount();

        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# drafted", false));
    });

    it("saves the outgoing conversation's pending edit on a switch and never its editor clear", async () => {
        const view = render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# draft A";
        editorStub.emit("update");
        view.rerender(<Owner conversationId="conv-2" />);

        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# draft A", false));
        // The "" resulting from the switch's editor clear is not a user edit:
        // neither conversation may receive an empty write.
        expect(saveMock.mock.calls.some(call => call[1] === "")).toBe(false);
    });

    it("captures the last nonempty document with the debounced notification and stores it as an autosave snapshot", async () => {
        render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# content";
        editorStub.emit("update");
        await advanceDebounce();

        act(() => capturedController!.snapshot("autosave"));
        const backups = capturedController!.listRevisions().auto.filter(entry => entry.source === "autosave");
        expect(backups).toHaveLength(1);
        expect(backups[0].doc_json).toEqual(docWithText("# content"));
    });

    it("prefers evicting the oldest autosave entry over agent versions when the auto ring is full", async () => {
        render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# content";
        editorStub.emit("update");
        await advanceDebounce();

        const snapshot = capturedController!.snapshot;
        for (let index = 0; index < 25; index++) act(() => snapshot("agent"));
        act(() => snapshot("autosave"));
        act(() => snapshot("autosave"));

        const auto = capturedController!.listRevisions().auto;
        expect(auto).toHaveLength(25);
        const backups = auto.filter(entry => entry.source === "autosave");
        // The second backup evicted the first one, agent versions are intact.
        expect(backups.map(entry => entry.revision)).toEqual([27]);
        expect(auto.filter(entry => entry.source === "agent")).toHaveLength(24);
        expect(auto.some(entry => entry.source === "agent" && entry.revision === 1)).toBe(false);
        expect(auto.some(entry => entry.source === "agent" && entry.revision === 2)).toBe(true);
    });

    it("does not snapshot an autosave backup without a captured nonempty document", async () => {
        render(<Owner conversationId="conv-1" />);
        // No edit, no debounced capture.

        act(() => capturedController!.snapshot("autosave"));
        expect(capturedController!.listRevisions().auto.filter(entry => entry.source === "autosave")).toHaveLength(0);
    });

    it("keeps an intentionally cleared canvas empty after a reload (the cleared marker wins the load fallback)", async () => {
        loadStateMock.mockResolvedValue("");
        loadRevisionsMock.mockResolvedValue(clearedRings);

        render(<Owner conversationId="conv-1" />);

        // The fallback applied the cleared marker: the canvas opened empty.
        await waitFor(() => expect(capturedController!.isOpen).toBe(true));
        // Let a possible wrongful resurrection save attempt play out.
        await advanceDebounce();
        expect(editorStub.markdownText).toBe("");
        expect(saveMock.mock.calls.some(call => call[1] !== "")).toBe(false);
    });

    it("resurrects the newest nonempty ring entry when that is the newest revision", async () => {
        loadStateMock.mockResolvedValue("");
        loadRevisionsMock.mockResolvedValue({
            auto: [clearedRings.auto[0], { revision: 7, doc_json: docWithText("restored backup"), timestamp: 3, source: "restore" as const }],
            manual: []
        });

        render(<Owner conversationId="conv-1" />);

        await waitFor(() => expect(editorStub.markdownText).toBe("restored backup"));
    });

    it("reapplies the last captured document into a recreated empty editor", async () => {
        const view = render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# before recreation";
        editorStub.emit("update");

        // Simulate editor recreation (the limits config arriving): a fresh
        // empty editor replaces the live one.
        const recreated = makeEditorStub();
        editors.active = recreated;
        view.rerender(<Owner conversationId="conv-1" />);

        expect(recreated.markdownText).toBe("# before recreation");
        editors.active = editorStub;
    });

    it("recreation after an intentional clear keeps the recreated editor empty", async () => {
        const view = render(<Owner conversationId="conv-1" />);

        editorStub.markdownText = "# content";
        editorStub.emit("update");

        // The user clears the cleared-and-saved document.
        editorStub.markdownText = "";
        editorStub.emit("update");

        // Editor recreation (the limits config arriving) must not resurrect
        // the cleared content: the recreation restore reuses the latest
        // document, emptiness included.
        const recreated = makeEditorStub();
        editors.active = recreated;
        view.rerender(<Owner conversationId="conv-1" />);

        expect(recreated.markdownText).toBe("");
        editors.active = editorStub;
    });
});

describe("useCanvasController pre-chat canvas draft", () => {
    it("stores an unpersisted edit in the localStorage draft after the debounce", async () => {
        render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# unpersisted";
        editorStub.emit("update");
        await advanceDebounce();

        expect(localStorage.getItem("canvas-draft")).toBe("# unpersisted");
        expect(saveMock).not.toHaveBeenCalled();
    });

    it("restores the pre-chat draft on a fresh canvas and opens it", () => {
        localStorage.setItem("canvas-draft", "# draft");

        render(<Owner conversationId={undefined} />);

        expect(editorStub.markdownText).toBe("# draft");
        expect(capturedController!.isOpen).toBe(true);
    });

    it("clears the draft when the unpersisted canvas is emptied", async () => {
        localStorage.setItem("canvas-draft", "# older");
        render(<Owner conversationId={undefined} />);
        await advanceDebounce();
        expect(editorStub.markdownText).toBe("# older");

        editorStub.markdownText = "";
        editorStub.emit("update");
        await advanceDebounce();

        expect(localStorage.getItem("canvas-draft")).toBeNull();
    });

    it("keeps the previous draft when an over-limit edit arrives while unpersisted", async () => {
        render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# valid";
        editorStub.emit("update");
        await advanceDebounce();

        editorStub.markdownText = "x".repeat(256001);
        editorStub.emit("update");
        await advanceDebounce();

        expect(localStorage.getItem("canvas-draft")).toBe("# valid");
    });

    it("drops the draft on pagehide when the unpersisted canvas was emptied inside the debounce window", async () => {
        localStorage.setItem("canvas-draft", "# older");
        render(<Owner conversationId={undefined} />);
        await advanceDebounce();
        expect(editorStub.markdownText).toBe("# older");

        editorStub.markdownText = "";
        editorStub.emit("update");
        act(() => {
            window.dispatchEvent(new Event("pagehide"));
        });

        expect(localStorage.getItem("canvas-draft")).toBeNull();
    });

    it("keeps adopted content on a fresh conversation's id assignment and drops the draft", async () => {
        localStorage.setItem("canvas-draft", "# older");
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# adopted";
        editorStub.emit("update");
        await advanceDebounce();

        const capture = capturedController!.capturePreChatDraft();
        act(() => capturedController!.beginAdoption(capture));
        view.rerender(<Owner conversationId="conv-new" />);

        expect(editorStub.markdownText).toBe("# adopted");
        expect(localStorage.getItem("canvas-draft")).toBeNull();
        expect(loadStateMock).not.toHaveBeenCalled();
    });

    it("switches away with canvas content: the target conversation's server canvas replaces it and the draft survives", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# stale";
        editorStub.emit("update");
        await advanceDebounce();
        loadStateMock.mockResolvedValue("# stored");

        view.rerender(<Owner conversationId="existing-1" />);

        await waitFor(() => expect(editorStub.markdownText).toBe("# stored"));
        expect(localStorage.getItem("canvas-draft")).toBe("# stale");
        expect(loadStateMock).toHaveBeenCalledWith("existing-1");
    });

    it("re-seeds the surviving draft into the next new chat after switching away to a persisted chat", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# draft";
        editorStub.emit("update");
        await advanceDebounce();
        loadStateMock.mockResolvedValue(null);
        await view.rerender(<Owner conversationId="existing-1" />);
        await waitFor(() => expect(editorStub.markdownText).toBe(""));

        view.rerender(<Owner conversationId={undefined} />);

        expect(editorStub.markdownText).toBe("# draft");
        expect(capturedController!.isOpen).toBe(true);
    });

    it("re-seeds the draft after an aborted conversation: snapshotPreChatDraft re-arms it before the reset", () => {
        localStorage.setItem("canvas-draft", "# older");
        const view = render(<Owner conversationId="conv-1" />);
        editorStub.markdownText = "# first turn content";
        editorStub.emit("update");

        act(() => capturedController!.snapshotPreChatDraft());
        expect(localStorage.getItem("canvas-draft")).toBe("# first turn content");

        view.rerender(<Owner conversationId={undefined} />);
        expect(editorStub.markdownText).toBe("# first turn content");
    });

    it("re-seeds the draft into a recreated editor when the mount seed fell into a recreation window", () => {
        const view = render(<Owner conversationId={undefined} />);
        // No document was ever captured: the seed ran against a since-replaced,
        // empty editor, and the draft was saved before that.
        localStorage.setItem("canvas-draft", "# draft");
        const recreated = makeEditorStub();
        editors.active = recreated;
        view.rerender(<Owner conversationId={undefined} />);

        expect(recreated.markdownText).toBe("# draft");
        expect(capturedController!.isOpen).toBe(true);
        editors.active = editorStub;
    });

    it("re-arms the draft with the content captured at request start, not with a later chat switch's editor content", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# pre-chat";
        editorStub.emit("update");
        const capture = capturedController!.capturePreChatDraft();
        // Adoption completes with the first conversation id.
        loadStateMock.mockResolvedValue(null);
        await act(async () => view.rerender(<Owner conversationId="conv-new" />));
        // Switch to another persisted chat mid-run: its (empty) canvas must
        // not overwrite the pre-chat draft on abort.
        await act(async () => view.rerender(<Owner conversationId="other-1" />));
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        editorStub.markdownText = "# other chat";
        editorStub.emit("update");

        act(() => capturedController!.snapshotPreChatDraft(capture));

        expect(localStorage.getItem("canvas-draft")).toBe("# pre-chat");
    });

    it("re-arms the content captured at request start after a mid-request chat switch", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# pre-chat";
        editorStub.emit("update");
        const capture = capturedController!.capturePreChatDraft();

        // The user selects an existing chat while the placeholder creation
        // awaits: its canvas replaces the editor, and the adoption is not
        // announced for it.
        loadStateMock.mockResolvedValue("# stored");
        await act(async () => view.rerender(<Owner conversationId="other-1" />));
        await waitFor(() => expect(editorStub.markdownText).toBe("# stored"));

        act(() => capturedController!.snapshotPreChatDraft(capture));

        expect(localStorage.getItem("canvas-draft")).toBe("# pre-chat");
    });

    it("keeps an older request's recovery capture when a later request starts after a persisted-chat switch", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# first request";
        editorStub.emit("update");
        const firstCapture = capturedController!.capturePreChatDraft();

        loadStateMock.mockResolvedValue("# persisted");
        await act(async () => view.rerender(<Owner conversationId="other-1" />));
        await waitFor(() => expect(editorStub.markdownText).toBe("# persisted"));
        await act(async () => view.rerender(<Owner conversationId={undefined} />));

        editorStub.markdownText = "# later request";
        editorStub.emit("update");
        capturedController!.capturePreChatDraft();

        // The later request has not saved a draft. Its capture must not replace
        // the failed first request's recovery content.
        act(() => capturedController!.snapshotPreChatDraft(firstCapture));

        expect(localStorage.getItem("canvas-draft")).toBe("# first request");
    });

    it("disarms the adoption flag on a switch that does not consume it", async () => {
        const view = render(<Owner conversationId={undefined} />);

        const capture = capturedController!.capturePreChatDraft();
        act(() => capturedController!.beginAdoption(capture));

        // The placeholder arrives while a chat selection is already active:
        // the adoption cannot happen anymore, and the flag must not reach the
        // next existing-chat selection.
        await act(async () => view.rerender(<Owner conversationId="conv-a" />));
        await act(async () => view.rerender(<Owner conversationId={undefined} />));
        loadStateMock.mockResolvedValue("# stored");
        await act(async () => view.rerender(<Owner conversationId="existing-1" />));
        await waitFor(() => expect(editorStub.markdownText).toBe("# stored"));
    });

    it("keeps a pre-chat draft saved after the capture when the stale adoption re-arms", async () => {
        const view = render(<Owner conversationId={undefined} />);

        // First request: the page captures the pre-chat content at request
        // start; the adoption then clears the draft slot.
        editorStub.markdownText = "# from old request";
        editorStub.emit("update");
        const capture = capturedController!.capturePreChatDraft();
        act(() => capturedController!.beginAdoption(capture));
        await act(async () => view.rerender(<Owner conversationId="conv-a" />));

        // The user starts a later conversation-less session while the old
        // request is still in flight and saves a newer draft.
        await act(async () => view.rerender(<Owner conversationId={undefined} />));
        editorStub.markdownText = "# newer draft";
        editorStub.emit("update");
        await advanceDebounce();

        // The old request fails: the stale capture must not replace the
        // newer draft.
        act(() => capturedController!.snapshotPreChatDraft(capture));

        expect(localStorage.getItem("canvas-draft")).toBe("# newer draft");
    });

    it("re-arms after an aborted first turn that failed with no draft saved since adoption", async () => {
        const view = render(<Owner conversationId={undefined} />);

        editorStub.markdownText = "# pre-chat";
        editorStub.emit("update");
        const capture = capturedController!.capturePreChatDraft();
        act(() => capturedController!.beginAdoption(capture));
        await act(async () => view.rerender(<Owner conversationId="conv-a" />));
        // No newer draft: the slot was cleared at adoption and stays empty.
        expect(localStorage.getItem("canvas-draft")).toBeNull();

        act(() => capturedController!.snapshotPreChatDraft(capture));

        expect(localStorage.getItem("canvas-draft")).toBe("# pre-chat");
    });
});
