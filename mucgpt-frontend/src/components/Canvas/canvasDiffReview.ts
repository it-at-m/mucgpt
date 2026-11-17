import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { CanvasChange } from "./canvasDiff";
import styles from "./CanvasDiffReview.module.css";

export interface CanvasReviewLabels {
    accept: string;
    reject: string;
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

/** Distinguishes change controls for assistive tech without relying on position. */
const describe = (label: string, change: CanvasChange): string => (change.summary ? `${label}: ${change.summary}` : label);

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

const controlsWidget = (change: CanvasChange, labels: CanvasReviewLabels, block: boolean) => () => {
    const container = document.createElement("span");
    container.className = block ? `${styles.controls} ${styles.controlsBlock}` : styles.controls;
    container.setAttribute("contenteditable", "false");
    container.append(
        controlButton(styles.acceptControl, "✓", change, "accept", describe(labels.accept, change)),
        controlButton(styles.rejectControl, "✕", change, "reject", describe(labels.reject, change))
    );
    return container;
};

/** Strikethrough button holding the removed text; clicking/activating it rejects the change. */
const deletionWidget = (change: CanvasChange, text: string, labels: CanvasReviewLabels, block: boolean) => () => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = block ? styles.deletionBlock : styles.deletion;
    button.textContent = text;
    button.setAttribute("aria-label", describe(labels.reject, change));
    button.title = describe(labels.reject, change);
    for (const [name, value] of Object.entries(changeAttrs(change, "reject"))) button.setAttribute(name, value);
    return button;
};

const inlineDecorations = (change: CanvasChange, labels: CanvasReviewLabels): Decoration[] => {
    const decorations: Decoration[] = [];
    // change.from is the node position; inline content starts one position later.
    let offset = change.from + 1;
    for (const segment of change.inline ?? []) {
        if (segment.kind === "equal") {
            offset += segment.text.length;
            continue;
        }
        if (segment.kind === "insert") {
            decorations.push(
                Decoration.inline(
                    offset,
                    offset + segment.text.length,
                    { class: styles.insertion, title: describe(labels.accept, change), ...changeAttrs(change, "accept") },
                    changeSpec(change)
                )
            );
            offset += segment.text.length;
            continue;
        }
        decorations.push(
            Decoration.widget(offset, deletionWidget(change, segment.text, labels, false), {
                side: -1,
                key: `${change.id}-del-${offset}`,
                stopEvent: () => true,
                ...changeSpec(change)
            })
        );
    }
    return decorations;
};

/**
 * Builds the visual review layer: green highlighted new text, red strikethrough
 * old text and per-change accept/reject controls. The document itself is not
 * modified — range decorations and widgets are view-only.
 */
const oldTextLines = (change: CanvasChange): string => (change.oldLines ?? []).join("\n");

export function buildReviewDecorations(doc: PMNode, changes: CanvasChange[], labels: CanvasReviewLabels): DecorationSet {
    const decorations: Decoration[] = [];
    for (const change of changes) {
        if (change.inline) {
            decorations.push(...inlineDecorations(change, labels));
            decorations.push(
                Decoration.widget(change.to - 1, controlsWidget(change, labels, false), {
                    side: 1,
                    key: `${change.id}-controls`,
                    stopEvent: () => true,
                    ...changeSpec(change)
                })
            );
            continue;
        }

        if (change.kind === "delete") {
            if (oldTextLines(change).trim()) {
                decorations.push(
                    Decoration.widget(change.from, deletionWidget(change, oldTextLines(change), labels, true), {
                        side: -2,
                        key: `${change.id}-old`,
                        stopEvent: () => true,
                        ...changeSpec(change)
                    })
                );
            }
            decorations.push(
                Decoration.widget(change.from, controlsWidget(change, labels, true), {
                    side: -1,
                    key: `${change.id}-controls`,
                    stopEvent: () => true,
                    ...changeSpec(change)
                })
            );
            continue;
        }

        decorations.push(Decoration.node(change.from, change.to, { class: styles.insertedBlock, ...changeAttrs(change, "accept") }, changeSpec(change)));
        if (change.kind === "replace" && oldTextLines(change).trim()) {
            decorations.push(
                Decoration.widget(change.from, deletionWidget(change, oldTextLines(change), labels, true), {
                    side: -2,
                    key: `${change.id}-old`,
                    stopEvent: () => true,
                    ...changeSpec(change)
                })
            );
        }
        decorations.push(
            Decoration.widget(change.from, controlsWidget(change, labels, true), {
                side: -1,
                key: `${change.id}-controls`,
                stopEvent: () => true,
                ...changeSpec(change)
            })
        );
    }
    return DecorationSet.create(doc, decorations);
}
