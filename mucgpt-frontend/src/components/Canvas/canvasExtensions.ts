import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Table } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

/**
 * Canvas schema. The schema is the gatekeeper: only nodes that
 * round-trip through GFM may be produced. Underline is therefore disabled — GFM cannot
 * express it and the v1 HTML allowlist is empty. Hard-break parsing is on.
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
    Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: true
    })
];
