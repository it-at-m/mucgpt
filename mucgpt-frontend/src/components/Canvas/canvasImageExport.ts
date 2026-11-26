import DOMPurify from "dompurify";
import { INLINE_IMAGE_RE, classifyImageUrl, describeLinkText, destinationOf, isEmbeddableImageUrl } from "../MarkdownRenderer/markdownLinkPolicy";
import type { ExportTarget } from "../../api/core-client";

/**
 * Export preparation for the canvas image policy: markdown keeps image
 * syntax for allowlisted host URLs and approved URLs (everything else
 * becomes its "alt (url)" text). The HTML for the converters inlines
 * approved URLs as normalized data URIs and leaves allowlisted-host URLs
 * untouched for the server-side fetch; Excel keeps the text and has no
 * image semantics (issue #228).
 */

/** Mimes the DOCX converter accepts (mirrors IMAGE_DATA_MIMES in the backend). */
export const DOCX_DECODABLE_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/bmp", "image/tiff"]);

/**
 * Allowlisted https hosts are fetched server-side during export (their
 * image hosts do not send CORS headers, so the browser cannot read the
 * bytes). Their span representation stays untouched for the backend;
 * everything else uses the browser-side embedding.
 */
const isAllowlistedHost = (url: string, allowedDomains: readonly string[]): boolean =>
    url.trim().startsWith("https://") && classifyImageUrl(url, allowedDomains).kind === "allowed";

export const markdownForExport = (markdown: string, allowedDomains: readonly string[]): string =>
    markdown.replace(INLINE_IMAGE_RE, (match, alt: string, destination: string) => {
        const url = destinationOf(destination);
        return isEmbeddableImageUrl(url, allowedDomains) ? match : describeLinkText(alt, url);
    });

/**
 * Rasterize a fetched image blob through a canvas into a PNG data URI; used
 * whenever the served MIME is not one the DOCX contract decodes (WebP, AVIF,
 * missing content types, …). The browser decodes native formats; formats or
 * references the canvas refuses (e.g. SVG with external references) taint
 * the canvas and fail the conversion.
 */
const rasterizeToPngDataUri = (blob: Blob): Promise<string | null> =>
    new Promise(resolve => {
        try {
            const imageUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    canvas.width = image.naturalWidth;
                    canvas.height = image.naturalHeight;
                    canvas.getContext("2d")!.drawImage(image, 0, 0);
                    resolve(canvas.toDataURL("image/png"));
                } catch {
                    resolve(null);
                } finally {
                    URL.revokeObjectURL(imageUrl);
                }
            };
            image.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                resolve(null);
            };
            image.src = imageUrl;
        } catch {
            resolve(null);
        }
    });

const toDataUri = async (url: string): Promise<string | null> => {
    let blob: Blob | null = null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        blob = await response.blob();
    } catch {
        // A CORS-blocked or invalid image cannot be inlined; the text
        // fallback keeps the export complete without the image.
        return null;
    }
    if (DOCX_DECODABLE_MIMES.has(blob.type)) {
        return await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob!);
        });
    }
    return await rasterizeToPngDataUri(blob);
};

/**
 * The canvas marks only the URL part of a degraded image clickable (the
 * link-mark pass); the PDF export mirrors that visible distinction: the
 * description stays plain text, only the URL becomes the link.
 */
const linkedUrlFallback = (doc: Document, label: string, url: string): Node => {
    const anchor = (content: string): HTMLAnchorElement => {
        const anchor = doc.createElement("a");
        anchor.setAttribute("href", url);
        anchor.textContent = content;
        return anchor;
    };
    const text = describeLinkText(label, url);
    if (text === url) return anchor(url);
    if (text === `${label} (${url})`) {
        const fragment = doc.createDocumentFragment();
        fragment.append(doc.createTextNode(`${label} (`), anchor(url), doc.createTextNode(")"));
        return fragment;
    }
    return anchor(text); // the label contains the URL atypically: keep it all clickable
};

/**
 * Approved and allowlisted images become real <img> elements with data URIs
 * where the converters render images (PDF and DOCX; Excel keeps the
 * "alt (url)" text since spreadsheet cells have no inline-image
 * semantics); everywhere a fetched image cannot appear the image degrades
 * to its "alt (url)" text — as a real link when the URL is clickable under
 * the link policy (PDF: only the URL is the link, like the canvas's
 * plain-text link view; DOCX: the whole text). The editor serializes image
 * nodes as spans with data attributes (never a fetchable src, issue #228);
 * stray img elements are handled the same way.
 */
export const inlineApprovedImages = async (html: string, target: ExportTarget, allowedDomains: readonly string[]): Promise<string> => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nodes = [...doc.querySelectorAll<HTMLElement>("span[data-canvas-image-src], img")];
    for (const node of nodes) {
        const src = node.getAttribute("data-canvas-image-src") ?? node.getAttribute("src") ?? "";
        const alt = node.getAttribute("data-canvas-image-alt") ?? node.getAttribute("alt") ?? "";
        const classified = classifyImageUrl(src, allowedDomains);
        if (target !== "xlsx" && isAllowlistedHost(src, allowedDomains)) {
            // Keep the URL form: the server fetches allowlisted-host images itself.
            continue;
        }
        const wantsImage = target !== "xlsx" && isEmbeddableImageUrl(src, allowedDomains);
        const dataUri = wantsImage ? await toDataUri(src) : null;
        if (dataUri) {
            const image = doc.createElement("img");
            image.setAttribute("src", dataUri);
            image.setAttribute("alt", alt);
            node.replaceWith(image);
        } else {
            if (wantsImage) {
                console.warn("Image export: could not inline", src, "(fetch, decode or rasterization failed)");
            }
            const text = describeLinkText(alt, classified.url);
            if (!text) {
                node.remove();
            } else if (node.closest("a") || classified.kind === "blocked") {
                // Inside an anchor the text is already clickable; blocked
                // destinations must not become links (same policy as the chat
                // placeholder).
                node.replaceWith(doc.createTextNode(text));
            } else if (target === "pdf") {
                node.replaceWith(linkedUrlFallback(doc, alt.trim(), classified.url));
            } else {
                // The canvas renders the fallback URL clickable (link-mark
                // pass); exports keep that so the degraded image stays a real,
                // styled link instead of text a PDF viewer merely linkifies.
                const anchor = doc.createElement("a");
                anchor.setAttribute("href", classified.url);
                anchor.textContent = text;
                node.replaceWith(anchor);
            }
        }
    }
    // Same sanitization profile as the versions preview: raw HTML outside the
    // editor's ingestion whitelist cannot reach the converters; links and the
    // canvas image spans must survive, so their attributes are added back.
    return DOMPurify.sanitize(doc.body.innerHTML, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ["data-canvas-image-src", "data-canvas-image-alt"]
    });
};
