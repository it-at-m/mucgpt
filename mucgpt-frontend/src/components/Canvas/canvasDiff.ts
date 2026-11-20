import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Diff between two canvas documents for the accept/reject review.
 *
 * Replacements of plain-text blocks are split into *hunks*: a maximal run of
 * consecutive changed words forms one change (one green/red pair), so several
 * edits inside the same paragraph can be accepted or rejected independently.
 * Lists are diffed per bullet: each list item of a matched list pair is its own
 * unit, so editing one bullet does not mark the whole list.
 * Structural changes (tables, code, type changes, merge/split runs, items with
 * nested lists) and pure insertions/deletions stay block-level.
 *
 * Positions are positions in the target document. Pure deletions have an empty
 * range (the anchor where the old content was removed).
 */
export interface CanvasDiffSegment {
    kind: "equal" | "insert" | "delete";
    text: string;
}

export interface CanvasChange {
    id: string;
    /** inline = phrase hunk inside a text block; block = whole block/list item(s). */
    level: "inline" | "block";
    kind: "insert" | "delete" | "replace";
    /** Target document range; empty for pure deletions (insertion anchor). */
    from: number;
    to: number;
    /** Baseline content restored on reject; null for pure insertions. */
    oldSliceJson: unknown;
    /** Removed content shown as red strikethrough. */
    oldText: string;
    /** Added content shown in green; empty for pure deletions. */
    newText: string;
    /** List marker for static preview fallback lines ("• " / "3. "); inline changes only. */
    previewPrefix?: string;
    /** Baseline content as PM node JSON array, rendered formatted in diff views. */
    oldFragmentJson?: unknown;
    /** List wrapper for the old fragment when it consists of list items. */
    oldFragmentTag?: "ul" | "ol";
    /** Target content as PM node JSON array, rendered formatted in diff views. */
    newFragmentJson?: unknown;
    /** List wrapper for the new fragment when it consists of list items. */
    newFragmentTag?: "ul" | "ol";
}

/**
 * Static preview item for a stored revision versus the current text. Produced by
 * the same walk as the review changes, so both surfaces cannot drift apart.
 */
export interface CanvasDiffPreviewItem {
    kind: "equal" | "insert" | "delete" | "replace";
    oldLines: string[];
    newLines: string[];
    oldFragmentJson?: unknown;
    oldFragmentTag?: "ul" | "ol";
    newFragmentJson?: unknown;
    newFragmentTag?: "ul" | "ol";
}

export interface CanvasTextHunk {
    /** Offsets into the old/new plain text of the block. */
    oldStart: number;
    oldEnd: number;
    newStart: number;
    newEnd: number;
    oldText: string;
    newText: string;
}

type DiffOp = { type: "equal"; a: number; b: number } | { type: "insert"; b: number } | { type: "delete"; a: number };

/** A diffable node with its position and (for list items) its marker prefix. */
interface DiffPiece {
    node: PMNode;
    from: number;
    /** "• " or "3. " for list items; undefined for top-level blocks. */
    prefix?: string;
    /** List wrapper tag for formatted fragment rendering; list items only. */
    listTag?: "ul" | "ol";
}

/** Upper bound for the LCS matrix; larger inputs degrade to a coarse comparison. */
const MAX_MATRIX_CELLS = 250_000;
/** Inline word diffs are skipped beyond this combined text length. */
const MAX_INLINE_TEXT = 60_000;
/**
 * Share of unchanged text below which a rewritten block becomes one decision
 * (whole old sentence versus whole new sentence) instead of word-level hunks.
 * A low value keeps word-level splits for moderately heavy rewrites; only
 * fundamentally rewritten blocks collapse into a single decision.
 */
const SIMILARITY_THRESHOLD = 0.3;
/** Hunks separated by at most this many unchanged words merge into one decision. */
const MAX_MERGE_GAP_WORDS = 2;

const diffSequences = <T>(a: T[], b: T[], equals: (left: T, right: T) => boolean): DiffOp[] | null => {
    const n = a.length;
    const m = b.length;
    if ((n + 1) * (m + 1) > MAX_MATRIX_CELLS) return null;

    const width = m + 1;
    // dp[i][j] = LCS length of a[i:] and b[j:]
    const dp = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i * width + j] = equals(a[i], b[j]) ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
        }
    }

    const ops: DiffOp[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (equals(a[i], b[j])) {
            ops.push({ type: "equal", a: i, b: j });
            i++;
            j++;
        } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
            ops.push({ type: "delete", a: i });
            i++;
        } else {
            ops.push({ type: "insert", b: j });
            j++;
        }
    }
    while (i < n) {
        ops.push({ type: "delete", a: i });
        i++;
    }
    while (j < m) {
        ops.push({ type: "insert", b: j });
        j++;
    }
    return ops;
};

const tokenize = (text: string): string[] => text.match(/\s+|\S+/g) ?? [];

/**
 * Word-level diff for inline highlighting. Returns null when the text is too
 * large to diff safely — the caller then degrades to a block-level change.
 */
export const diffWords = (oldText: string, newText: string): CanvasDiffSegment[] | null => {
    if (oldText.length + newText.length > MAX_INLINE_TEXT) return null;
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    const ops = diffSequences(oldTokens, newTokens, (left, right) => left === right);
    if (!ops) return null;

    const segments: CanvasDiffSegment[] = [];
    for (const op of ops) {
        const text = op.type === "insert" ? newTokens[op.b] : oldTokens[op.a];
        const last = segments[segments.length - 1];
        if (last && last.kind === op.type) last.text += text;
        else segments.push({ kind: op.type, text });
    }
    return segments;
};

/** Number of non-whitespace tokens, used to measure unchanged gaps between hunks. */
const countWords = (text: string): number => tokenize(text).filter(token => /\S/.test(token)).length;

const hunksFromSegments = (oldText: string, newText: string, segments: CanvasDiffSegment[]): CanvasTextHunk[] => {
    const hunks: CanvasTextHunk[] = [];
    let oldOffset = 0;
    let newOffset = 0;
    let current: CanvasTextHunk | null = null;
    for (const segment of segments) {
        if (segment.kind === "equal") {
            if (current) {
                hunks.push(current);
                current = null;
            }
            oldOffset += segment.text.length;
            newOffset += segment.text.length;
            continue;
        }
        current ??= { oldStart: oldOffset, oldEnd: oldOffset, newStart: newOffset, newEnd: newOffset, oldText: "", newText: "" };
        if (segment.kind === "delete") {
            current.oldEnd += segment.text.length;
            current.oldText += segment.text;
            oldOffset += segment.text.length;
        } else {
            current.newEnd += segment.text.length;
            current.newText += segment.text;
            newOffset += segment.text.length;
        }
    }
    if (current) hunks.push(current);

    // Merge hunks separated by a very short unchanged stretch: short connecting
    // words are usually part of the same edit rather than a separate decision.
    const merged: CanvasTextHunk[] = [];
    for (const hunk of hunks) {
        const last = merged[merged.length - 1];
        if (last && countWords(oldText.slice(last.oldEnd, hunk.oldStart)) <= MAX_MERGE_GAP_WORDS) {
            last.oldEnd = hunk.oldEnd;
            last.newEnd = hunk.newEnd;
            last.oldText = oldText.slice(last.oldStart, last.oldEnd);
            last.newText = newText.slice(last.newStart, last.newEnd);
        } else {
            merged.push({ ...hunk });
        }
    }
    // Whitespace-only hunks carry no visible change: auto-accepting them
    // (approval default) avoids floating controls without content.
    return merged.filter(hunk => hunk.oldText.trim().length > 0 || hunk.newText.trim().length > 0);
};

/**
 * Groups the word diff into hunks: a maximal run of changed words separated by
 * unchanged text (merging across gaps of at most two unchanged words). Each
 * hunk is an independent review change.
 */
export const diffHunks = (oldText: string, newText: string): CanvasTextHunk[] | null => {
    const segments = diffWords(oldText, newText);
    return segments ? hunksFromSegments(oldText, newText, segments) : null;
};

/** Share of unchanged characters; heavy rewrites fall below the hunk threshold. */
const unchangedShare = (segments: CanvasDiffSegment[]): number => {
    let equal = 0;
    let oldLength = 0;
    let newLength = 0;
    for (const segment of segments) {
        if (segment.kind === "equal") {
            equal += segment.text.length;
            oldLength += segment.text.length;
            newLength += segment.text.length;
        } else if (segment.kind === "delete") oldLength += segment.text.length;
        else newLength += segment.text.length;
    }
    const longest = Math.max(oldLength, newLength);
    return longest === 0 ? 1 : equal / longest;
};

/** Content as plain lines for the strikethrough/preview text. */
const describeNode = (node: PMNode): string[] => {
    switch (node.type.name) {
        case "table": {
            const rows: string[] = [];
            node.forEach(row => {
                const cells: string[] = [];
                row.forEach(cell => cells.push(cell.textContent.trim()));
                rows.push(cells.join(" | "));
            });
            return rows;
        }
        case "bulletList":
        case "orderedList": {
            const lines: string[] = [];
            const start = typeof node.attrs.start === "number" ? node.attrs.start : 1;
            node.forEach((item, _offset, index) => {
                const prefix = node.type.name === "orderedList" ? `${start + index}. ` : "• ";
                lines.push(`${prefix}${item.textContent.trim()}`);
            });
            return lines;
        }
        case "horizontalRule":
            return ["—"];
        default: {
            const text = node.textContent;
            return text ? text.split("\n") : [""];
        }
    }
};

/** Lines for a diff piece; list items get their marker prefix. */
const describePiece = (piece: DiffPiece): string[] => {
    const lines = describeNode(piece.node);
    return piece.prefix ? lines.map(line => `${piece.prefix}${line}`) : lines;
};

const isPlainTextBlock = (node: PMNode): boolean => {
    if (!node.isTextblock) return false;
    let plain = true;
    node.descendants(child => {
        // Hard breaks and other inline atoms cannot be mapped to a text offset.
        if (!child.isText) plain = false;
        return plain;
    });
    return plain;
};

const simpleTextblock = (node: PMNode): PMNode | null => {
    const simpleType = node.type.name === "paragraph" || node.type.name === "heading";
    return simpleType && isPlainTextBlock(node) ? node : null;
};

/** A list item is inline-diffable when it holds exactly one plain-text paragraph. */
const simpleItemParagraph = (item: PMNode): PMNode | null => {
    if (item.childCount !== 1) return null;
    const paragraph = item.child(0);
    if (paragraph.type.name !== "paragraph" || !isPlainTextBlock(paragraph)) return null;
    return paragraph;
};

const isList = (node: PMNode): boolean => node.type.name === "bulletList" || node.type.name === "orderedList";

const sameListShape = (left: PMNode, right: PMNode): boolean =>
    isList(left) && isList(right) && left.type.name === right.type.name && JSON.stringify(left.attrs) === JSON.stringify(right.attrs);

const topLevelPieces = (doc: PMNode): DiffPiece[] => {
    const pieces: DiffPiece[] = [];
    doc.forEach((node, offset) => pieces.push({ node, from: offset }));
    return pieces;
};

/** List items as diff pieces with their list marker prefix. */
const listItemPieces = (list: PMNode, listPos: number): DiffPiece[] => {
    const start = typeof list.attrs.start === "number" ? list.attrs.start : 1;
    const pieces: DiffPiece[] = [];
    const listTag: "ul" | "ol" = list.type.name === "orderedList" ? "ol" : "ul";
    list.forEach((item, offset, index) => {
        const prefix = list.type.name === "orderedList" ? `${start + index}. ` : "• ";
        pieces.push({ node: item, from: listPos + 1 + offset, prefix, listTag });
    });
    return pieces;
};

/** Truncated plain-text excerpt for review tooltips and accessible labels. */
export const summarize = (text: string): string => {
    const collapsed = text.replace(/\s+/g, " ").trim();
    return collapsed.length > 60 ? `${collapsed.slice(0, 57)}…` : collapsed;
};

/**
 * Text positions: plain-text blocks contain only text nodes and list items hold
 * their single paragraph as first child, so one character is one position
 * (marks do not affect positions).
 */
const blockTextStart = (piece: DiffPiece): number => piece.from + 1;
const itemTextStart = (piece: DiffPiece): number => piece.from + 2;

const inlineChanges = (
    baseline: PMNode,
    target: PMNode,
    oldText: string,
    oldTextStart: number,
    newText: string,
    newTextStart: number,
    nextChangeId: () => string,
    previewPrefix?: string
): CanvasChange[] | null => {
    const segments = diffWords(oldText, newText);
    if (!segments) return null;

    // A fundamental rewrite is one decision between the two complete strings;
    // word-level fragments would just be noise (and can produce insert-only
    // hunks without a counterpart).
    if (unchangedShare(segments) < SIMILARITY_THRESHOLD) {
        // Fragments carry the real node/marks structure so diff views can render
        // the removed and added text properly formatted.
        const oldFragmentJson = oldText ? baseline.slice(oldTextStart, oldTextStart + oldText.length).content.toJSON() : undefined;
        const newFragmentJson = newText ? target.slice(newTextStart, newTextStart + newText.length).content.toJSON() : undefined;
        return [
            {
                id: nextChangeId(),
                level: "inline" as const,
                kind: oldText && newText ? "replace" : newText ? "insert" : "delete",
                from: newTextStart,
                to: newTextStart + newText.length,
                oldSliceJson: oldText ? baseline.slice(oldTextStart, oldTextStart + oldText.length).toJSON() : null,
                oldText,
                newText,
                previewPrefix,
                oldFragmentJson,
                newFragmentJson
            }
        ];
    }

    const hunks = hunksFromSegments(oldText, newText, segments);
    // An empty result means nothing visible is left to review (all hunks were
    // whitespace-only): the caller must emit no change at all, not fall back to
    // a block-level one. Only a failed word diff (`segments === null`) degrades.
    if (hunks.length === 0) return [];

    return hunks.map(hunk => {
        const kind = hunk.oldText && hunk.newText ? "replace" : hunk.newText ? "insert" : "delete";
        return {
            id: nextChangeId(),
            level: "inline" as const,
            kind,
            from: newTextStart + hunk.newStart,
            to: newTextStart + hunk.newEnd,
            oldSliceJson: hunk.oldText ? baseline.slice(oldTextStart + hunk.oldStart, oldTextStart + hunk.oldEnd).toJSON() : null,
            oldText: hunk.oldText,
            newText: hunk.newText,
            previewPrefix,
            oldFragmentJson: hunk.oldText ? baseline.slice(oldTextStart + hunk.oldStart, oldTextStart + hunk.oldEnd).content.toJSON() : undefined,
            newFragmentJson: hunk.newText ? target.slice(newTextStart + hunk.newStart, newTextStart + hunk.newEnd).content.toJSON() : undefined
        };
    });
};

const blockChange = (
    baseline: PMNode,
    removed: DiffPiece[],
    added: DiffPiece[],
    oldStart: number,
    newStart: number,
    nextChangeId: () => string
): CanvasChange => {
    const oldSize = removed.reduce((size, piece) => size + piece.node.nodeSize, 0);
    const newSize = added.reduce((size, piece) => size + piece.node.nodeSize, 0);
    const oldLines = removed.flatMap(describePiece);
    const newLines = added.flatMap(describePiece);
    const kind = removed.length === 0 ? "insert" : added.length === 0 ? "delete" : "replace";
    // Pieces of one run share their container, so one list wrapper fits all.
    const oldFragmentTag = removed.every(piece => piece.listTag) ? removed[0]?.listTag : undefined;
    const newFragmentTag = added.every(piece => piece.listTag) ? added[0]?.listTag : undefined;
    return {
        id: nextChangeId(),
        level: "block",
        kind,
        from: newStart,
        to: newStart + newSize,
        oldSliceJson: removed.length > 0 ? baseline.slice(oldStart, oldStart + oldSize).toJSON() : null,
        oldText: oldLines.join("\n"),
        newText: newLines.join("\n"),
        oldFragmentJson: removed.length > 0 ? removed.map(piece => piece.node.toJSON()) : undefined,
        oldFragmentTag,
        newFragmentJson: added.length > 0 ? added.map(piece => piece.node.toJSON()) : undefined,
        newFragmentTag
    };
};

const previewForChange = (change: CanvasChange): CanvasDiffPreviewItem => {
    const prefix = change.level === "inline" ? change.previewPrefix : undefined;
    const withPrefix = (lines: string[]) => (prefix ? lines.map(line => `${prefix}${line}`) : lines);
    const lines = (text: string): string[] => (change.level === "inline" ? (text ? [text] : []) : text ? text.split("\n") : []);
    return {
        kind: change.kind,
        oldLines: withPrefix(lines(change.oldText)),
        newLines: withPrefix(lines(change.newText)),
        oldFragmentJson: change.oldFragmentJson,
        oldFragmentTag: change.oldFragmentTag,
        newFragmentJson: change.newFragmentJson,
        newFragmentTag: change.newFragmentTag
    };
};

interface DiffSink {
    changes: CanvasChange[];
    preview: CanvasDiffPreviewItem[];
}

const emitChange = (sink: DiffSink, change: CanvasChange) => {
    sink.changes.push(change);
    sink.preview.push(previewForChange(change));
};

const emitEqual = (sink: DiffSink, piece: DiffPiece) => {
    const lines = describePiece(piece);
    // Empty filler blocks (e.g. a trailing paragraph after a list) carry no
    // preview information and would only add blank rows.
    if (lines.every(line => line.trim() === "")) return;
    sink.preview.push({
        kind: "equal",
        oldLines: [],
        newLines: lines,
        newFragmentJson: [piece.node.toJSON()],
        newFragmentTag: piece.listTag
    });
};

const pushPairChange = (
    sink: DiffSink,
    baseline: PMNode,
    removed: DiffPiece[],
    added: DiffPiece[],
    oldStart: number,
    newStart: number,
    nextChangeId: () => string
) => {
    emitChange(sink, blockChange(baseline, removed, added, oldStart, newStart, nextChangeId));
};

/**
 * Diffs the items of a matched list pair. Whole-list changes keep their
 * node-aligned ranges, so reject slices never cross container boundaries.
 */
const diffListPair = (sink: DiffSink, baseline: PMNode, target: PMNode, oldList: DiffPiece, newList: DiffPiece, nextChangeId: () => string) => {
    const oldItems = listItemPieces(oldList.node, oldList.from);
    const newItems = listItemPieces(newList.node, newList.from);
    const ops = diffSequences(oldItems, newItems, (left, right) => left.node.eq(right.node));

    // Too many items to align: review the whole list as one block change.
    if (!ops) {
        pushPairChange(sink, baseline, [oldList], [newList], oldList.from, newList.from, nextChangeId);
        return;
    }

    let opIndex = 0;
    let oldPos = oldList.from + 1;
    let newPos = newList.from + 1;

    while (opIndex < ops.length) {
        const op = ops[opIndex];
        if (op.type === "equal") {
            emitEqual(sink, newItems[op.b]);
            oldPos += oldItems[op.a].node.nodeSize;
            newPos += newItems[op.b].node.nodeSize;
            opIndex++;
            continue;
        }

        const oldRunStart = oldPos;
        const newRunStart = newPos;
        const removed: DiffPiece[] = [];
        const added: DiffPiece[] = [];
        while (opIndex < ops.length && ops[opIndex].type !== "equal") {
            const runOp = ops[opIndex];
            if (runOp.type === "delete") removed.push(oldItems[runOp.a]);
            else if (runOp.type === "insert") added.push(newItems[runOp.b]);
            opIndex++;
        }
        for (const piece of removed) oldPos += piece.node.nodeSize;
        for (const piece of added) newPos += piece.node.nodeSize;

        if (removed.length === 0 || added.length === 0 || removed.length !== added.length) {
            pushPairChange(sink, baseline, removed, added, oldRunStart, newRunStart, nextChangeId);
            continue;
        }

        removed.forEach((oldItem, index) => {
            const newItem = added[index];
            const oldParagraph = simpleItemParagraph(oldItem.node);
            const newParagraph = simpleItemParagraph(newItem.node);
            const inline =
                oldParagraph && newParagraph
                    ? inlineChanges(
                          baseline,
                          target,
                          oldParagraph.textContent,
                          itemTextStart(oldItem),
                          newParagraph.textContent,
                          itemTextStart(newItem),
                          nextChangeId,
                          newItem.prefix
                      )
                    : null;
            if (inline) inline.forEach(change => emitChange(sink, change));
            else pushPairChange(sink, baseline, [oldItem], [newItem], oldItem.from, newItem.from, nextChangeId);
        });
    }
};

/**
 * One walk over the block diff producing both consumers: the interactive review
 * changes (positions in the target document) and the ordered static preview
 * (equal blocks interleaved with changes) used by the versions drawer.
 */
export function diffCanvas(baseline: PMNode, target: PMNode): { changes: CanvasChange[]; preview: CanvasDiffPreviewItem[] } {
    const oldPieces = topLevelPieces(baseline);
    const newPieces = topLevelPieces(target);
    const ops = diffSequences(oldPieces, newPieces, (left, right) => left.node.eq(right.node));
    let changeCounter = 1;
    const nextChangeId = () => `change-${changeCounter++}`;
    const sink: DiffSink = { changes: [], preview: [] };

    // Too many blocks to align: expose the whole rewrite as one reviewable change.
    if (!ops) {
        if (!baseline.eq(target)) emitChange(sink, blockChange(baseline, oldPieces, newPieces, 0, 0, nextChangeId));
        return sink;
    }

    let opIndex = 0;
    // Positions are tracked incrementally: baseline and target block sizes only.
    let oldPos = 0;
    let newPos = 0;

    while (opIndex < ops.length) {
        const op = ops[opIndex];
        if (op.type === "equal") {
            emitEqual(sink, newPieces[op.b]);
            oldPos += oldPieces[op.a].node.nodeSize;
            newPos += newPieces[op.b].node.nodeSize;
            opIndex++;
            continue;
        }

        const oldStart = oldPos;
        const newStart = newPos;
        const removed: DiffPiece[] = [];
        const added: DiffPiece[] = [];
        while (opIndex < ops.length && ops[opIndex].type !== "equal") {
            const runOp = ops[opIndex];
            if (runOp.type === "delete") removed.push(oldPieces[runOp.a]);
            else if (runOp.type === "insert") added.push(newPieces[runOp.b]);
            opIndex++;
        }
        for (const piece of removed) oldPos += piece.node.nodeSize;
        for (const piece of added) newPos += piece.node.nodeSize;

        if (removed.length === 0 || added.length === 0 || removed.length !== added.length) {
            // Pure insertion/deletion runs and merge/split runs stay one block change.
            pushPairChange(sink, baseline, removed, added, oldStart, newStart, nextChangeId);
            continue;
        }

        // Equal counts: pair the blocks so each rewritten block is reviewed on its
        // own (and inline-diffable pairs are split into independent phrase hunks).
        removed.forEach((oldPiece, index) => {
            const newPiece = added[index];
            if (sameListShape(oldPiece.node, newPiece.node)) {
                diffListPair(sink, baseline, target, oldPiece, newPiece, nextChangeId);
                return;
            }
            const oldTextblock = simpleTextblock(oldPiece.node);
            const newTextblock = simpleTextblock(newPiece.node);
            const inline =
                oldTextblock &&
                newTextblock &&
                oldTextblock.type.name === newTextblock.type.name &&
                JSON.stringify(oldTextblock.attrs) === JSON.stringify(newTextblock.attrs)
                    ? inlineChanges(
                          baseline,
                          target,
                          oldTextblock.textContent,
                          blockTextStart(oldPiece),
                          newTextblock.textContent,
                          blockTextStart(newPiece),
                          nextChangeId
                      )
                    : null;
            if (inline) inline.forEach(change => emitChange(sink, change));
            else pushPairChange(sink, baseline, [oldPiece], [newPiece], oldPiece.from, newPiece.from, nextChangeId);
        });
    }

    return sink;
}

export const computeCanvasChanges = (baseline: PMNode, target: PMNode): CanvasChange[] => diffCanvas(baseline, target).changes;

/** Ordered static preview (versions drawer); identical grouping to the review. */
export const describeCanvasDiff = (baseline: PMNode, target: PMNode): CanvasDiffPreviewItem[] => diffCanvas(baseline, target).preview;
