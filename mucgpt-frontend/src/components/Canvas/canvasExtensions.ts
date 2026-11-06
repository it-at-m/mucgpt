import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Table } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { Extensions } from "@tiptap/core";

import { CanvasSelectionPersistence } from "./canvasSelectionPersistence";
import { canvasTextLimit, type CanvasTextLimitOptions } from "./canvasTextLimit";

/**
 * Canvas schema. The schema is the gatekeeper: only nodes that
 * round-trip through GFM may be produced. Underline is therefore disabled —
 * GFM cannot express it and raw HTML is not allowed in the canvas, so HTML
 * markup would only show up as literal text (the Markdown parser runs with
 * html: false). Hard-break parsing is on.
 *
 * The size limits come from the backend config; call sites pass the values
 * from useCanvasLimits() (omitting them keeps the built-in defaults, e.g. for
 * schema-only uses like HTML generation in the Versions drawer).
 */
export const canvasExtensions = (limits?: Partial<CanvasTextLimitOptions>): Extensions => [
    StarterKit.configure({
        underline: false
    }),
    Table.configure({
        resizable: false
    }),
    TableRow,
    TableHeader,
    TableCell,
    CanvasSelectionPersistence,
    canvasTextLimit.configure(limits),
    Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: true
    })
];
