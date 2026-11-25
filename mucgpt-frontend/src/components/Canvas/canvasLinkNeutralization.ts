import { describeLinkText } from "../MarkdownRenderer/markdownLinkPolicy";

/**
 * Canvas link neutralization: the canvas document must never contain link
 * marks or link/image markdown that could later be rendered, exported or
 * round-tripped as clickable links or fetched images (issue #228).
 */

/**
 * Flatten clipboard HTML before TipTap parses it: every anchor becomes the
 * text "description (url)" (or just the text when there is no href), so
 * pasted rich text cannot introduce link marks.
 */
export const flattenPastedLinks = (html: string): string => {
    if (!/<a[\s>]/i.test(html)) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("a").forEach(anchor => {
        const text = describeLinkText(anchor.textContent ?? "", anchor.getAttribute("href") ?? "");
        anchor.replaceWith(doc.createTextNode(text));
    });
    return doc.body.innerHTML;
};

/**
 * Strip link marks from a ProseMirror document JSON. Older revisions may
 * still contain them; the schema no longer knows the mark, so parsing would
 * fail. The link text is kept, only the mark (and with it the URL) is lost.
 */
export const withoutLinkMarks = (docJson: unknown): unknown => {
    if (Array.isArray(docJson)) return docJson.map(withoutLinkMarks);
    if (docJson === null || typeof docJson !== "object") return docJson;
    const source = docJson as Record<string, unknown>;
    const result: Record<string, unknown> = { ...source };
    if (Array.isArray(source.marks)) {
        result.marks = source.marks.filter(mark => (mark as Record<string, unknown> | null)?.type !== "link");
    }
    if (source.content) result.content = withoutLinkMarks(source.content);
    return result;
};
