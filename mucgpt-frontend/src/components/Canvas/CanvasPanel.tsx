import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { canvasStorage } from "../../service/canvasStorage";
import { putCanvasRevisionsApi } from "../../api/core-client";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { CanvasEditor } from "./CanvasEditor";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasVersionsDrawer } from "./CanvasVersionsDrawer";
import styles from "./CanvasPanel.module.css";

const SAVE_REVISIONS_DEBOUNCE_MS = 1000;

interface Props {
    controller: CanvasControllerInstance;
    conversationId: string | undefined;
    onInsertIntoChat?: (markdown: string) => void;
    onAgentRevise?: (markdown: string) => void;
}

export const CanvasPanel = ({ controller, conversationId, onInsertIntoChat, onAgentRevise }: Props) => {
    const { t } = useTranslation();
    const [isVersionsOpen, setIsVersionsOpen] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);
    // Ref keeps effects conversation-scoped: they must not re-run (and re-load stale
    // content over live edits) just because the controller object identity changes.
    const controllerRef = useRef(controller);
    controllerRef.current = controller;

    // Content lifecycle (load/clear on conversation switch) lives in the controller;
    // the panel only persists what the editor emits.

    useEffect(() => {
        if (!conversationId) return;
        return controllerRef.current.subscribe(markdown => {
            void canvasStorage.saveCanvas(conversationId, markdown);
        });
    }, [conversationId]);

    // Ring changes persist debounced to IndexedDB and (best effort) to the server
    //; the PUT is 404-tolerant for conversations never persisted server-side.
    useEffect(() => {
        if (!conversationId) return;
        const timer = setTimeout(() => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            void canvasStorage.saveRevisions(conversationId, revisions);
            putCanvasRevisionsApi(conversationId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        }, SAVE_REVISIONS_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [conversationId, controller.revisions]);

    // Flush the rings on canvas close, conversation switch and unmount so a save
    // inside the debounce window is not lost (mirrors the content subscribe-flush
    // in useCanvasController). Keyed on conversationId only: the cleanup closes over
    // the outgoing id and runs before the controller resets to the new conversation.
    useEffect(() => {
        if (!conversationId) return;
        return () => {
            const revisions = controllerRef.current.listRevisions();
            if (revisions.auto.length === 0 && revisions.manual.length === 0) return;
            void canvasStorage.saveRevisions(conversationId, revisions);
            putCanvasRevisionsApi(conversationId, revisions).catch(error => console.error("Saving canvas revisions to the server failed:", error));
        };
    }, [conversationId]);

    useEffect(() => {
        const updateEmpty = () => setIsEmpty(controllerRef.current.getMarkdown().trim() === "");
        updateEmpty();
        return controllerRef.current.subscribe(markdown => setIsEmpty(markdown.trim() === ""));
    }, [conversationId, controller.revisions]);

    return (
        <section className={styles.panel} aria-label={t("canvas.panel_title")}>
            <CanvasToolbar editor={controller.editor} controller={controller} onOpenVersions={() => setIsVersionsOpen(true)} disabled={controller.isLocked} />
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
