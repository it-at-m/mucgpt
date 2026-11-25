import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageBar } from "@fluentui/react-components";

import { putCanvasRevisionsApi } from "../../api/core-client";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { clearCanvasDraft, saveCanvasDraft } from "./canvasDraft";
import { saveCanvasContent } from "../../service/canvasStorage";
import { useCanvasLimits } from "./canvasLimits";
import { CANVAS_PASTE_CLIPPED_EVENT } from "./canvasTextLimit";
import { CanvasEditor } from "./CanvasEditor";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasVersionsDrawer } from "./CanvasVersionsDrawer";
import styles from "./CanvasPanel.module.css";

const PASTE_CLIP_NOTICE_MS = 8000;

const SAVE_REVISIONS_DEBOUNCE_MS = 1000;

/** Safety margin below the browsers' 64 kB keepalive body cap. */
const KEEPALIVE_MAX_BYTES = 60000;

/** A content snapshot queued for autosave; seq orders concurrent snapshots. */
interface PersistEntry {
    seq: number;
    conversationId: string;
    serverId: string;
    content: string;
}

interface Props {
    controller: CanvasControllerInstance;
    conversationId: string | undefined;
    /** Backend conversation id for server requests; defaults to conversationId. */
    serverConversationId?: string;
    readOnly?: boolean;
    onInsertIntoChat?: (markdown: string) => void;
    onAgentRevise?: (markdown: string) => void;
}

export const CanvasPanel = ({ controller, conversationId, serverConversationId, readOnly = false, onInsertIntoChat, onAgentRevise }: Props) => {
    const { t } = useTranslation();
    const [isVersionsOpen, setIsVersionsOpen] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);
    const [overLimit, setOverLimit] = useState(false);
    const [overPersistLimit, setOverPersistLimit] = useState(false);
    const [clipNotice, setClipNotice] = useState(false);
    // Ref keeps effects conversation-scoped: they must not re-run (and re-load stale
    // content over live edits) just because the controller object identity changes.
    const controllerRef = useRef(controller);
    controllerRef.current = controller;
    const serverId = serverConversationId ?? conversationId;
    const limits = useCanvasLimits();
    const isLocked = controller.isLocked || readOnly;

    // Panel-side persistence: revision rings plus content autosave; the backend
    // is the single source of truth, so nothing is mirrored locally.
    // Last content confirmed stored (optimistically set when enqueued).
    const ackedRef = useRef<PersistEntry | null>(null);
    // Queued or in-flight save.
    const pendingRef = useRef<PersistEntry | null>(null);
    // Failed save, retried once on cleanup and by any later attempt.
    const unsavedRef = useRef<PersistEntry | null>(null);
    // Saved snapshots are serialized: at most one request in flight, so content
    // can never be written to the server out of order.
    const chainRef = useRef<Promise<unknown>>(Promise.resolve());
    const seqRef = useRef(0);
    const wasLockedRef = useRef(controller.isLocked);

    const sendEntry = (entry: PersistEntry, keepalive: boolean) =>
        saveCanvasContent(entry.serverId, entry.content, keepalive).then(ok => {
            if (ok) {
                if ((unsavedRef.current?.seq ?? -1) < entry.seq) unsavedRef.current = null;
                // ackedRef tracks CONFIRMED server state only: it is advanced
                // on success and preserved on failure, so the clear guard and
                // the dedupe never treat an unconfirmed snapshot as stored.
                if ((ackedRef.current?.seq ?? -1) < entry.seq) ackedRef.current = entry;
            } else {
                // Not stored: allow a retry by the next attempt and keep the
                // snapshot for the cleanup flush (below). The previously
                // confirmed entry stays untouched — the server still holds it.
                if ((unsavedRef.current?.seq ?? -1) < entry.seq) unsavedRef.current = entry;
            }
            if (pendingRef.current?.seq === entry.seq) pendingRef.current = null;
        });

    // All autosave entry points funnel through here.
    const persistContent = useCallback(
        (markdown: string, options: { keepalive?: boolean; force?: boolean } = {}) => {
            const { keepalive = false, force = false } = options;
            if (readOnly || !serverId || !conversationId) return;
            const editor = controllerRef.current.editor;
            // A mid-recreation or destroyed editor serializes to "" — only
            // empty content from it is untrustworthy; a captured nonempty
            // snapshot stays valid even when the editor is already gone
            // (unmount cleanups can destroy it before this flush runs).
            if ((!editor || editor.isDestroyed) && !markdown.trim()) return;
            // Agent streams are flushed at run end (unlock effect below).
            if (controllerRef.current.isLocked) return;
            const acked = ackedRef.current;
            // A "" write while the current conversation's restore is still
            // pending (or failed) would wipe the stored copy; persist an
            // emptied document only after a nonempty document of this
            // conversation was confirmed stored (intentional clear).
            const intentionalClear = !markdown.trim() && !!acked && acked.conversationId === conversationId && !!acked.content.trim();
            if (!markdown.trim() && !intentionalClear) return;
            // Over the persist limit only a truncated beginning would be
            // stored — same rule as the per-turn implicit save.
            if (markdown.length > limits.contentLimitChars) return;
            // Large documents fail closed and keep the debounce behavior.
            if (keepalive && new TextEncoder().encode(markdown).length > KEEPALIVE_MAX_BYTES) return;
            const pending = pendingRef.current;
            // A queued snapshot identical to this one is already handled —
            // unless forced (pagehide): the queued PUT may never run after an
            // unload begins, so the keepalive dispatch must not be skipped.
            if (!force && pending && pending.conversationId === conversationId && pending.content === markdown) return;
            if (
                !force &&
                acked &&
                acked.conversationId === conversationId &&
                (!pending || pending.conversationId !== conversationId) &&
                acked.content === markdown
            )
                return;
            if (intentionalClear) {
                // Rollback point: the pre-clear content must be restorable
                // before the empty state is stored.
                controllerRef.current.snapshot("autosave");
                // Marker entry: the load path falls back to the newest ring
                // entry when the stored content is empty — without this
                // marker it would resurrect the pre-clear backup instead of
                // the intentional clear.
                controllerRef.current.snapshot("cleared");
            }
            const entry: PersistEntry = { seq: ++seqRef.current, conversationId, serverId, content: markdown };
            pendingRef.current = entry;
            if (keepalive) {
                // Unload: dispatch immediately, chained microtasks may never run.
                void sendEntry(entry, true);
            } else {
                const run = chainRef.current.then(
                    () => sendEntry(entry, false),
                    () => sendEntry(entry, false)
                );
                chainRef.current = run.then(
                    () => undefined,
                    () => undefined
                );
            }
        },
        [readOnly, serverId, conversationId, limits.contentLimitChars]
    );

    // The controller's subscribe channel debounces 1 s and flushes
    // synchronously on unsubscribe (canvas close, switch, unmount).
    useEffect(() => {
        const onEdit = (markdown: string) => {
            // Without a conversation there is no server autosave yet: the
            // debounced edit stream feeds the pre-chat sessionStorage draft
            // instead. A trimmed-empty document is an intentional clear and
            // drops the draft; over-limit content is not stored (fail closed,
            // same rule as the server persist below).
            if (!conversationId) {
                if (markdown.trim() && markdown.length <= limits.contentLimitChars) saveCanvasDraft(markdown);
                else clearCanvasDraft();
                return;
            }
            persistContent(markdown);
        };
        return controllerRef.current.subscribe(onEdit);
    }, [conversationId, persistContent, limits.contentLimitChars]);

    // Run end: persist the final state so agent edits don't lag the stored
    // copy; forced, because the server may hold turn-start content the panel
    // never saved itself.
    useEffect(() => {
        const wasLocked = wasLockedRef.current;
        wasLockedRef.current = controller.isLocked;
        if (!wasLocked || controller.isLocked) return;
        persistContent(controllerRef.current.getMarkdown(), { force: true });
    }, [controller.isLocked, persistContent]);

    // Reload/close: flush content and revision rings with keepalive fetches
    // that survive the unload. Oversized payloads fail closed and keep the
    // debounce/unmount behavior. Without a conversation the sessionStorage
    // draft takes the place of the server save: synchronous and debounce-free,
    // so the last edit window survives the unload.
    useEffect(() => {
        if (readOnly) return;
        const onPageHide = () => {
            const markdown = controllerRef.current.getMarkdown();
            if (!conversationId) {
                if (markdown.trim() && markdown.length <= limits.contentLimitChars) saveCanvasDraft(markdown);
                return;
            }
            if (!serverId) return;
            persistContent(markdown, { keepalive: true, force: true });
            const revisions = controllerRef.current.listRevisions();
            if (!revisions.auto.length && !revisions.manual.length) return;
            // Browsers cap keepalive bodies at 64 kB; rings carry document
            // snapshots, so measure the exact request body.
            const body = JSON.stringify({ ...revisions });
            if (new TextEncoder().encode(body).length > KEEPALIVE_MAX_BYTES) return;
            putCanvasRevisionsApi(serverId, revisions, true).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        };
        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, [readOnly, serverId, conversationId, persistContent, limits.contentLimitChars]);

    // Retry a failed autosave once on unmount or conversation switch: after a
    // failure the debounce timer is gone, so navigation would otherwise drop
    // the last snapshot.
    useEffect(() => {
        if (readOnly || !conversationId) return;
        return () => {
            const unsaved = unsavedRef.current;
            if (unsaved && unsaved.conversationId === conversationId) void saveCanvasContent(unsaved.serverId, unsaved.content);
        };
    }, [readOnly, conversationId]);

    // Ring changes persist debounced to the server; the PUT is 404-tolerant for
    // conversations never persisted server-side.
    useEffect(() => {
        if (readOnly || !serverId || !conversationId) return;
        const timer = setTimeout(() => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            putCanvasRevisionsApi(serverId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        }, SAVE_REVISIONS_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [readOnly, serverId, conversationId, controller.revisions]);

    // Flush the rings on canvas close, conversation switch and unmount so a save
    // inside the debounce window is not lost. Keyed on conversationId only: the
    // cleanup closes over the outgoing id and runs before the controller resets
    // to the new conversation.
    useEffect(() => {
        if (readOnly || !serverId || !conversationId) return;
        return () => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            putCanvasRevisionsApi(serverId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        };
    }, [readOnly, serverId, conversationId]);

    useEffect(() => {
        // Evaluated immediately (not only on the debounced update callback), so
        // a freshly mounted panel shows the correct state for already-loaded
        // content — e.g. the persistent notice for a restored oversized doc.
        const update = (markdown: string) => {
            setIsEmpty(markdown.trim() === "");
            setOverLimit(markdown.length > limits.warnChars);
            setOverPersistLimit(markdown.length > limits.contentLimitChars);
        };
        update(controllerRef.current.getMarkdown());
        return controllerRef.current.subscribe(update);
    }, [conversationId, controller.revisions, limits.warnChars, limits.contentLimitChars]);

    // Fired by the editor's size guard when pasted content was clipped.
    useEffect(() => {
        const timer = { id: undefined as ReturnType<typeof setTimeout> | undefined };
        const onClipped = () => {
            setClipNotice(true);
            clearTimeout(timer.id);
            timer.id = setTimeout(() => setClipNotice(false), PASTE_CLIP_NOTICE_MS);
        };
        window.addEventListener(CANVAS_PASTE_CLIPPED_EVENT, onClipped);
        return () => {
            clearTimeout(timer.id);
            window.removeEventListener(CANVAS_PASTE_CLIPPED_EVENT, onClipped);
        };
    }, []);

    return (
        <section className={styles.panel} aria-label={t("canvas.panel_title")}>
            <CanvasToolbar editor={controller.editor} controller={controller} onOpenVersions={() => setIsVersionsOpen(true)} disabled={isLocked} />
            {clipNotice && <MessageBar intent="warning">{t("canvas.limit_paste_clipped", { limit: limits.editorLimitChars.toLocaleString() })}</MessageBar>}
            {!clipNotice && overLimit && <MessageBar intent="warning">{t("canvas.limit_warning")}</MessageBar>}
            {overPersistLimit && <MessageBar intent="warning">{t("canvas.limit_persist_notice")}</MessageBar>}
            {controller.isLocked && (
                <div className={styles.statusLine}>
                    <span className={styles.shimmer}>{t("canvas.status_writing")}</span>
                </div>
            )}
            {isEmpty && (
                <div className={styles.emptyState}>
                    <p className={styles.emptyTitle}>{t("canvas.empty_state")}</p>
                    <p className={styles.emptyHint}>{t("canvas.empty_state_hint")}</p>
                </div>
            )}
            <CanvasEditor
                editor={controller.editor}
                isLocked={isLocked}
                getSelectionMarkdown={controller.getSelectionMarkdown}
                onInsertIntoChat={onInsertIntoChat}
                onAgentRevise={onAgentRevise}
            />
            <CanvasVersionsDrawer open={isVersionsOpen} onClose={() => setIsVersionsOpen(false)} controller={controller} disabled={controller.isLocked} />
        </section>
    );
};
