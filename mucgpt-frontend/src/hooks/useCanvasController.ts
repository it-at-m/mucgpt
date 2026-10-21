import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content, Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

import type { CanvasState } from "../api/models";
import { loadCanvasRevisions, type CanvasRevision, type CanvasRevisions } from "../service/canvasStorage";
import type { CanvasStreamEvent } from "../utils/canvasStream";
import { canvasExtensions } from "../components/Canvas/canvasExtensions";

/**
 * Interface between the canvas UI and the chat page.
 * Consumed by the chat page wiring.
 */
export interface CanvasController {
    isOpen: boolean;
    setIsOpen(open: boolean): void;
    /** True while the agent is writing */
    isLocked: boolean;
    lock(): void;
    unlock(): void;
    getMarkdown(): string;
    /** expandMarks: selection-expansion rule, v1.1 */
    getSelectionMarkdown(opts?: { expandMarks?: boolean }): string | null;
    /** Full replace; clears selection */
    setMarkdown(md: string): void;
    /** Null when closed or empty */
    toCanvasState(): CanvasState | null;
    /** APPEND → live insert; UPDATE → replace doc */
    applyStreamEvent(ev: CanvasStreamEvent): void;
    /** Debounced; used for autosave */
    subscribe(cb: (markdown: string) => void): () => void;
    /** PM-JSON snapshot into the revision rings */
    snapshot(source: "agent" | "manual" | "restore"): void;
    listRevisions(): CanvasRevisions;
    /** Non-destructive: setContent(doc_json) as new transaction; undoable via Ctrl+Z */
    restore(revision: number): void;
}

export interface CanvasControllerInstance extends CanvasController {
    editor: Editor | null;
    revisions: CanvasRevisions;
}

const AUTO_RING_CAP = 25;
const MANUAL_RING_CAP = 5;
const AUTOSAVE_DEBOUNCE_MS = 1000;
/** Live-inserted APPEND deltas are deliberately excluded from undo history; the final UPDATE lands as the single undoable agent transaction. */
const NO_HISTORY_META = "addToHistory";

interface MarkdownEditorStorage {
    serializer: { serialize(node: PMNode): string };
}

const markdownStorage = (editor: Editor): MarkdownEditorStorage => (editor.storage as unknown as Record<string, unknown>).markdown as MarkdownEditorStorage;

const pushCapped = (ring: CanvasRevision[], revision: CanvasRevision, cap: number): CanvasRevision[] => [...ring, revision].slice(-cap);

const emptyRevisions = (): CanvasRevisions => ({ auto: [], manual: [] });

export function useCanvasController(conversationId: string | undefined): CanvasControllerInstance {
    const editor = useEditor({
        extensions: canvasExtensions,
        content: ""
    });
    const editorRef = useRef<Editor | null>(editor);
    editorRef.current = editor;

    const openByConversationRef = useRef(new Map<string, boolean>());
    const [isOpen, setIsOpenState] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [revisions, setRevisions] = useState<CanvasRevisions>(emptyRevisions);

    const nextRevisionRef = useRef(1);
    const lastStreamRevisionRef = useRef(0);
    const subscribersRef = useRef(new Set<(markdown: string) => void>());
    const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revisionsRef = useRef(revisions);
    revisionsRef.current = revisions;

    const getMarkdown = useCallback((): string => {
        const current = editorRef.current;
        if (!current) return "";
        return markdownStorage(current).serializer.serialize(current.state.doc);
    }, []);

    const notifySubscribers = useCallback(() => {
        if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
        notifyTimerRef.current = setTimeout(() => {
            notifyTimerRef.current = null;
            const markdown = getMarkdown();
            subscribersRef.current.forEach(cb => cb(markdown));
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [getMarkdown]);

    useEffect(() => {
        if (!editor) return;
        editor.on("update", notifySubscribers);
        return () => {
            editor.off("update", notifySubscribers);
        };
    }, [editor, notifySubscribers]);

    useEffect(() => {
        openByConversationRef.current.set(conversationId ?? "", isOpen);
    }, [conversationId, isOpen]);

    // Conversation switch: reset run-scoped state and restore the remembered open flag + revision rings.
    useEffect(() => {
        lastStreamRevisionRef.current = 0;
        nextRevisionRef.current = 1;
        setIsLocked(false);
        setIsOpenState(openByConversationRef.current.get(conversationId ?? "") ?? false);
        setRevisions(emptyRevisions());
        let cancelled = false;
        if (conversationId) {
            loadCanvasRevisions(conversationId)
                .then(stored => {
                    if (cancelled || !stored) return;
                    // Keep the monotonic revision counter ahead of the loaded rings so
                    // new snapshots never collide with stored revision numbers.
                    const maxRevision = Math.max(0, ...stored.auto.map(entry => entry.revision), ...stored.manual.map(entry => entry.revision));
                    nextRevisionRef.current = maxRevision + 1;
                    setRevisions(stored);
                })
                .catch(error => console.error("Loading canvas revisions failed:", error));
        }
        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    const setIsOpen = useCallback(
        (open: boolean) => {
            setIsOpenState(open);
            if (conversationId) openByConversationRef.current.set(conversationId, open);
        },
        [conversationId]
    );

    // Called on RUN_STARTED: the server numbers canvas_revision per run,
    // so the monotonicity guard must reset per run, not per conversation.
    const lock = useCallback(() => {
        lastStreamRevisionRef.current = 0;
        setIsLocked(true);
    }, []);
    const unlock = useCallback(() => setIsLocked(false), []);

    const getSelectionMarkdown = useCallback((opts?: { expandMarks?: boolean } | undefined): string | null => {
        // expandMarks (selection-expansion rule) is deferred to v1.1.
        void opts?.expandMarks;
        const current = editorRef.current;
        if (!current) return null;
        const { from, to, empty } = current.state.selection;
        if (empty) return null;
        return markdownStorage(current).serializer.serialize(current.state.doc.cut(from, to));
    }, []);

    const setMarkdown = useCallback((md: string) => {
        editorRef.current?.commands.setContent(md);
    }, []);

    const toCanvasState = useCallback((): CanvasState | null => {
        if (!isOpen) return null;
        const content = getMarkdown();
        if (!content.trim()) return null;
        return { content, selection: getSelectionMarkdown() };
    }, [isOpen, getMarkdown, getSelectionMarkdown]);

    const applyStreamEvent = useCallback((ev: CanvasStreamEvent) => {
        const current = editorRef.current;
        if (!current) return;
        if (ev.state === "UPDATE") {
            const revision = ev.metadata?.canvas_revision;
            if (typeof revision === "number") {
                if (revision <= lastStreamRevisionRef.current) return;
                lastStreamRevisionRef.current = revision;
            }
            current.commands.setContent(ev.content);
        } else if (ev.state === "APPEND") {
            const doc = current.state.doc;
            const endPos = doc.content.size;
            // Append inside the trailing paragraph when possible; when the document ends in a
            // non-textblock (table, code block), insert after it as a new paragraph.
            const insertPos = doc.resolve(Math.max(endPos - 1, 0)).parent.inlineContent ? endPos - 1 : endPos;
            current
                .chain()
                .command(({ tr }) => {
                    tr.setMeta(NO_HISTORY_META, false);
                    return true;
                })
                .insertContentAt(insertPos, ev.content)
                .run();
        }
    }, []);

    const subscribe = useCallback(
        (cb: (markdown: string) => void) => {
            subscribersRef.current.add(cb);
            return () => {
                // Final synchronous flush so edits inside the debounce window are not
                // lost when the panel unsubscribes (canvas close / unmount).
                if (notifyTimerRef.current) {
                    clearTimeout(notifyTimerRef.current);
                    notifyTimerRef.current = null;
                    const markdown = getMarkdown();
                    subscribersRef.current.forEach(subscriber => subscriber(markdown));
                }
                subscribersRef.current.delete(cb);
            };
        },
        [getMarkdown]
    );

    useEffect(() => {
        return () => {
            if (notifyTimerRef.current) {
                clearTimeout(notifyTimerRef.current);
                notifyTimerRef.current = null;
            }
        };
    }, []);

    const snapshot = useCallback((source: CanvasRevision["source"]) => {
        const current = editorRef.current;
        if (!current) return;
        const revision: CanvasRevision = {
            revision: nextRevisionRef.current++,
            doc_json: current.getJSON(),
            timestamp: Date.now(),
            source
        };
        setRevisions(prev =>
            source === "manual"
                ? { ...prev, manual: pushCapped(prev.manual, revision, MANUAL_RING_CAP) }
                : { ...prev, auto: pushCapped(prev.auto, revision, AUTO_RING_CAP) }
        );
    }, []);

    const listRevisions = useCallback((): CanvasRevisions => revisionsRef.current, []);

    const restore = useCallback(
        (revision: number) => {
            const current = editorRef.current;
            const all = [...revisionsRef.current.auto, ...revisionsRef.current.manual];
            const found = all.find(entry => entry.revision === revision);
            if (!current || !found) return;
            current.commands.setContent(found.doc_json as Content);
            snapshot("restore");
        },
        [snapshot]
    );

    return useMemo(
        () => ({
            isOpen,
            setIsOpen,
            isLocked,
            lock,
            unlock,
            getMarkdown,
            getSelectionMarkdown,
            setMarkdown,
            toCanvasState,
            applyStreamEvent,
            subscribe,
            snapshot,
            listRevisions,
            restore,
            editor,
            revisions
        }),
        [
            isOpen,
            setIsOpen,
            isLocked,
            lock,
            unlock,
            getMarkdown,
            getSelectionMarkdown,
            setMarkdown,
            toCanvasState,
            applyStreamEvent,
            subscribe,
            snapshot,
            listRevisions,
            restore,
            editor,
            revisions
        ]
    );
}
