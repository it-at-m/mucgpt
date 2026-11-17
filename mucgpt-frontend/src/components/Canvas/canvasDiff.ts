import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Diff between two canvas documents for the accept/reject review.
 *
 * Replacements of plain-text blocks are split into *hunks*: a maximal run of
 * consecutive changed words forms one change (one green/red pair), so several
 * edits inside the same paragraph can be accepted or rejected independently.
 * Structural changes (tables, code, lists, type changes, merge/split runs) and
 * pure block insertions/deletions stay block-level and form one change per
 * contiguous run (or pair).
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
    /** inline = phrase hunk inside a text block; block = whole block(s). */
    level: "inline" | "block";
    kind: "insert" | "delete" | "replace";
    /** Target document range; empty for pure deletions (insertion anchor). */
    from: number;
    to: number;
    /** Baseline content restored on reject; null for pure insertions. */
    oldSliceJson: unknown | null;
    /** Removed content shown as red strikethrough. */
    oldText: string;
    /** Short plain-text excerpt of the change for accessible control labels. */
    summary: string;
}

/** Ordered block-level preview item for a stored revision versus the current text. */
export interface CanvasRevisionDiffItem {
    kind: "equal" | "insert" | "delete";
    lines: string[];
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

/** Upper bound for the LCS matrix; larger inputs degrade to a coarse comparison. */
const MAX_MATRIX_CELLS = 250_000;
/** Inline word diffs are skipped beyond this combined text length. */
const MAX_INLINE_TEXT = 60_000;
/**
 * Share of unchanged text below which a rewritten block becomes one decision
 * (whole old sentence versus whole new sentence) instead of word-level hunks.
 */
const SIMILARITY_THRESHOLD = 0.7;
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
    return merged.filter(hunk => hunk.oldText.length > 0 || hunk.newText.length > 0);
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

/** Old block content as plain lines for the strikethrough preview. */
const describeBlock = (node: PMNode): string[] => {
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

const canInlineDiff = (oldNode: PMNode, newNode: PMNode): boolean => {
    const simpleType = (node: PMNode) => node.type.name === "paragraph" || node.type.name === "heading";
    return (
        simpleType(oldNode) &&
        simpleType(newNode) &&
        oldNode.type.name === newNode.type.name &&
        JSON.stringify(oldNode.attrs) === JSON.stringify(newNode.attrs) &&
        isPlainTextBlock(oldNode) &&
        isPlainTextBlock(newNode)
    );
};

const topLevelBlocks = (doc: PMNode): PMNode[] => {
    const blocks: PMNode[] = [];
    doc.forEach(node => blocks.push(node));
    return blocks;
};

/** Plain-text excerpt used to distinguish change controls for assistive tech. */
const summarize = (lines: string[]): string => {
    const text = lines.join(" ").replace(/\s+/g, " ").trim();
    return text.length > 60 ? `${text.slice(0, 57)}…` : text;
};

/**
 * Text positions inside a text block: content starts one position after the
 * block, and plain-text blocks contain only text nodes, so one character is one
 * position (marks do not affect positions).
 */
const inlinePos = (blockStart: number, offset: number): number => blockStart + 1 + offset;

const inlineChanges = (
    baseline: PMNode,
    oldNode: PMNode,
    oldBlockStart: number,
    newNode: PMNode,
    newBlockStart: number,
    nextChangeId: () => string
): CanvasChange[] | null => {
    if (!canInlineDiff(oldNode, newNode)) return null;
    const oldText = oldNode.textContent;
    const newText = newNode.textContent;
    const segments = diffWords(oldText, newText);
    if (!segments) return null;

    // A fundamental rewrite is one decision between the two complete strings;
    // word-level fragments would just be noise (and can produce insert-only
    // hunks without a counterpart).
    if (unchangedShare(segments) < SIMILARITY_THRESHOLD) {
        return [
            {
                id: nextChangeId(),
                level: "inline" as const,
                kind: oldText && newText ? "replace" : newText ? "insert" : "delete",
                from: inlinePos(newBlockStart, 0),
                to: inlinePos(newBlockStart, newText.length),
                oldSliceJson: oldText ? baseline.slice(inlinePos(oldBlockStart, 0), inlinePos(oldBlockStart, oldText.length)).toJSON() : null,
                oldText,
                summary: summarize([newText || oldText])
            }
        ];
    }

    const hunks = hunksFromSegments(oldText, newText, segments);
    if (hunks.length === 0) return null;

    return hunks.map(hunk => {
        const oldFrom = inlinePos(oldBlockStart, hunk.oldStart);
        const oldTo = inlinePos(oldBlockStart, hunk.oldEnd);
        const kind = hunk.oldText && hunk.newText ? "replace" : hunk.newText ? "insert" : "delete";
        return {
            id: nextChangeId(),
            level: "inline" as const,
            kind,
            from: inlinePos(newBlockStart, hunk.newStart),
            to: inlinePos(newBlockStart, hunk.newEnd),
            oldSliceJson: hunk.oldText ? baseline.slice(oldFrom, oldTo).toJSON() : null,
            oldText: hunk.oldText,
            summary: summarize([hunk.newText || hunk.oldText])
        };
    });
};

const blockChange = (baseline: PMNode, removed: PMNode[], added: PMNode[], oldStart: number, newStart: number, nextChangeId: () => string): CanvasChange => {
    const addedSize = added.reduce((size, node) => size + node.nodeSize, 0);
    const oldSize = removed.reduce((size, node) => size + node.nodeSize, 0);
    const oldLines = removed.flatMap(node => describeBlock(node));
    const kind = removed.length === 0 ? "insert" : added.length === 0 ? "delete" : "replace";
    return {
        id: nextChangeId(),
        level: "block",
        kind,
        from: newStart,
        to: newStart + addedSize,
        oldSliceJson: removed.length > 0 ? baseline.slice(oldStart, oldStart + oldSize).toJSON() : null,
        oldText: oldLines.join("\n"),
        summary: summarize(added.length > 0 ? added.map(node => node.textContent) : oldLines)
    };
};

/**
 * Ordered block preview of a stored revision relative to the current document.
 * "delete" lines exist only in the current text (a restore would remove them),
 * "insert" lines come from the revision (a restore would add them) — the same
 * red/green semantics as the review markup.
 */
export function describeRevisionDiff(current: PMNode, revision: PMNode): CanvasRevisionDiffItem[] {
    const currentBlocks = topLevelBlocks(current);
    const revisionBlocks = topLevelBlocks(revision);
    const ops = diffSequences(currentBlocks, revisionBlocks, (left, right) => left.eq(right));

    // Too many blocks to align: coarse summary rather than a per-block view.
    if (!ops) {
        if (current.eq(revision)) return [];
        return [
            ...(currentBlocks.length > 0 ? [{ kind: "delete" as const, lines: currentBlocks.flatMap(node => describeBlock(node)) }] : []),
            ...(revisionBlocks.length > 0 ? [{ kind: "insert" as const, lines: revisionBlocks.flatMap(node => describeBlock(node)) }] : [])
        ];
    }

    const items: CanvasRevisionDiffItem[] = [];
    let run: CanvasRevisionDiffItem | undefined;
    for (const op of ops) {
        if (op.type === "equal") {
            if (run) items.push(run);
            run = undefined;
            items.push({ kind: "equal", lines: describeBlock(currentBlocks[op.a]) });
            continue;
        }
        const kind = op.type === "delete" ? "delete" : "insert";
        const lines = describeBlock(op.type === "delete" ? currentBlocks[op.a] : revisionBlocks[op.b]);
        if (run && run.kind === kind) run.lines.push(...lines);
        else {
            if (run) items.push(run);
            run = { kind, lines };
        }
    }
    if (run) items.push(run);
    return items;
}

export function computeCanvasChanges(baseline: PMNode, target: PMNode): CanvasChange[] {
    const oldBlocks = topLevelBlocks(baseline);
    const newBlocks = topLevelBlocks(target);
    const ops = diffSequences(oldBlocks, newBlocks, (left, right) => left.eq(right));
    let changeCounter = 1;
    const nextChangeId = () => `change-${changeCounter++}`;

    // Too many blocks to align: expose the whole rewrite as one reviewable change.
    if (!ops) {
        if (baseline.eq(target)) return [];
        return [blockChange(baseline, oldBlocks, newBlocks, 0, 0, nextChangeId)];
    }

    const changes: CanvasChange[] = [];
    let opIndex = 0;
    // Positions are tracked incrementally: baseline and target block sizes only.
    let oldPos = 0;
    let newPos = 0;

    while (opIndex < ops.length) {
        const op = ops[opIndex];
        if (op.type === "equal") {
            oldPos += oldBlocks[op.a].nodeSize;
            newPos += newBlocks[op.b].nodeSize;
            opIndex++;
            continue;
        }

        const oldStart = oldPos;
        const newStart = newPos;
        const removed: PMNode[] = [];
        const added: PMNode[] = [];
        while (opIndex < ops.length && ops[opIndex].type !== "equal") {
            const runOp = ops[opIndex];
            if (runOp.type === "delete") removed.push(oldBlocks[runOp.a]);
            else if (runOp.type === "insert") added.push(newBlocks[runOp.b]);
            opIndex++;
        }
        for (const node of removed) oldPos += node.nodeSize;
        for (const node of added) newPos += node.nodeSize;

        if (removed.length === 0 || added.length === 0 || removed.length !== added.length) {
            // Pure insertion/deletion runs and merge/split runs stay one block change.
            changes.push(blockChange(baseline, removed, added, oldStart, newStart, nextChangeId));
            continue;
        }

        // Equal counts: pair the blocks so each rewritten block is reviewed on its
        // own (and inline-diffable pairs are split into independent phrase hunks).
        let oldCursor = oldStart;
        let newCursor = newStart;
        removed.forEach((oldNode, index) => {
            const newNode = added[index];
            const inline = inlineChanges(baseline, oldNode, oldCursor, newNode, newCursor, nextChangeId);
            if (inline) changes.push(...inline);
            else changes.push(blockChange(baseline, [oldNode], [newNode], oldCursor, newCursor, nextChangeId));
            oldCursor += oldNode.nodeSize;
            newCursor += newNode.nodeSize;
        });
    }

    return changes;
}
