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
 * Canvas schema. The schema is the gatekeeper: only nodes that round-trip
 * through GFM (plus the whitelisted raw-Html tags) may be produced. Underline
 * is expressed as raw HTML (<u>), a GFM limitation — see canvasHtmlWhitelist.ts:
 * the Markdown parser runs with html: true, but the markdown is pre-sanitized so
 * only attribute-free tags from the deployment's canvas_allowed_html_tags become
 * live markup; every other tag is escaped to literal text. Hard-break parsing
 * is on.
 *
 * The size limits come from the backend config; call sites pass the values
 * from useCanvasLimits() (omitting them keeps the built-in defaults, e.g. for
 * schema-only uses like HTML generation in the Versions drawer).
 */
export const canvasExtensions = (limits?: Partial<CanvasTextLimitOptions>): Extensions => [
    StarterKit.configure({
        underline: {},
        // No link mark in the schema: no ingestion path (markdown parsing,
        // rich-HTML paste, typed URLs) can create one (issue #228).
        link: false
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
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: true
    })
];
