// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { saveCanvasContent } from "../../service/canvasStorage";
import { CanvasPanel } from "./CanvasPanel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./canvasLimits", () => ({ useCanvasLimits: () => ({ editorLimitChars: 512000, contentLimitChars: 256000, warnChars: 243200 }) }));
vi.mock("./CanvasEditor", () => ({ CanvasEditor: () => <div data-testid="canvas-editor" /> }));
vi.mock("./CanvasToolbar", () => ({ CanvasToolbar: () => <div /> }));
vi.mock("./CanvasVersionsDrawer", () => ({ CanvasVersionsDrawer: () => <div /> }));

vi.mock("../../service/canvasStorage", async importOriginal => {
    const original = await importOriginal<typeof import("../../service/canvasStorage")>();
    return { ...original, saveCanvasContent: vi.fn() };
});

const saveMock = vi.mocked(saveCanvasContent);

type Subscriber = (markdown: string) => void;

/**
 * Minimal controller double reproducing the real subscribe semantics: debounced
 * notifications are queued via notify() and the unsubscribe cleanup performs a
 * synchronous flush to every subscriber.
 */
const makeController = (initial: Partial<CanvasControllerInstance> = {}) => {
    const subscribers = new Set<Subscriber>();
    const state = { latest: "", pending: null as string | null, isLocked: false };
    const flushPending = () => {
        if (state.pending === null) return;
        const markdown = state.pending;
        state.pending = null;
        subscribers.forEach(cb => cb(markdown));
    };
    const controller = {
        isOpen: true,
        setIsOpen: vi.fn(),
        isLocked: state.isLocked,
        editor: { isDestroyed: false },
        getMarkdown: () => state.latest,
        getSelectionMarkdown: () => null,
        snapshot: vi.fn(),
        listRevisions: () => ({ auto: [], manual: [] }),
        revisions: { auto: [], manual: [] },
        subscribe: (cb: Subscriber) => {
            subscribers.add(cb);
            return () => {
                flushPending();
                subscribers.delete(cb);
            };
        },
        notify: (markdown: string) => {
            state.latest = markdown;
            state.pending = markdown;
        },
        /** Fires the debounced notification like the real 1 s timer. */
        flush: flushPending,
        setLocked: (locked: boolean) => {
            state.isLocked = locked;
            controller.isLocked = locked;
        }
    } as unknown as CanvasControllerInstance & { notify(markdown: string): void; flush(): void; setLocked(locked: boolean): void };
    Object.assign(controller, initial);
    return controller;
};

const renderPanel = (controller: CanvasControllerInstance, conversationId = "conv-1") =>
    render(<CanvasPanel controller={controller} conversationId={conversationId} />);

beforeEach(() => {
    saveMock.mockResolvedValue(true);
});

afterEach(() => {
    cleanup();
    saveMock.mockClear();
});

describe("CanvasPanel content autosave", () => {
    it("persists debounced updates and skips unchanged content", async () => {
        const controller = makeController();
        renderPanel(controller);

        controller.notify("# draft");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# draft", false));

        saveMock.mockClear();
        controller.notify("# draft");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });

    it("does not persist while the agent run locks the editor", async () => {
        const controller = makeController();
        controller.setLocked(true);
        renderPanel(controller);

        controller.notify("# agent is writing");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });

    it("flushes the final document when the run unlocks the editor", async () => {
        const controller = makeController();
        controller.setLocked(true);
        const view = renderPanel(controller);

        controller.notify("# final agent state");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));

        controller.setLocked(false);
        view.rerender(<CanvasPanel controller={controller} conversationId="conv-1" />);
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# final agent state", false));
    });

    it("flushes pending edits on unmount (canvas close / page navigation)", async () => {
        const controller = makeController();
        const view = renderPanel(controller);

        controller.notify("# unsaved draft");
        view.unmount();

        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# unsaved draft", false));
    });

    it("does not persist a document beyond the persistence limit", async () => {
        const controller = makeController();
        renderPanel(controller);

        controller.notify("x".repeat(256001));
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });

    it("does not persist while the editor is mid-recreation", async () => {
        const controller = makeController();
        (controller.editor as { isDestroyed: boolean }).isDestroyed = true;
        renderPanel(controller);

        controller.notify("# drafted during recreation");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });

    it("never persists an emptied document", async () => {
        // A "" write during a conversation switch (editor cleared before the
        // async restore) or after a failed load would wipe the stored copy.
        const controller = makeController();
        renderPanel(controller);

        controller.notify("");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });

    it("scopes the unchanged-content suppression to the conversation", async () => {
        const controller = makeController();
        const view = renderPanel(controller, "conv-1");
        controller.notify("# draft");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# draft", false));

        // Same content for a different conversation must be persisted again.
        view.rerender(<CanvasPanel controller={controller} conversationId="conv-2" />);
        saveMock.mockClear();
        controller.notify("# draft");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-2", "# draft", false));
    });

    it("flushes on pagehide with a keepalive request", async () => {
        const controller = makeController();
        renderPanel(controller);

        controller.notify("# draft before reload");
        window.dispatchEvent(new Event("pagehide"));
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# draft before reload", true));
    });

    it("does not keepalive documents beyond the browser body cap", async () => {
        const controller = makeController();
        renderPanel(controller);

        // 60 kB is the local keepalive safety margin (browser cap: 64 kB).
        controller.notify("a".repeat(60001));
        window.dispatchEvent(new Event("pagehide"));
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(0));
    });
});
