import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Block-level diff between two canvas documents, used for the accept/reject
 * review after an agent turn (or a version restore). The diff works on
 * top-level blocks: consecutive non-equal blocks form one change, so a change
 * is either an inserted block run, a deleted block run, or a replacement run.
 * Replacements of a single plain-text block additionally carry a word-level
 * diff for inline highlighting.
 *
 * The produced ranges are positions in the target document. Pure deletions
 * have an empty range (the anchor where the old blocks were removed).
 */
export interface CanvasDiffSegment {
    kind: "equal" | "insert" | "delete";
    text: string;
}

export interface CanvasChange {
    id: string;
    kind: "insert" | "delete" | "replace";
    /** Target document range; empty for pure deletions (insertion anchor). */
    from: number;
    to: number;
    /** Baseline content restored on reject; null for pure insertions. */
    oldSliceJson: unknown | null;
    /** Word-level segments for inline replacements. */
    inline?: CanvasDiffSegment[];
    /** Plain-text lines of the removed block content for block-level changes. */
    oldLines?: string[];
    /** Short plain-text excerpt of the change for accessible control labels. */
    summary: string;
}

type DiffOp = { type: "equal"; a: number; b: number } | { type: "insert"; b: number } | { type: "delete"; a: number };

/** Upper bound for the LCS matrix; larger inputs degrade to a coarse comparison. */
const MAX_MATRIX_CELLS = 250_000;
/** Inline word diffs are skipped beyond this combined text length. */
const MAX_INLINE_TEXT = 60_000;

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

export function computeCanvasChanges(baseline: PMNode, target: PMNode): CanvasChange[] {
    const oldBlocks = topLevelBlocks(baseline);
    const newBlocks = topLevelBlocks(target);
    const ops = diffSequences(oldBlocks, newBlocks, (left, right) => left.eq(right));
    let changeCounter = 1;
    const nextChangeId = () => `change-${changeCounter++}`;

    // Too many blocks to align: expose the whole rewrite as one reviewable change.
    if (!ops) {
        const wholeDoc: CanvasChange[] = [];
        if (!baseline.eq(target)) {
            const from = 0;
            const to = target.content.size;
            const oldSliceJson = baseline.content.size > 0 ? baseline.slice(from, baseline.content.size).toJSON() : null;
            const oldLines = oldSliceJson ? oldBlocks.flatMap(node => describeBlock(node)) : [];
            const changed: CanvasChange = {
                id: nextChangeId(),
                kind: oldSliceJson ? "replace" : "insert",
                from,
                to,
                oldSliceJson,
                summary: summarize(oldLines)
            };
            // No inline segmentation here: word offsets cannot span block boundaries.
            if (oldLines.length > 0) changed.oldLines = oldLines;
            wholeDoc.push(changed);
        }
        return wholeDoc;
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

        const oldSliceJson = removed.length > 0 ? baseline.slice(oldStart, oldPos).toJSON() : null;
        const targetEnd = added.length > 0 ? newPos : newStart;

        if (removed.length === 0) {
            const summary = summarize(added.map(node => node.textContent));
            changes.push({ id: nextChangeId(), kind: "insert", from: newStart, to: targetEnd, oldSliceJson: null, summary });
            continue;
        }

        const oldLines = removed.flatMap(node => describeBlock(node));
        if (added.length === 0) {
            changes.push({ id: nextChangeId(), kind: "delete", from: newStart, to: newStart, oldSliceJson, oldLines, summary: summarize(oldLines) });
            continue;
        }

        const inline =
            removed.length === 1 && added.length === 1 && canInlineDiff(removed[0], added[0]) ? diffWords(removed[0].textContent, added[0].textContent) : null;
        if (inline && inline.some(segment => segment.kind !== "equal")) {
            const summary = summarize(added.map(node => node.textContent));
            changes.push({ id: nextChangeId(), kind: "replace", from: newStart, to: targetEnd, oldSliceJson, inline, summary });
        } else {
            changes.push({ id: nextChangeId(), kind: "replace", from: newStart, to: targetEnd, oldSliceJson, oldLines, summary: summarize(oldLines) });
        }
    }

    return changes;
}
