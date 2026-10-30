import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content, Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";

import type { CanvasState } from "../api/models";
import { CANVAS_CONTENT_LIMIT_CHARS } from "../components/Canvas/canvasLimits";
import { loadCanvasRevisions, loadCanvasState, parseCanvasRevisions, type CanvasRevision, type CanvasRevisions } from "../service/canvasStorage";
import type { CanvasStreamEvent } from "../utils/canvasStream";
import { CANVAS_PERSISTENCE_RESET, persistentCaret } from "../components/Canvas/canvasSelectionPersistence";
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
    getSelectionMarkdown(): string | null;
    /** Full replace; clears selection */
    setMarkdown(md: string): void;
    /** Null only when no canvas content exists; sent open or closed */
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

export const markdownStorage = (editor: Editor): MarkdownEditorStorage =>
    (editor.storage as unknown as Record<string, unknown>).markdown as MarkdownEditorStorage;

const pushCapped = (ring: CanvasRevision[], revision: CanvasRevision, cap: number): CanvasRevision[] => [...ring, revision].slice(-cap);

const emptyRevisions = (): CanvasRevisions => ({ auto: [], manual: [] });

/**
 * Selection starting inside a table: the cut document's first row is a partial
 * body row, which the GFM serializer rejects (it would collapse to "[table]"),
 * so quote coordinates plus the verbatim cell text instead. The text stays a
 * document substring, which canvas_edit's selection check relies on.
 * Row 1 is the header row; the canvas schema allows no colspans, so the cell
 * index is the column index. The highlighted text may be a partial cell, hence
 * "referenced text" rather than "cell content".
 */
export const tableSelectionMarkdown = (state: EditorState): string | null => {
    const { $from, $to, from, to } = state.selection;
    let tableDepth = 0;
    for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "table") {
            tableDepth = d;
            break;
        }
    }
    if (!tableDepth || $from.pos <= $from.start(tableDepth)) return null;

    const startRow = $from.index(tableDepth) + 1;
    const startCol = $from.index(tableDepth + 1) + 1;
    const sameTable = $to.depth > tableDepth && $to.node(tableDepth) === $from.node(tableDepth);
    const endRow = sameTable ? $to.index(tableDepth) + 1 : startRow;
    const endCol = sameTable ? $to.index(tableDepth + 1) + 1 : startCol;

    const table = $from.node(tableDepth);
    const range = (word: string, start: number, end: number) => (end > start ? `${word}s ${start}-${end}` : `${word} ${start}`);
    const headerCell = startRow > 1 ? table.child(0)?.child(startCol - 1) : null;
    const col = headerCell?.type.name === "tableHeader" && headerCell.textContent.trim() ? `col "${headerCell.textContent.trim()}"` : `col ${startCol}`;

    const text = state.doc.textBetween(from, to, " ", " ");
    return `[table, ${range("row", startRow, endRow)}, ${endCol > startCol ? range("col", startCol, endCol) : col}, referenced text: "${text}"]`;
};

/**
 * Caret position as character offset into the serialized markdown, so the agent
 * can anchor edits near "where the user is" in the same text it sees. Uses the
 * selection start, so a selected passage reports where it begins.
 */
export const caretMarkdownOffset = (editor: Editor | null, pos?: number): number | null => {
    if (!editor) return null;
    const { doc, selection } = editor.state;
    const at = pos ?? selection.from;
    if (at >= doc.content.size) {
        return markdownStorage(editor).serializer.serialize(doc).length;
    }
    const prefix = markdownStorage(editor).serializer.serialize(doc.cut(0, at));
    return prefix.replace(/\n$/, "").length;
};

export function useCanvasController(conversationId: string | undefined): CanvasControllerInstance {
    const editor = useEditor({
        extensions: canvasExtensions,
        content: ""
    });
    const editorRef = useRef<Editor | null>(editor);
    editorRef.current = editor;

    const [isOpen, setIsOpenState] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [revisions, setRevisions] = useState<CanvasRevisions>(emptyRevisions);

    const nextRevisionRef = useRef(1);
    const lastStreamRevisionRef = useRef(-1);
    // Tracks the conversation the switch effect last ran with; starts as a sentinel
    // (not undefined) so the initial mount load isn't mistaken for an id assignment.
    const prevConversationIdRef = useRef<string | undefined | "uninitialized">("uninitialized");
    // Mirrors isOpen for the switch effect, which must not depend on the state value
    // (adding it to the deps would re-run the whole switch on every open/close toggle).
    const isOpenRef = useRef(false);
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

    // Conversation switch: reset run-scoped state, clear the editor and reopen only
    // when the conversation's stored canvas has content — the open state is derived
    // from content, so new (empty) chats always start closed.
    useEffect(() => {
        const previous = prevConversationIdRef.current;
        prevConversationIdRef.current = conversationId;
        // The undefined→id transition is ambiguous: either the first prompt of this
        // new chat just got its id (same logical conversation — the canvas is open
        // and/or holds content: keep everything) or a page reload is restoring an
        // existing conversation (fresh controller, canvas closed and empty: run the
        // load path below to restore the stored canvas before an empty canvas state
        // is sent and overwrites it server-side).
        if (previous === undefined && conversationId !== undefined && (isOpenRef.current || getMarkdown().trim())) return;

        lastStreamRevisionRef.current = -1;
        nextRevisionRef.current = 1;
        setIsLocked(false);
        setIsOpen(false);
        setRevisions(emptyRevisions());
        const current = editorRef.current;
        if (current && getMarkdown().trim()) {
            current.commands.setContent("");
            // A stale caret/selection must not leak into another conversation's document.
            current.view.dispatch(current.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
        }
        let cancelled = false;
        if (conversationId) {
            loadCanvasRevisions(conversationId)
                .then(stored => {
                    if (cancelled || !stored) return;
                    const rings = parseCanvasRevisions(stored);
                    // Keep the monotonic revision counter ahead of the loaded rings so
                    // new snapshots never collide with stored revision numbers.
                    const maxRevision = Math.max(0, ...rings.auto.map(entry => entry.revision), ...rings.manual.map(entry => entry.revision));
                    nextRevisionRef.current = maxRevision + 1;
                    setRevisions(rings);
                })
                .catch(error => console.error("Loading canvas revisions failed:", error));
            loadCanvasState(conversationId)
                .then(stored => {
                    if (cancelled) return;
                    if (stored === null || !stored.trim()) return;
                    const editor = editorRef.current;
                    if (!editor) return;
                    editor.commands.setContent(stored);
                    editor.view.dispatch(editor.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
                    setIsOpen(true);
                })
                .catch(error => console.error("Loading canvas content failed:", error));
        }
        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    const setIsOpen = useCallback((open: boolean) => {
        isOpenRef.current = open;
        setIsOpenState(open);
    }, []);

    // Called on RUN_STARTED: the server numbers canvas_revision per run,
    // so the monotonicity guard must reset per run, not per conversation.
    const lock = useCallback(() => {
        lastStreamRevisionRef.current = -1;
        setIsLocked(true);
    }, []);
    const unlock = useCallback(() => setIsLocked(false), []);

    const getSelectionMarkdown = useCallback((): string | null => {
        const current = editorRef.current;
        if (!current) return null;
        const { from, to, empty } = current.state.selection;
        if (empty) return null;
        return tableSelectionMarkdown(current.state) ?? markdownStorage(current).serializer.serialize(current.state.doc.cut(from, to));
    }, []);

    const setMarkdown = useCallback((md: string) => {
        editorRef.current?.commands.setContent(md);
    }, []);

    const toCanvasState = useCallback((): CanvasState | null => {
        // The canvas is always editable: whenever the document has content it is
        // sent with the request — panel open or closed — so the agent works on
        // the document the user last saw and the server copy stays in sync. An
        // open empty document still counts as an active canvas the agent may
        // write into. Beyond the content limit the document is only readable
        // and exportable: the request carries the clipped content (the backend
        // caps at the same value), the caret only anchors while it sits in the
        // readable part, and oversized selections are meaningless to the agent.
        const markdown = getMarkdown();
        if (!isOpen && !markdown?.trim()) return null;
        const content = markdown.length > CANVAS_CONTENT_LIMIT_CHARS ? markdown.slice(0, CANVAS_CONTENT_LIMIT_CHARS) : markdown;
        const caretPos = persistentCaret(editorRef.current);
        const cursor = caretPos === null ? null : caretMarkdownOffset(editorRef.current, caretPos);
        const selection = isOpen ? getSelectionMarkdown() : null;
        return {
            content,
            selection: selection !== null && selection.length <= CANVAS_CONTENT_LIMIT_CHARS ? selection : null,
            cursor: cursor !== null && cursor <= CANVAS_CONTENT_LIMIT_CHARS ? cursor : null
        };
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
            // The agent replaced the document; a stale caret/selection there would be misleading.
            current.view.dispatch(current.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
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
