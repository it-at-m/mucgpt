import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { Table } from "@tiptap/extension-table";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import type { Extensions } from "@tiptap/core";

import { CanvasImage } from "./canvasImage";
import { canvasLinkMarks } from "./canvasLinkPolicy";
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
 * Links carry the schema's link mark, but only the canvasLinkMarks pass
 * creates one, classifying each URL (allowlist: full URL; otherwise the
 * sanitized URL without query/fragment/userinfo; blocked: no mark). Images
 * become approval-gated nodes. The link-mark pass needs the domain
 * allowlist; call sites with policy enforcement pass a getter, and
 * schema-only uses (e.g. HTML generation in the Versions drawer) omit it.
 *
 * The size limits come from the backend config; call sites pass the values
 * from useCanvasLimits() (omitting them keeps the built-in defaults).
 */
export const canvasExtensions = (limits?: Partial<CanvasTextLimitOptions>, getAllowedDomains: () => readonly string[] = () => []): Extensions => [
    StarterKit.configure({
        underline: {},
        link: {
            // Navigation is explicit: interceptLinkClicks opens trusted links
            // and dialog-confirms untrusted ones (TipTap's own open handler
            // cannot be intercepted afterwards, and plain clicks inside
            // contenteditable never follow the DOM anchor default).
            openOnClick: false,
            autolink: false,
            linkOnPaste: false,
            HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" }
        }
    }),
    CanvasImage,
    canvasLinkMarks(getAllowedDomains),
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
