import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageBar } from "@fluentui/react-components";

import { putCanvasRevisionsApi } from "../../api/core-client";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { useCanvasLimits } from "./canvasLimits";
import { CANVAS_PASTE_CLIPPED_EVENT } from "./canvasTextLimit";
import { CanvasEditor } from "./CanvasEditor";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasVersionsDrawer } from "./CanvasVersionsDrawer";
import styles from "./CanvasPanel.module.css";

const PASTE_CLIP_NOTICE_MS = 8000;

const SAVE_REVISIONS_DEBOUNCE_MS = 1000;

interface Props {
    controller: CanvasControllerInstance;
    conversationId: string | undefined;
    /** Backend conversation id for server requests; defaults to conversationId. */
    serverConversationId?: string;
    onInsertIntoChat?: (markdown: string) => void;
    onAgentRevise?: (markdown: string) => void;
}

export const CanvasPanel = ({ controller, conversationId, serverConversationId, onInsertIntoChat, onAgentRevise }: Props) => {
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

    // Content lifecycle (load/clear on conversation switch) lives in the controller;
    // the panel only persists revision rings to the server — the backend is the
    // single source of truth for canvas content, so nothing is mirrored locally.

    // Ring changes persist debounced to the server; the PUT is 404-tolerant for
    // conversations never persisted server-side.
    useEffect(() => {
        if (!serverId || !conversationId) return;
        const timer = setTimeout(() => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            putCanvasRevisionsApi(serverId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        }, SAVE_REVISIONS_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [serverId, conversationId, controller.revisions]);

    // Flush the rings on canvas close, conversation switch and unmount so a save
    // inside the debounce window is not lost. Keyed on conversationId only: the
    // cleanup closes over the outgoing id and runs before the controller resets
    // to the new conversation.
    useEffect(() => {
        if (!serverId || !conversationId) return;
        return () => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            putCanvasRevisionsApi(serverId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        };
    }, [serverId, conversationId]);

    useEffect(() => {
        const updateEmpty = () => setIsEmpty(controllerRef.current.getMarkdown().trim() === "");
        updateEmpty();
        return controllerRef.current.subscribe(markdown => {
            setIsEmpty(markdown.trim() === "");
            setOverLimit(markdown.length > limits.warnChars);
            setOverPersistLimit(markdown.length > limits.contentLimitChars);
        });
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
            <CanvasToolbar editor={controller.editor} controller={controller} onOpenVersions={() => setIsVersionsOpen(true)} disabled={controller.isLocked} />
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
                isLocked={controller.isLocked}
                getSelectionMarkdown={controller.getSelectionMarkdown}
                onInsertIntoChat={onInsertIntoChat}
                onAgentRevise={onAgentRevise}
            />
            <CanvasVersionsDrawer open={isVersionsOpen} onClose={() => setIsVersionsOpen(false)} controller={controller} />
        </section>
    );
};
