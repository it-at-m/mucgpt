import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content, Editor } from "@tiptap/core";
import { useEditor } from "@tiptap/react";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";

import type { CanvasState } from "../api/models";
import { useConfigContext } from "../context/ConfigContext";
import { useCanvasLimits } from "../components/Canvas/canvasLimits";
import { loadCanvasRevisions, loadCanvasState, parseCanvasRevisions, type CanvasRevision, type CanvasRevisions } from "../service/canvasStorage";
import type { CanvasStreamEvent } from "../utils/canvasStream";
import { CANVAS_PERSISTENCE_RESET, persistentCaret, persistentSelection } from "../components/Canvas/canvasSelectionPersistence";
import { canvasExtensions } from "../components/Canvas/canvasExtensions";
import { flattenPastedLinks, withoutLinkMarks } from "../components/Canvas/canvasLinkNeutralization";
import { effectiveAllowedTags, sanitizeCanvasMarkdown } from "../components/Canvas/canvasHtmlWhitelist";
import { markdownLinksToPlainText } from "../components/MarkdownRenderer/markdownLinkPolicy";

/**
 * Interface between the canvas UI and the chat page.
 * Consumed by the chat page wiring.
 */
export interface CanvasController {
    isOpen: boolean;
    setIsOpen(open: boolean): void;
    /** Sets an open request that survives a pending fresh-chat reset. */
    requestOpen(): void;
    /** True while the agent is writing */
    isLocked: boolean;
    unlock(): void;
    getMarkdown(): string;
    getSelectionMarkdown(): string | null;
    /** Full replace; clears selection */
    setMarkdown(md: string): void;
    /** Null only when no canvas content exists; sent open or closed */
    toCanvasState(): CanvasState | null;
    /** APPEND → live insert; UPDATE → replace doc */
    applyStreamEvent(ev: CanvasStreamEvent): void;
    /** At RUN_STARTED: resets the stream revision guard and locks the editor.
     * Must run for every run — even with the canvas closed, its content is sent
     * with the request and the agent may write (the first canvas event
     * auto-opens the view). */
    beginRun(): void;
    /** Debounced; used for autosave */
    subscribe(cb: (markdown: string) => void): () => void;
    /** PM-JSON snapshot into the revision rings */
    snapshot(source: CanvasRevision["source"]): void;
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

/**
 * Pushing a pre-clear rollback checkpoint into a full auto ring evicts the
 * oldest autosave entry first, so frequent clear/save cycles cannot push out
 * agent versions; plain FIFO applies only when no backups exist.
 */
const pushAutoCapped = (ring: CanvasRevision[], revision: CanvasRevision, cap: number): CanvasRevision[] => {
    if (ring.length < cap) return [...ring, revision];
    if (revision.source === "autosave") {
        const oldestBackup = ring.findIndex(entry => entry.source === "autosave");
        if (oldestBackup !== -1) {
            const next = [...ring];
            next.splice(oldestBackup, 1);
            return [...next, revision];
        }
    }
    return [...ring.slice(1), revision];
};

const emptyRevisions = (): CanvasRevisions => ({ auto: [], manual: [] });

/**
 * Selection starting inside a table: the cut document's first row is a partial
 * body row, which the GFM serializer rejects (it would collapse to "[table]"),
 * so quote coordinates plus the verbatim cell text instead; the backend can
 * still locate the passage via the "referenced text". The annotation is not a
 * document substring.
 * Row 1 is the header row; the canvas schema allows no colspans, so the cell
 * index is the column index. The highlighted text may be a partial cell, hence
 * "referenced text" rather than "cell content".
 */
export const tableSelectionMarkdownAt = (doc: PMNode, from: number, to: number): string | null => {
    const $from = doc.resolve(from);
    const $to = doc.resolve(to);
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

    const text = doc.textBetween(from, to, " ", " ");
    return `[table, ${range("row", startRow, endRow)}, ${endCol > startCol ? range("col", startCol, endCol) : col}, referenced text: "${text}"]`;
};

/**
 * Invisible separator chars that pin ProseMirror positions: one inserted at
 * a position into a throwaway doc copy yields the exact markdown offset via
 * indexOf in the serialization. Rare in user content; checked before use.
 */
const OFFSET_SENTINELS = ["\u2063", "\u2062", "\u2064"] as const;

type OffsetBoundary = { pos: number; sentinel: string; marks: readonly Mark[] };

/**
 * Marks continuing across the boundary at `pos` (intersection of both sides).
 * A sentinel carries them, so it lands inside covered mark runs and skips
 * operators opening/closing at the boundary. Block prefixes are handled by the
 * line-start slide in selectionMarkdownOffsets.
 */
const continuationMarks = (doc: PMNode, pos: number): readonly Mark[] => {
    const $pos = doc.resolve(pos);
    const parent = $pos.parent;
    if (!parent.type.isTextblock || !parent.type.inlineContent) return [];
    const offset = $pos.parentOffset;
    const before = offset > 0 ? $pos.nodeBefore : null;
    const after = offset < parent.content.size ? $pos.nodeAfter : null;
    const marksBefore = before?.isInline ? before.marks : [];
    const marksAfter = after?.isInline ? after.marks : [];
    return marksBefore.filter(mark => marksAfter.some(other => other.eq(mark)));
};

/**
 * Serializes `doc` with one sentinel per boundary (larger position first, so
 * earlier insertions never shift later ones).
 */
const serializeWithSentinels = (editor: Editor, boundaries: OffsetBoundary[]): string | null => {
    const storage = markdownStorage(editor);
    if (!storage) return null;
    const doc = editor.state.doc;
    for (const { pos } of boundaries) {
        try {
            const $pos = doc.resolve(pos);
            if (!$pos.parent.type.isTextblock || $pos.parentOffset > $pos.parent.content.size) return null;
        } catch {
            return null;
        }
    }
    const state = EditorState.create({ doc, schema: editor.state.schema });
    const tr = state.tr;
    for (const { pos, sentinel, marks } of [...boundaries].sort((left, right) => right.pos - left.pos)) {
        tr.insert(pos, editor.state.schema.text(sentinel, [...marks]));
    }
    return storage.serializer.serialize(state.apply(tr).doc);
};

/**
 * Markdown offset of the character at a ProseMirror position (sentinel
 * method, with a serialized-prefix fallback when the throwaway serialization
 * diverges). Null when the serializer is unavailable.
 */
const markdownOffsetAt = (editor: Editor, pos: number): number | null => {
    const full = markdownStorage(editor)?.serializer.serialize(editor.state.doc);
    if (full === undefined) return null;
    const sentinel = OFFSET_SENTINELS.find(candidate => !full.includes(candidate));
    if (sentinel === undefined) return null;
    const marked = serializeWithSentinels(editor, [{ pos, sentinel, marks: continuationMarks(editor.state.doc, pos) }]);
    if (marked === null) {
        // Boundaries outside a textblock: fall back to the serialized prefix.
        const { doc } = editor.state;
        const prefix = markdownStorage(editor)?.serializer.serialize(doc.cut(0, pos));
        return prefix === undefined ? null : prefix.replace(/\n$/, "").length;
    }
    if (marked.replace(sentinel, "") !== full) {
        // The serializer rendered the sentinel doc differently (e.g. it lost
        // a line-start escape): its indices cannot slice `full`.
        return null;
    }
    const index = marked.indexOf(sentinel);
    return index < 0 ? null : index;
};

/**
 * Markdown offset of a ProseMirror position. Callers align selection-anchored
 * offsets with the selection slice via selectionStartOffset.
 */
export const caretMarkdownOffset = (editor: Editor | null, pos: number): number | null => {
    if (!editor) return null;
    const { doc } = editor.state;
    if (pos >= doc.content.size) {
        return markdownStorage(editor)?.serializer.serialize(doc).length ?? null;
    }
    return markdownOffsetAt(editor, pos);
};

/**
 * Markdown offsets of a non-empty selection: markdown.slice(startOffset,
 * endOffset) is the exact covered substring. Operators ("- ", "# ", "**")
 * belong to it only when the selection covers their boundary side; the line
 * start slide for block starts is the caller's job.
 */
const selectionMarkdownOffsets = (editor: Editor, from: number, to: number, full: string): { startOffset: number; endOffset: number } | null => {
    const usable = OFFSET_SENTINELS.filter(candidate => !full.includes(candidate));
    if (usable.length < 2) return null;
    const doc = editor.state.doc;
    const serialized = serializeWithSentinels(editor, [
        { pos: from, sentinel: usable[0], marks: continuationMarks(doc, from) },
        { pos: to, sentinel: usable[1], marks: continuationMarks(doc, to) }
    ]);
    if (serialized === null) return null;
    const fromIndex = serialized.indexOf(usable[0]);
    // The to-sentinel sits one char past its offset: the from-sentinel lands first.
    const toIndex = serialized.indexOf(usable[1]) - 1;
    if (fromIndex < 0 || toIndex < 0 || fromIndex > toIndex) return null;
    if (serialized.replace(usable[0], "").replace(usable[1], "") !== full) {
        // The serializer rendered the sentinel doc differently (e.g. it lost
        // a line-start escape): its indices cannot slice `full`.
        return null;
    }
    return { startOffset: fromIndex, endOffset: toIndex };
};

/** Markdown index of the line start containing `offset` (0-safe for offset 0). */
const lineStart = (markdown: string, offset: number): number => markdown.lastIndexOf("\n", Math.max(offset - 1, 0)) + 1;

/**
 * Markdown offset aligned with the selection slice: a block content start
 * slides to the line start (the slice includes the block prefix there). Used
 * by both the selection serializer and the cursor so they cannot drift apart.
 */
const selectionStartOffset = (markdown: string, editor: Editor, anchor: number, offset: number): number =>
    editor.state.doc.resolve(anchor).parentOffset === 0 ? lineStart(markdown, offset) : offset;

/**
 * UTF-16 string index converted to a code-point offset: the backend indexes
 * the JSON-decoded markdown by code points (Python strings), while every
 * frontend offset here is a UTF-16 unit. Astral characters (emoji) shift the
 * two by one per occurrence before the position.
 */
const codePointOffset = (markdown: string, utf16Offset: number): number => [...markdown.slice(0, utf16Offset)].length;

export function useCanvasController(conversationId: string | undefined, serverConversationId?: string): CanvasControllerInstance {
    // Assistant chats keep a prefixed local id for their chat history but talk
    // to the canvas endpoints with the plain backend conversation id.
    const serverId = serverConversationId ?? conversationId;
    const limits = useCanvasLimits();
    const { canvas_allowed_html_tags: allowedHtmlTags } = useConfigContext();
    // Pre-parse transformation of every markdown entering the editor: links and
    // images become plain "description (url)" text (issue #228) and tags outside
    // the deployment allowlist become literal text (config may only restrict;
    // tags unknown to this release are ignored).
    const allowedTags = effectiveAllowedTags(allowedHtmlTags);
    // Stable identity on purpose: the conversation-switch effect and the stream
    // callbacks must not be torn down/re-run when the config loads.
    const allowedTagsRef = useRef(allowedTags);
    allowedTagsRef.current = allowedTags;
    const sanitize = useCallback((md: string): string => sanitizeCanvasMarkdown(markdownLinksToPlainText(md), allowedTagsRef.current), []);
    const editor = useEditor(
        {
            extensions: canvasExtensions({ exportLimitChars: limits.editorLimitChars, warnChars: limits.warnChars }),
            content: "",
            editorProps: {
                transformPastedHTML: flattenPastedLinks
            }
        },
        // Recreate when the backend limits arrive so the plugin uses the
        // configured values instead of the fallback defaults.
        [limits.editorLimitChars, limits.warnChars]
    );
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
    // Markdown captured when the debounced notification was scheduled; typical
    // cleanups (unmount) can run after the editor was destroyed, so the flush
    // must not rely on reading the editor again.
    const pendingNotifyRef = useRef<string | null>(null);
    // Last nonempty document, captured with each editor update; feeds the
    // pre-clear rollback checkpoints (snapshot("autosave")).
    const lastNonEmptyDocRef = useRef<Record<string, unknown> | null>(null);
    // Latest editor document including empty content; the editor recreation
    // restore must respect an intentional clear and reapply emptiness, so it
    // cannot reuse the nonempty checkpoint.
    const lastCurrentDocRef = useRef<Record<string, unknown> | null>(null);
    const revisionsRef = useRef(revisions);
    revisionsRef.current = revisions;

    const getMarkdown = useCallback((): string => {
        const current = editorRef.current;
        if (!current) return "";
        // The editor can be mid-recreation (limits load, conversation switch) and
        // temporarily lack its markdown storage — degrade to empty instead of
        // crashing the chat page render.
        return markdownStorage(current)?.serializer.serialize(current.state.doc) ?? "";
    }, []);

    const hasCanvasContent = useCallback(() => {
        const current = editorRef.current;
        // Tiptap can expose a destroyed editor briefly while recreating it.
        // destroy() clears the schema, so treat that lifecycle state as empty.
        if (!current || current.isDestroyed || !current.schema) return false;
        // The empty-document comparison also sees textless nodes (horizontal rule,
        // empty code block, table with only empty cells) that textContent misses,
        // without touching the Markdown serializer (not available on every
        // editor instance — see the conversation-switch callers below).
        return !current.state.doc.eq(current.schema.topNodeType.createAndFill()!);
    }, []);

    const notifySubscribers = useCallback(() => {
        if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
        pendingNotifyRef.current = getMarkdown();
        // Captures at edit time: a clear arriving before the debounced
        // delivery would otherwise replace the nonempty backup capture with
        // the delivered "" — and snapshots do not read the editor at all, so
        // the captures must be maintained here.
        const current = editorRef.current;
        if (current && !current.isDestroyed) {
            lastCurrentDocRef.current = current.getJSON();
            if (pendingNotifyRef.current.trim()) lastNonEmptyDocRef.current = lastCurrentDocRef.current;
        }
        notifyTimerRef.current = setTimeout(() => {
            notifyTimerRef.current = null;
            const markdown = pendingNotifyRef.current;
            pendingNotifyRef.current = null;
            if (markdown !== null) subscribersRef.current.forEach(cb => cb(markdown));
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [getMarkdown]);

    // Delivers the captured markdown of a pending debounced notification
    // synchronously; a no-op when nothing is pending.
    const flushPendingNotify = useCallback(() => {
        if (notifyTimerRef.current === null) return;
        clearTimeout(notifyTimerRef.current);
        notifyTimerRef.current = null;
        const markdown = pendingNotifyRef.current;
        pendingNotifyRef.current = null;
        if (markdown !== null) subscribersRef.current.forEach(cb => cb(markdown));
    }, []);

    // Drops a pending debounced notification without delivering it. Used for
    // the conversation switch's editor clear: that "" is not a user edit and
    // must not be captured as one.
    const clearPendingNotify = useCallback(() => {
        if (notifyTimerRef.current !== null) {
            clearTimeout(notifyTimerRef.current);
            notifyTimerRef.current = null;
        }
        pendingNotifyRef.current = null;
    }, []);

    useEffect(() => {
        if (!editor) return;
        editor.on("update", notifySubscribers);
        return () => {
            editor.off("update", notifySubscribers);
        };
    }, [editor, notifySubscribers]);

    // Editor recreation (e.g. the limits config arriving) starts empty and the
    // conversation-switch effect does not re-run for it. Reapply the latest
    // document — including an intentional clear — so a recreated empty editor
    // cannot be mistaken for a user clear (which would wipe the stored copy)
    // and cannot resurrect cleared content.
    useEffect(() => {
        if (!editor || editor.isDestroyed || hasCanvasContent()) return;
        const docJson = lastCurrentDocRef.current;
        if (docJson === null) return;
        editor.commands.setContent(docJson as Content);
        editor.view.dispatch(editor.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
    }, [editor, hasCanvasContent]);

    // Conversation switch: reset run-scoped state, clear the editor and reopen only
    // when the conversation's stored canvas has content — the open state is derived
    // from content, so new (empty) chats always start closed.
    useEffect(() => {
        const previous = prevConversationIdRef.current;
        prevConversationIdRef.current = conversationId;
        // An open request made before a fresh-chat reset stays pending while the
        // switch runs; it is consumed as soon as the new chat has an id.
        const pendingOpen = pendingOpenRef.current;
        if (conversationId) pendingOpenRef.current = false;
        // The undefined→id transition is ambiguous: either the first prompt of this
        // new chat just got its id (same logical conversation — the canvas is open
        // and/or holds content: keep everything) or a page reload is restoring an
        // existing conversation (fresh controller, canvas closed and empty: run the
        // load path below to restore the stored canvas before an empty canvas state
        // is sent and overwrites it server-side).
        if (previous === undefined && conversationId !== undefined && (isOpenRef.current || hasCanvasContent())) return;

        lastStreamRevisionRef.current = -1;
        nextRevisionRef.current = 1;
        setIsLocked(false);
        setIsOpen(false);
        setRevisions(emptyRevisions());
        lastNonEmptyDocRef.current = null;
        lastCurrentDocRef.current = null;
        // Deliver the outgoing conversation's pending edit before the editor is
        // cleared; clearPendingNotify would otherwise capture "" and the
        // notification would carry empty content (or drop the edit, depending
        // on cleanup ordering).
        flushPendingNotify();
        const current = editorRef.current;
        if (current && hasCanvasContent()) {
            current.commands.setContent("");
            // A stale caret/selection must not leak into another conversation's document.
            current.view.dispatch(current.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
        }
        // The setContent above triggered an editor update whose "" capture is
        // the switch's doing, not a user edit.
        clearPendingNotify();
        let cancelled = false;
        if (conversationId) {
            const loadedServerId = serverConversationId ?? conversationId;
            void (async () => {
                try {
                    const storedRings = await loadCanvasRevisions(loadedServerId);
                    if (cancelled) return;
                    let rings = emptyRevisions();
                    if (storedRings !== null) {
                        rings = parseCanvasRevisions(storedRings);
                        // Keep the monotonic revision counter ahead of the loaded rings so
                        // new snapshots never collide with stored revision numbers.
                        const maxRevision = Math.max(0, ...rings.auto.map(entry => entry.revision), ...rings.manual.map(entry => entry.revision));
                        nextRevisionRef.current = maxRevision + 1;
                        setRevisions(rings);
                    }
                    const stored = await loadCanvasState(loadedServerId);
                    const editor = editorRef.current;
                    if (cancelled || !editor || stored === null) {
                        if (pendingOpen && !cancelled) setIsOpen(true);
                        return;
                    }
                    if (!stored.trim()) {
                        const latestRevision = [...rings.auto, ...rings.manual].sort((left, right) => right.revision - left.revision)[0];
                        if (latestRevision) {
                            editor.commands.setContent(withoutLinkMarks(latestRevision.doc_json) as Content);
                            editor.view.dispatch(editor.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
                            setIsOpen(true);
                            return;
                        }
                        // An open request of a fresh chat reopens the canvas even
                        // when there is nothing to restore yet.
                        if (pendingOpen && !cancelled) setIsOpen(true);
                        return;
                    }
                    editor.commands.setContent(sanitize(stored));
                    editor.view.dispatch(editor.state.tr.setMeta(CANVAS_PERSISTENCE_RESET, true));
                    setIsOpen(true);
                } catch (error) {
                    console.error("Loading canvas failed:", error);
                }
            })();
        }
        return () => {
            cancelled = true;
        };
    }, [conversationId, hasCanvasContent, serverId, flushPendingNotify, clearPendingNotify]);

    const setIsOpen = useCallback((open: boolean) => {
        isOpenRef.current = open;
        setIsOpenState(open);
    }, []);

    // Partnership between the page and the switch effect: a canvas-open request
    // must survive a pending fresh-chat reset (the switch effect clears the
    // editor and closes the canvas), then reopen the canvas for the new chat.
    const pendingOpenRef = useRef(false);
    const requestOpen = useCallback(() => {
        pendingOpenRef.current = true;
        setIsOpen(true);
    }, []);

    // Called on RUN_STARTED: the server numbers canvas_revision per run,
    // so the monotonicity guard must reset per run, not per conversation.
    // Locking is unconditional: even a closed canvas is sent with the request
    // (its content rides along), and the first canvas event auto-opens the
    // view — which must then already be protected from user edits.
    const beginRun = useCallback(() => {
        lastStreamRevisionRef.current = -1;
        setIsLocked(true);
    }, []);
    const unlock = useCallback(() => setIsLocked(false), []);

    const getSelectionMarkdown = useCallback((): string | null => {
        const current = editorRef.current;
        if (!current) return null;
        // Read the visualized selection (persistence plugin), not the live
        // state: what the agent receives is by construction what the user
        // sees highlighted.
        const range = persistentSelection(current);
        if (!range) return null;
        const { from, to } = range;
        // Table selections keep the coordinate annotation: the serializer
        // rejects a partial table cut and the annotation carries row/column context.
        const table = tableSelectionMarkdownAt(current.state.doc, from, to);
        if (table) return table;
        const markdown = getMarkdown();
        if (!markdown) return null;
        const offsets = selectionMarkdownOffsets(current, from, to, markdown);
        if (!offsets) {
            // A selection the sentinel path cannot serve. Where a boundary is
            // the document start or end, clamp it and slice the full markdown
            // (serializing a cut would fabricate mark delimiters at the cut);
            // where the throwaway serialization diverged from the document
            // (e.g. a lost line-start escape), the cut stays the exact fallback.
            const doc = current.state.doc;
            const outsideTextblock = (pos: number) => {
                try {
                    return !doc.resolve(pos).parent.type.isTextblock;
                } catch {
                    return true;
                }
            };
            if (outsideTextblock(from) || outsideTextblock(to)) {
                const rawFrom = from === 0 ? 0 : markdownOffsetAt(current, from);
                // A block content start slides to the line start, like the
                // normal path, so the slice includes the block prefix there.
                const fromOffset = rawFrom === null ? null : selectionStartOffset(markdown, current, from, rawFrom);
                const toOffset = to >= doc.content.size ? markdown.length : markdownOffsetAt(current, to);
                const sliceable = fromOffset !== null && toOffset !== null && fromOffset <= toOffset;
                return sliceable ? markdown.slice(fromOffset, toOffset) : null;
            }
            return markdownStorage(current)?.serializer.serialize(doc.cut(from, to)) ?? null;
        }
        // A selection starting at a block's content start covers the block prefix;
        // slide to the line start. Mid-block: keep the exact covered characters.
        const start = selectionStartOffset(markdown, current, from, offsets.startOffset);
        return start <= offsets.endOffset ? markdown.slice(start, offsets.endOffset) : null;
    }, [getMarkdown]);

    const setMarkdown = useCallback(
        (md: string) => {
            editorRef.current?.commands.setContent(sanitize(md));
        },
        [sanitize]
    );

    const toCanvasState = useCallback((): CanvasState | null => {
        // The canvas is always editable: whenever the document has content it is
        // sent with the request — panel open or closed — so the agent works on
        // the document the user last saw and the server copy stays in sync. An
        // open empty document still counts as an active canvas the agent may
        // write into.
        //
        // Beyond the content limit the document exceeds what the backend can
        // persist, so the request carries the truncated beginning plus the
        // `truncated` flag: the backend then skips persistence (the stored
        // copy is never clobbered) and the canvas tools refuse the partial
        // document with guidance instead of destroying the tail. The document
        // itself stays readable and exportable in the editor up to the editor
        // limit.
        const markdown = getMarkdown();
        if (!isOpen && !markdown?.trim()) return null;
        const truncated = markdown.length > limits.contentLimitChars;
        const content = truncated ? markdown.slice(0, limits.contentLimitChars) : markdown;
        // Both anchors come from the persistence plugin — the visualized
        // selection and caret — so the agent always receives exactly the
        // focus the user sees. The caret takes precedence (a collapsed
        // selection); otherwise the selection start anchors the cursor.
        const current = editorRef.current;
        const selectionRange = persistentSelection(current);
        const caretPos = persistentCaret(current);
        const anchor = caretPos ?? selectionRange?.from ?? null;
        let cursor: number | null = null;
        if (anchor !== null && current) {
            const cursorOffset = caretMarkdownOffset(current, anchor);
            if (cursorOffset !== null) {
                // Selection-anchored cursors align with the selection slice
                // (line start at a block content start).
                const aligned = caretPos === null ? selectionStartOffset(markdown, current, anchor, cursorOffset) : cursorOffset;
                cursor = codePointOffset(markdown, aligned);
            }
        }
        const selection = isOpen ? getSelectionMarkdown() : null;
        return {
            content,
            selection: selection !== null && selection.length <= limits.contentLimitChars ? selection : null,
            cursor: cursor !== null && cursor <= limits.contentLimitChars ? cursor : null,
            truncated: truncated || undefined
        };
    }, [isOpen, getMarkdown, getSelectionMarkdown, limits]);

    const applyStreamEvent = useCallback(
        (ev: CanvasStreamEvent) => {
            const current = editorRef.current;
            if (!current) return;
            if (ev.state === "UPDATE") {
                const revision = ev.metadata?.canvas_revision;
                if (typeof revision === "number") {
                    if (revision <= lastStreamRevisionRef.current) return;
                    lastStreamRevisionRef.current = revision;
                }
                current.commands.setContent(sanitize(ev.content));
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
                    .insertContentAt(insertPos, sanitize(ev.content))
                    .run();
            }
        },
        [sanitize]
    );

    const subscribe = useCallback(
        (cb: (markdown: string) => void) => {
            subscribersRef.current.add(cb);
            return () => {
                // Final synchronous flush so edits inside the debounce window are not
                // lost when the panel unsubscribes (canvas close / unmount).
                flushPendingNotify();
                subscribersRef.current.delete(cb);
            };
        },
        [flushPendingNotify]
    );

    useEffect(() => {
        // On unmount the cleanups of the owning component run before this hook's
        // subscribers unsubscribed — a plain timer clear would silently drop the
        // pending markdown. Flush the captured content instead.
        return flushPendingNotify;
    }, [flushPendingNotify]);

    const snapshot = useCallback((source: CanvasRevision["source"]) => {
        // Pre-clear rollback checkpoint: stores the last captured nonempty
        // document (the editor is already empty at clear time). A backup-aware
        // eviction protects agent versions in the shared auto ring.
        if (source === "autosave") {
            const docJson = lastNonEmptyDocRef.current;
            if (docJson === null) return;
            const revision: CanvasRevision = {
                revision: nextRevisionRef.current++,
                doc_json: docJson,
                timestamp: Date.now(),
                source
            };
            setRevisions(prev => ({ ...prev, auto: pushAutoCapped(prev.auto, revision, AUTO_RING_CAP) }));
            return;
        }
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
            // Stored doc_json is untrusted (foreign rings, older schema): tiptap's
            // setContent silently replaces the document with an empty one on
            // invalid content, which would destroy the live canvas.
            const docJson = withoutLinkMarks(found.doc_json);
            try {
                current.schema.nodeFromJSON(docJson).check();
            } catch (error) {
                console.error("Canvas revision is not a valid document:", error);
                return;
            }
            current.commands.setContent(docJson as Content);
            snapshot("restore");
        },
        [snapshot]
    );

    return useMemo(
        () => ({
            isOpen,
            setIsOpen,
            requestOpen,
            isLocked,
            beginRun,
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
            requestOpen,
            isLocked,
            beginRun,
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
