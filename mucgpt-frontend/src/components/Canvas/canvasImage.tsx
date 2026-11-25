import { Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { MarkdownSerializerState } from "prosemirror-markdown";

import { PolicyImage } from "../MarkdownRenderer/markdownLinkPolicy";

const CanvasImageView = ({ node }: NodeViewProps) => (
    <NodeViewWrapper as="span">
        <PolicyImage src={String(node.attrs.src ?? "")} alt={String(node.attrs.alt ?? "")} />
    </NodeViewWrapper>
);

/**
 * Canvas image node: only exists through prepareCanvasMarkdown-sanitized
 * ingestion, but every render re-runs the image policy in the node view, so
 * a foreign URL is fetched only after an explicit user approval (issue #228).
 */
export const CanvasImage = Node.create({
    name: "image",
    inline: true,
    group: "inline",
    draggable: true,
    atom: true,

    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null }
        };
    },

    parseHTML() {
        return [{ tag: "img[src]" }];
    },

    // The serialized form must not contain a fetchable "src": ProseMirror
    // rebuilds the DOM from renderHTML whenever node views are temporarily
    // unregistered (EditorContent unmount redraw, remount window), and that
    // fallback DOM attaches to the live document (issue #228). The export
    // adapters materialize real <img> elements from the data attributes.
    renderHTML({ node }) {
        return [
            "span",
            {
                "data-canvas-image-src": String(node.attrs.src ?? ""),
                "data-canvas-image-alt": String(node.attrs.alt ?? "")
            }
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(CanvasImageView);
    },

    addStorage() {
        return {
            markdown: {
                serialize: (state: MarkdownSerializerState, node: ProseMirrorNode) => {
                    const alt = String(node.attrs.alt ?? "");
                    const src = String(node.attrs.src ?? "");
                    state.write(`![${state.esc(alt)}](${src})`);
                }
            }
        };
    }
});
