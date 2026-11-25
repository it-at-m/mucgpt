import { getApprovedImageUrls } from "../MarkdownRenderer/imageApprovals";
import { INLINE_IMAGE_RE, describeLinkText, destinationOf } from "../MarkdownRenderer/markdownLinkPolicy";
import type { ExportTarget } from "../../api/core-client";

/**
 * Export preparation for the canvas image policy: markdown keeps image
 * syntax only for URLs approved in this conversation (everything else
 * becomes its "alt (url)" text), and the HTML for the server-side converters
 * inlines approved images as data URIs for the PDF converter (the only
 * renderer that fetches images at all — and only data: URIs), so no
 * export-side server fetch happens (issue #228).
 */

export const markdownForExport = (markdown: string): string =>
    markdown.replace(INLINE_IMAGE_RE, (match, alt: string, destination: string) =>
        getApprovedImageUrls().includes(destinationOf(destination)) ? match : describeLinkText(alt, destinationOf(destination))
    );

const toDataUri = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const blob = await response.blob();
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        // A CORS-blocked or invalid image cannot be inlined; the text
        // fallback keeps the export complete without the image.
        return null;
    }
};

/**
 * Approved images become real <img> elements with data URIs for the PDF
 * export; everywhere a fetched image cannot appear (other targets, denied
 * fetches, unapproved URLs) the image degrades to its "alt (url)" text.
 * The editor serializes image nodes as spans with data attributes (never a
 * fetchable src, issue #228); stray img elements are handled the same way.
 */
export const inlineApprovedImages = async (html: string, target: ExportTarget): Promise<string> => {
    const approved = target === "pdf" ? new Set(getApprovedImageUrls()) : null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = [...doc.querySelectorAll<HTMLElement>("span[data-canvas-image-src], img")];
    for (const node of nodes) {
        const src = node.getAttribute("data-canvas-image-src") ?? node.getAttribute("src") ?? "";
        const alt = node.getAttribute("data-canvas-image-alt") ?? node.getAttribute("alt") ?? "";
        const dataUri = approved?.has(src) ? await toDataUri(src) : null;
        if (dataUri) {
            const image = doc.createElement("img");
            image.setAttribute("src", dataUri);
            image.setAttribute("alt", alt);
            node.replaceWith(image);
        } else {
            node.replaceWith(doc.createTextNode(describeLinkText(alt, src)));
        }
    }
    return doc.body.innerHTML;
};
