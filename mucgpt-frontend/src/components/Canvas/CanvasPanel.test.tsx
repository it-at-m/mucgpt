// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { putCanvasRevisionsApi } from "../../api/core-client";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { saveCanvasContent } from "../../service/canvasStorage";
import { CanvasPanel } from "./CanvasPanel";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./canvasLimits", () => ({ useCanvasLimits: () => ({ editorLimitChars: 512000, contentLimitChars: 256000, warnChars: 243200 }) }));
vi.mock("./CanvasEditor", () => ({ CanvasEditor: () => <div data-testid="canvas-editor" /> }));
vi.mock("./CanvasToolbar", () => ({ CanvasToolbar: () => <div /> }));
vi.mock("./CanvasVersionsDrawer", () => ({ CanvasVersionsDrawer: () => <div /> }));

vi.mock("../../api/core-client", async importOriginal => {
    const original = await importOriginal<typeof import("../../api/core-client")>();
    return { ...original, putCanvasRevisionsApi: vi.fn() };
});

vi.mock("../../service/canvasStorage", async importOriginal => {
    const original = await importOriginal<typeof import("../../service/canvasStorage")>();
    return { ...original, saveCanvasContent: vi.fn() };
});

const saveMock = vi.mocked(saveCanvasContent);
const putRevisionsMock = vi.mocked(putCanvasRevisionsApi);

type Subscriber = (markdown: string) => void;

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
}

const deferred = <T,>(): Deferred<T> => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => (resolve = r));
    return { promise, resolve };
};

/** Lets queued promise work (the serialized save chain) run before asserting. */
const drain = () => new Promise(resolve => setTimeout(resolve, 0));

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
        // No pending review changes: the review banner stays hidden in these
        // autosave tests (0 = none; see CanvasReviewBanner).
        pendingChangeCount: 0,
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
    putRevisionsMock.mockResolvedValue(undefined);
});

afterEach(() => {
    cleanup();
    saveMock.mockClear();
    putRevisionsMock.mockClear();
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
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
    });

    it("serializes saves so snapshots can never be written out of order", async () => {
        const controller = makeController();
        renderPanel(controller);
        const gate = deferred<boolean>();
        saveMock.mockImplementationOnce(() => gate.promise);

        controller.notify("# first");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
        expect(saveMock).toHaveBeenLastCalledWith("conv-1", "# first", false);

        controller.notify("# second");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(1);

        gate.resolve(true);
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
        expect(saveMock).toHaveBeenLastCalledWith("conv-1", "# second", false);
    });

    it("persists an undo back to the previous content while a newer save is in flight", async () => {
        const controller = makeController();
        renderPanel(controller);
        controller.notify("# A");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));

        const gate = deferred<boolean>();
        saveMock.mockImplementationOnce(() => gate.promise);
        controller.notify("# B");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));

        controller.notify("# A");
        controller.flush();
        gate.resolve(true);
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(3));
        expect(saveMock).toHaveBeenLastCalledWith("conv-1", "# A", false);
    });

    it("does not persist while the agent run locks the editor", async () => {
        const controller = makeController();
        controller.setLocked(true);
        renderPanel(controller);

        controller.notify("# agent is writing");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
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
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
    });

    it("does not persist an emptied document while the editor is mid-recreation", async () => {
        const controller = makeController();
        (controller.editor as { isDestroyed: boolean }).isDestroyed = true;
        renderPanel(controller);

        controller.notify("");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
    });

    it("persists a captured nonempty snapshot even when the editor is already destroyed", async () => {
        const controller = makeController();
        renderPanel(controller);
        controller.notify("# captured before unmount");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# captured before unmount", false));

        (controller.editor as { isDestroyed: boolean }).isDestroyed = true;
        controller.notify("# captured later");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# captured later", false));
    });

    it("does not persist emptiness when nothing nonempty was stored before", async () => {
        // A "" write while the current conversation's restore is pending (or
        // failed) would wipe the stored copy.
        const controller = makeController();
        renderPanel(controller);

        controller.notify("");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
    });

    it("persists an intentional clear after a nonempty document of this conversation was stored", async () => {
        const controller = makeController();
        const snapshotMock = controller.snapshot as unknown as ReturnType<typeof vi.fn>;
        renderPanel(controller);

        controller.notify("# document");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# document", false));

        snapshotMock.mockClear();
        controller.notify("");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "", false));
        // The cleared content got a rollback checkpoint and a cleared marker
        // (the load path restores the newest ring entry, which must be the
        // marker so the clear sticks after a reload) before the empty state
        // was stored.
        expect(snapshotMock).toHaveBeenCalledTimes(2);
        expect(snapshotMock).toHaveBeenNthCalledWith(1, "autosave");
        expect(snapshotMock).toHaveBeenNthCalledWith(2, "cleared");

        // Repeated empty notifications do not re-checkpoint or re-mark.
        controller.notify("");
        controller.flush();
        await drain();
        expect(snapshotMock).toHaveBeenCalledTimes(2);
    });

    it("does not checkpoint an empty write without a confirmed nonempty predecessor", async () => {
        const controller = makeController();
        const snapshotMock = controller.snapshot as unknown as ReturnType<typeof vi.fn>;
        renderPanel(controller);

        controller.notify("");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
        expect(snapshotMock).toHaveBeenCalledTimes(0);
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

    it("retries a failed snapshot once on unmount", async () => {
        saveMock.mockResolvedValue(false);
        const controller = makeController();
        const view = renderPanel(controller);

        controller.notify("# lost draft");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# lost draft", false));

        saveMock.mockResolvedValue(true);
        view.unmount();
        await waitFor(() => expect(saveMock).toHaveBeenLastCalledWith("conv-1", "# lost draft"));
    });

    it("persists content rewritten by a review decision", async () => {
        // Review actions (reject / accept-all of a pending review, version
        // restore) rewrite the document — the autosave must follow so the
        // stored copy always represents the current view.
        const controller = makeController();
        renderPanel(controller);

        controller.notify("# new text");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# new text", false));

        // Simulates rejecting the agent change: the document reverts to the
        // baseline content.
        controller.notify("# baseline text");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# baseline text", false));
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
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);
    });

    it("keeps the confirmed snapshot when a newer save fails", async () => {
        const controller = makeController();
        renderPanel(controller);
        controller.notify("# A");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# A", false));

        const gate = deferred<boolean>();
        saveMock.mockImplementationOnce(() => gate.promise);
        controller.notify("# B");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(2));
        gate.resolve(false);
        await drain();

        // The server still holds the confirmed A: an identical content is
        // deduplicated, the failed B is retried by the next distinct edit.
        saveMock.mockClear();
        controller.notify("# A");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(0);

        controller.notify("# C");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# C", false));
    });

    it("keepalive-flushes a queued snapshot on pagehide instead of dropping it", async () => {
        const controller = makeController();
        renderPanel(controller);
        const gate = deferred<boolean>();
        saveMock.mockImplementationOnce(() => gate.promise);
        controller.notify("# A");
        controller.flush();
        await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));

        controller.notify("# B");
        controller.flush();
        await drain();
        expect(saveMock).toHaveBeenCalledTimes(1);

        window.dispatchEvent(new Event("pagehide"));
        await waitFor(() => expect(saveMock).toHaveBeenCalledWith("conv-1", "# B", true));
    });

    it("flushes pending revision rings on pagehide with a keepalive request", async () => {
        const rings = { auto: [{ revision: 1, doc_json: {}, timestamp: 1, source: "agent" as const }], manual: [] };
        const controller = makeController({ revisions: rings, listRevisions: () => rings });
        renderPanel(controller);

        window.dispatchEvent(new Event("pagehide"));

        await waitFor(() => expect(putRevisionsMock).toHaveBeenCalledWith("conv-1", rings, true));
    });

    it("does not keepalive revision rings beyond the browser body cap", async () => {
        const rings = { auto: [{ revision: 1, doc_json: { blob: "x".repeat(70000) }, timestamp: 1, source: "agent" as const }], manual: [] };
        const controller = makeController({ revisions: rings, listRevisions: () => rings });
        renderPanel(controller);

        window.dispatchEvent(new Event("pagehide"));

        await drain();
        expect(putRevisionsMock).toHaveBeenCalledTimes(0);
    });
});
