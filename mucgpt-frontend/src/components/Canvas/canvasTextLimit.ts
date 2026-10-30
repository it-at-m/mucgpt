import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

import { CANVAS_EXPORT_LIMIT_CHARS, CANVAS_WARN_CHARS } from "./canvasLimits";
import styles from "./CanvasEditor.module.css";

/**
 * Editor-side canvas size limits:
 * - transactions that would push the document beyond the export limit are
 *   clipped (end insertions) or rejected (insertions in the middle)
 * - content beyond the warning threshold is greyed out by decoration, the
 *   underlying text stays untouched
 *
 * Both checks count ProseMirror text characters (block separators uncounted),
 * an approximation of the markdown length the backend caps.
 */

export const textLength = (doc: PMNode): number => doc.textBetween(0, doc.content.size, "\n", "\n").length;

/** PM position of the n-th text character, or the document end. */
export const textPosForCharIndex = (doc: PMNode, charIndex: number): number => {
    let acc = 0;
    let boundary: number | null = null;
    doc.descendants((node, pos) => {
        if (boundary !== null) return false;
        if (node.isText) {
            const len = node.text?.length ?? 0;
            if (acc + len >= charIndex) {
                boundary = pos + (charIndex - acc);
                return false;
            }
            acc += len;
        }
        return true;
    });
    return boundary ?? doc.content.size;
};

const decorationsFor = (doc: PMNode): DecorationSet => {
    // content.size is an upper bound of the text length: a cheap early-out
    if (doc.content.size <= CANVAS_WARN_CHARS) return DecorationSet.empty;
    if (textLength(doc) <= CANVAS_WARN_CHARS) return DecorationSet.empty;
    const from = textPosForCharIndex(doc, CANVAS_WARN_CHARS);
    if (from >= doc.content.size) return DecorationSet.empty;
    return DecorationSet.create(doc, [Decoration.inline(from, doc.content.size, { class: styles.overLimitText })]);
};

export const canvasTextLimitKey = new PluginKey<DecorationSet>("canvasTextLimit");

/** Fired (window-level) when pasted content was clipped to the export limit. */
export const CANVAS_PASTE_CLIPPED_EVENT = "mucgpt-canvas-paste-clipped";

export const canvasTextLimit = Extension.create({
    name: "canvasTextLimit",
    addProseMirrorPlugins() {
        const textBetween = (doc: PMNode) => doc.textBetween(0, doc.content.size, "\n", "\n");

        return [
            new Plugin<DecorationSet>({
                key: canvasTextLimitKey,
                state: {
                    init: (_, { doc }) => decorationsFor(doc),
                    apply: (tr, _value, _old, newState) => (tr.docChanged ? decorationsFor(newState.doc) : _value)
                },
                props: {
                    decorations: (state: EditorState) => canvasTextLimitKey.getState(state)
                }
            }),
            new Plugin({
                // Content beyond the limit either clips at the end (the common
                // bulk-paste case) or is rejected outright (mid-document
                // insertions would clip unrelated existing text). The clip is a
                // regular transaction, so undo restores the pre-clip state.
                filterTransaction: (tr: Transaction, state: EditorState) => {
                    if (!tr.docChanged) return true;
                    if (tr.doc.content.size <= CANVAS_EXPORT_LIMIT_CHARS) return true;
                    if (textBetween(tr.doc).length <= CANVAS_EXPORT_LIMIT_CHARS) return true;
                    // end insertion: the pre-limit text is a prefix of the new
                    // text; appendTransaction clips it to fit
                    return textBetween(tr.doc).startsWith(textBetween(state.doc));
                },
                appendTransaction: (transactions, _oldState, newState) => {
                    if (!transactions.some(tr => tr.docChanged)) return null;
                    if (newState.doc.content.size <= CANVAS_EXPORT_LIMIT_CHARS) return null;
                    if (textBetween(newState.doc).length <= CANVAS_EXPORT_LIMIT_CHARS) return null;

                    const clipped = newState.tr.delete(textPosForCharIndex(newState.doc, CANVAS_EXPORT_LIMIT_CHARS), newState.doc.content.size);
                    if (transactions.some(tr => tr.getMeta("paste") !== undefined)) {
                        window.dispatchEvent(new CustomEvent(CANVAS_PASTE_CLIPPED_EVENT));
                    }
                    return clipped;
                }
            })
        ];
    }
});
