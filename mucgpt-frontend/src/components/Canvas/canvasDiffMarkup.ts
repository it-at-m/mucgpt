import { DOMSerializer, Fragment } from "@tiptap/pm/model";
import type { Schema } from "@tiptap/pm/model";

/**
 * Renders a diff fragment (PM node JSON array) as properly formatted DOM —
 * the same rendering the editor uses for this content, only styled by the
 * diff view. Serialized via the DOM API, so no sanitization is required
 * (identical trust level to the editor rendering the same nodes).
 *
 * Returns false when nothing could be rendered; callers fall back to the
 * plain-text representation.
 */
export const appendDiffFragment = (container: HTMLElement, schema: Schema, fragmentJson: unknown, listTag?: "ul" | "ol"): boolean => {
    try {
        if (!Array.isArray(fragmentJson) || fragmentJson.length === 0) return false;
        const fragment = Fragment.fromJSON(schema, fragmentJson);
        if (fragment.childCount === 0) return false;
        const dom = DOMSerializer.fromSchema(schema).serializeFragment(fragment);
        // Inline fragments (phrase hunks) need a wrapper to stay one text line.
        const wrapper = fragment.firstChild?.isBlock ? null : document.createElement("span");
        if (wrapper) {
            wrapper.append(dom);
            container.append(wrapper);
        } else if (listTag) {
            const list = document.createElement(listTag);
            list.append(dom);
            container.append(list);
        } else {
            container.append(dom);
        }
        return true;
    } catch (error) {
        console.error("Rendering the diff fragment failed:", error);
        return false;
    }
};
