import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageBar } from "@fluentui/react-components";

import { putCanvasRevisionsApi } from "../../api/core-client";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
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
    // Last content confirmed stored, scoped per conversation.
    const lastPersistedContentRef = useRef<{ conversationId: string; content: string } | null>(null);
    const wasLockedRef = useRef(controller.isLocked);

    // All autosave entry points funnel through here.
    const persistContent = useCallback(
        (markdown: string, keepalive = false) => {
            if (readOnly || !serverId || !conversationId) return;
            const editor = controllerRef.current.editor;
            // A mid-recreation editor serializes to "".
            if (!editor || editor.isDestroyed) return;
            // Agent streams are flushed at run end (unlock effect below).
            if (controllerRef.current.isLocked) return;
            // A "" write while the current conversation's restore is still
            // pending (or failed) would wipe the stored copy.
            if (!markdown.trim()) return;
            // Over the persist limit only a truncated beginning would be
            // stored — same rule as the per-turn implicit save.
            if (markdown.length > limits.contentLimitChars) return;
            // Large documents fail closed and keep the debounce behavior.
            if (keepalive && new TextEncoder().encode(markdown).length > KEEPALIVE_MAX_BYTES) return;
            const persisted = lastPersistedContentRef.current;
            if (persisted && persisted.conversationId === conversationId && persisted.content === markdown) return;
            void saveCanvasContent(serverId, markdown, keepalive).then(saved => {
                if (saved) lastPersistedContentRef.current = { conversationId, content: markdown };
            });
        },
        [readOnly, serverId, conversationId, limits.contentLimitChars]
    );

    // The controller's subscribe channel debounces 1 s and flushes
    // synchronously on unsubscribe (canvas close, switch, unmount).
    useEffect(() => {
        return controllerRef.current.subscribe(markdown => persistContent(markdown));
    }, [persistContent]);

    // Run end: persist the final state so agent edits don't lag the stored copy.
    useEffect(() => {
        const wasLocked = wasLockedRef.current;
        wasLockedRef.current = controller.isLocked;
        if (!wasLocked || controller.isLocked) return;
        persistContent(controllerRef.current.getMarkdown());
    }, [controller.isLocked, persistContent]);

    // Reload/close: flush with a keepalive fetch that survives the unload.
    useEffect(() => {
        if (readOnly || !serverId || !conversationId) return;
        const onPageHide = () => persistContent(controllerRef.current.getMarkdown(), true);
        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, [readOnly, serverId, conversationId, persistContent]);

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
