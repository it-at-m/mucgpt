import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Keeps the last selection (muted highlight) and caret position (brand-colored
 * caret) visible while the editor is unfocused, so they survive typing in the
 * chat input and tell the user where the agent anchors edits (the caret offset
 * is what toCanvasState reports as `cursor`).
 */

export const CANVAS_PERSISTENCE_RESET = "canvasPersistenceReset";
const FOCUS_META = "canvasPersistenceFocus";

const persistenceKey = new PluginKey("canvasPersistentSelection");

interface PersistenceState {
    focused: boolean;
    selection: { from: number; to: number } | null;
    caret: number | null;
}

const caretWidget = () => {
    const caret = document.createElement("span");
    caret.className = "canvas-persistent-caret";
    return caret;
};

/**
 * The anchor the user currently sees (marker = what toCanvasState sends as
 * `cursor`): the persistent caret position, or null once it was cleared (agent
 * rewrite, canvas reset) until the user places a caret again.
 */
export const persistentCaret = (editor: Editor | null): number | null => {
    if (!editor) return null;
    const stored = persistenceKey.getState(editor.state) as PersistenceState | undefined;
    return stored?.caret ?? null;
};

export const CanvasSelectionPersistence = Extension.create({
    name: "canvasSelectionPersistence",

    onBlur() {
        const { state, view } = this.editor;
        view.dispatch(state.tr.setMeta(FOCUS_META, false));
    },
    onFocus() {
        const { state, view } = this.editor;
        view.dispatch(state.tr.setMeta(FOCUS_META, true));
    },

    addProseMirrorPlugins() {
        return [
            new Plugin<PersistenceState>({
                key: persistenceKey,
                state: {
                    init: () => ({ focused: false, selection: null, caret: null }),
                    apply: (tr, value): PersistenceState => {
                        const focusMeta = tr.getMeta(FOCUS_META);
                        let focused = value.focused;
                        if (typeof focusMeta === "boolean") focused = focusMeta;
                        if (tr.getMeta(CANVAS_PERSISTENCE_RESET)) {
                            return { focused, selection: null, caret: null };
                        }
                        const mapped: PersistenceState = {
                            focused,
                            selection: value.selection ? { from: tr.mapping.map(value.selection.from), to: tr.mapping.map(value.selection.to) } : null,
                            caret: value.caret !== null ? tr.mapping.map(value.caret) : null
                        };
                        if (tr.selectionSet) {
                            const { from, to, empty } = tr.selection;
                            if (empty) {
                                mapped.selection = null;
                                mapped.caret = from;
                            } else {
                                mapped.selection = { from, to };
                                mapped.caret = null;
                            }
                        }
                        return mapped;
                    }
                },
                props: {
                    decorations(state) {
                        const stored = persistenceKey.getState(state) as PersistenceState | undefined;
                        if (!stored || stored.focused) return DecorationSet.empty;
                        if (stored.selection) {
                            return DecorationSet.create(state.doc, [
                                Decoration.inline(stored.selection.from, stored.selection.to, { class: "canvas-persistent-selection" })
                            ]);
                        }
                        if (stored.caret !== null) {
                            return DecorationSet.create(state.doc, [Decoration.widget(stored.caret, caretWidget)]);
                        }
                        return DecorationSet.empty;
                    }
                }
            })
        ];
    }
});
