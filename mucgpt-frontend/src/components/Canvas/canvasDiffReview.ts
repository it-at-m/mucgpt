import { Extension } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { summarize, type CanvasChange } from "./canvasDiff";
import { appendDiffFragment } from "./canvasDiffMarkup";
import styles from "./CanvasDiffReview.module.css";

/** Hover highlight class, applied from the controller to all green parts of one change. */
export const insertionHoverClass = styles.insertionHover;

export interface CanvasReviewLabels {
    acceptNew: string;
    keepOld: string;
    removeOld: string;
    removeNew: string;
}

/** Transactions carrying this meta replace the review decoration set. */
export const CANVAS_REVIEW_META = "canvasReviewDecorations";

const canvasReviewPluginKey = new PluginKey<{ decorations: DecorationSet }>("canvasReview");

/**
 * Holds the review decorations outside the document: nothing in the ProseMirror
 * doc or its JSON/markdown serialization changes while changes are pending,
 * so the agent always sees the new text and snapshots stay clean.
 */
export const CanvasDiffReview = Extension.create({
    name: "canvasDiffReview",
    addProseMirrorPlugins() {
        return [
            new Plugin<{ decorations: DecorationSet }>({
                key: canvasReviewPluginKey,
                state: {
                    init: () => ({ decorations: DecorationSet.empty }),
                    apply(tr, value) {
                        const next = tr.getMeta(CANVAS_REVIEW_META) as DecorationSet | undefined;
                        if (next !== undefined) return { decorations: next.map(tr.mapping, tr.doc) };
                        if (tr.docChanged) return { decorations: value.decorations.map(tr.mapping, tr.doc) };
                        return value;
                    }
                },
                props: {
                    decorations(state) {
                        return canvasReviewPluginKey.getState(state)?.decorations ?? null;
                    }
                }
            })
        ];
    }
});

const reviewDecorations = (state: EditorState): DecorationSet => canvasReviewPluginKey.getState(state)?.decorations ?? DecorationSet.empty;

/** Keeps only the decorations whose spec passes the predicate (used to drop resolved changes). */
export const filterReviewDecorations = (state: EditorState, keep: (spec: Record<string, unknown>) => boolean): DecorationSet =>
    DecorationSet.create(
        state.doc,
        reviewDecorations(state).find(undefined, undefined, spec => keep((spec ?? {}) as Record<string, unknown>))
    );

const changeAttrs = (change: CanvasChange, action: "accept" | "reject"): Record<string, string> => ({
    "data-canvas-review-change": change.id,
    "data-canvas-review-action": action
});

/** Spec tag used to identify and drop a change's decorations later. */
const changeSpec = (change: CanvasChange): Record<string, unknown> => ({ changeId: change.id });

/**
 * Tooltip/accessible name per hovered element and change kind: accepting keeps
 * the new text (or removes the old one when nothing was added), rejecting keeps
 * the old text (or removes the new one when nothing was removed).
 */
const tooltip = (labels: CanvasReviewLabels, change: CanvasChange, action: "accept" | "reject"): string => {
    if (action === "accept") {
        return change.newText ? `${labels.acceptNew}: ${summarize([change.newText])}` : `${labels.removeOld}: ${summarize([change.oldText])}`;
    }
    return change.oldText ? `${labels.keepOld}: ${summarize([change.oldText])}` : `${labels.removeNew}: ${summarize([change.newText])}`;
};

const controlButton = (className: string, glyph: string, change: CanvasChange, action: "accept" | "reject", label: string): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = glyph;
    button.setAttribute("aria-label", label);
    button.title = label;
    for (const [name, value] of Object.entries(changeAttrs(change, action))) button.setAttribute(name, value);
    return button;
};

/** Widgets between list items must be list items themselves (valid <ul> DOM). */
const listWrapper = (child: HTMLElement): HTMLLIElement => {
    const item = document.createElement("li");
    item.className = styles.listWidget;
    item.appendChild(child);
    return item;
};

const controlsWidget = (change: CanvasChange, labels: CanvasReviewLabels, block: boolean, list: boolean) => () => {
    const container = document.createElement("span");
    container.className = block ? `${styles.controls} ${styles.controlsBlock}` : styles.controls;
    container.setAttribute("contenteditable", "false");
    container.append(
        controlButton(styles.acceptControl, "✓", change, "accept", tooltip(labels, change, "accept")),
        controlButton(styles.rejectControl, "✕", change, "reject", tooltip(labels, change, "reject"))
    );
    return list ? listWrapper(container) : container;
};

/** Strikethrough button holding the removed text; clicking/activating it rejects the change. */
const deletionWidget = (change: CanvasChange, labels: CanvasReviewLabels, block: boolean, list: boolean, schema?: Schema) => () => {
    // Block-level removals may contain block content (lists, tables), which a
    // <button> must not contain — a focusable role="button" div is used instead.
    const root = document.createElement(block ? "div" : "button");
    if (block) {
        root.setAttribute("role", "button");
        root.setAttribute("tabindex", "0");
    } else {
        (root as HTMLButtonElement).type = "button";
    }
    root.className = block ? styles.deletionBlock : styles.deletion;
    if (!schema || !appendDiffFragment(root, schema, change.oldFragmentJson, change.oldFragmentTag)) {
        root.textContent = change.oldText;
    }
    const rejectText = tooltip(labels, change, "reject");
    root.setAttribute("aria-label", rejectText);
    root.title = rejectText;
    for (const [name, value] of Object.entries(changeAttrs(change, "reject"))) root.setAttribute(name, value);
    return list && block ? listWrapper(root) : root;
};

/** True when the change's end position sits inside a list (widgets need <li>). */
const inListContext = (doc: PMNode, position: number): boolean => {
    const name = doc.resolve(Math.min(position, doc.content.size)).parent.type.name;
    return name === "bulletList" || name === "orderedList";
};

const inlineDecorations = (change: CanvasChange, labels: CanvasReviewLabels, list: boolean, schema?: Schema): Decoration[] => {
    const decorations: Decoration[] = [];
    if (change.kind !== "delete") {
        decorations.push(
            Decoration.inline(
                change.from,
                change.to,
                { class: styles.insertion, title: tooltip(labels, change, "accept"), ...changeAttrs(change, "accept") },
                changeSpec(change)
            )
        );
    }
    // Order matches the accept/reject controls: new text, removed text, buttons.
    if (change.oldText.trim()) {
        decorations.push(
            Decoration.widget(change.to, deletionWidget(change, labels, false, list, schema), {
                side: -1,
                key: `${change.id}-old`,
                stopEvent: () => true,
                ...changeSpec(change)
            })
        );
    }
    decorations.push(
        Decoration.widget(change.to, controlsWidget(change, labels, false, list), {
            side: 1,
            key: `${change.id}-controls`,
            stopEvent: () => true,
            ...changeSpec(change)
        })
    );
    return decorations;
};

/**
 * Node decorations apply to exactly one node: a change covering several blocks
 * (coalesced insert run) needs one decoration per covered top-most node, or
 * none of the attributes would be applied at all.
 */
const coveredNodes = (doc: PMNode, from: number, to: number): { node: PMNode; pos: number }[] => {
    const candidates: { node: PMNode; pos: number; end: number }[] = [];
    doc.nodesBetween(from, to, (node, pos) => {
        if (node.isBlock && pos >= from && pos + node.nodeSize <= to) candidates.push({ node, pos, end: pos + node.nodeSize });
        return true;
    });
    return candidates.filter(candidate => !candidates.some(other => other !== candidate && other.pos <= candidate.pos && other.end >= candidate.end));
};

const blockDecorations = (doc: PMNode, change: CanvasChange, labels: CanvasReviewLabels, list: boolean, schema?: Schema): Decoration[] => {
    const decorations: Decoration[] = [];
    if (change.kind !== "delete") {
        // Node decorations apply to exactly one node: a change covering several
        // blocks (coalesced insert run) needs one decoration per covered
        // top-most node, or none of the attributes would be applied at all.
        for (const { node, pos } of coveredNodes(doc, change.from, change.to)) {
            decorations.push(
                Decoration.node(
                    pos,
                    pos + node.nodeSize,
                    { class: styles.insertedBlock, title: tooltip(labels, change, "accept"), ...changeAttrs(change, "accept") },
                    changeSpec(change)
                )
            );
        }
    }
    // Order matches the accept/reject controls: green block, red box, buttons.
    if (change.oldText.trim()) {
        decorations.push(
            Decoration.widget(change.to, deletionWidget(change, labels, true, list, schema), {
                side: -2,
                key: `${change.id}-old`,
                stopEvent: () => true,
                ...changeSpec(change)
            })
        );
    }
    decorations.push(
        Decoration.widget(change.to, controlsWidget(change, labels, true, list), {
            side: -1,
            key: `${change.id}-controls`,
            stopEvent: () => true,
            ...changeSpec(change)
        })
    );
    return decorations;
};

/**
 * Builds the visual review layer: green highlighted new text, red strikethrough
 * old text and per-change accept/reject controls. The document itself is not
 * modified — range decorations and widgets are view-only.
 */
export function buildReviewDecorations(doc: PMNode, changes: CanvasChange[], labels: CanvasReviewLabels, schema?: Schema): DecorationSet {
    const decorations: Decoration[] = [];
    for (const change of changes) {
        const list = inListContext(doc, change.to);
        decorations.push(
            ...(change.level === "inline" ? inlineDecorations(change, labels, list, schema) : blockDecorations(doc, change, labels, list, schema))
        );
    }
    return DecorationSet.create(doc, decorations);
}
