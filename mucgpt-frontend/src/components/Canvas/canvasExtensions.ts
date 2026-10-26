import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Table } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

import { CanvasSelectionPersistence } from "./canvasSelectionPersistence";

/**
 * Canvas schema. The schema is the gatekeeper: only nodes that
 * round-trip through GFM may be produced. Underline is therefore disabled —
 * GFM cannot express it and raw HTML is not allowed in the canvas, so HTML
 * markup would only show up as literal text (the Markdown parser runs with
 * html: false). Hard-break parsing is on.
 */
export const canvasExtensions = [
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
    Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: true
    })
];
