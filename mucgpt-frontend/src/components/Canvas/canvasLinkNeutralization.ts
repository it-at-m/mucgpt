import { classifyImageUrl, classifyUrl, describeLinkText, stripScheme } from "../MarkdownRenderer/markdownLinkPolicy";

/**
 * Canvas ingestion neutralization (issue #228): pasted rich text must not
 * carry live link/image markup into the document text; the link-mark pass
 * then re-creates marks for URLs that the policy allows. The flattened text
 * carries the policy URL (allowlisted host: full URL, otherwise sanitized)
 * so the displayed URL matches the later link mark. Blocked destinations
 * stay in their raw form, like in the chat policy. Stored revision JSON link
 * marks are re-classified by withPolicyLinkMarks in canvasLinkPolicy.ts.
 */

/**
 * Replace every image representation in HTML with its "alt (url)" text at
 * the same position, using the policy URL (blocked destinations keep their
 * raw form, like in the chat policy). Handles the editor's non-fetching
 * span serialization and stray img elements. Used for paste flattening and
 * for the versions-drawer preview, which must fetch nothing.
 */
export const flattenImagesToText = (html: string, allowedDomains: readonly string[]): string => {
    if (!/data-canvas-image-src/i.test(html) && !/<img[\s>]/i.test(html)) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll<HTMLElement>("span[data-canvas-image-src], img").forEach(image => {
        const src = image.getAttribute("data-canvas-image-src") ?? image.getAttribute("src") ?? "";
        const alt = image.getAttribute("data-canvas-image-alt") ?? image.getAttribute("alt") ?? "";
        const text = describeLinkText(alt, classifyImageUrl(src, allowedDomains).url);
        if (text) image.replaceWith(doc.createTextNode(text));
        else image.remove();
    });
    return doc.body.innerHTML;
};

/**
 * Paste-ready image markup: sanitize each img destination via the policy;
 * sanitized/allowed images survive as clean <img src alt> elements that the
 * editor parses into approval-gated image nodes (parse DOM is detached, the
 * node view fetches nothing without approval); blocked destinations degrade
 * to their "alt (src)" text.
 */
const pasteReadyImages = (html: string, allowedDomains: readonly string[]): string => {
    if (!/<img[\s>]/i.test(html)) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("img").forEach(image => {
        const { kind, url } = classifyImageUrl(image.getAttribute("src") ?? "", allowedDomains);
        if (kind === "blocked") {
            if (!url) {
                image.remove();
                return;
            }
            image.replaceWith(doc.createTextNode(describeLinkText(image.getAttribute("alt") ?? "", url)));
            return;
        }
        image.setAttribute("src", url);
        image.setAttribute("alt", image.getAttribute("alt") ?? "");
        ["srcset", "sizes", "loading", "width", "height", "style", "class", "id"].forEach(attribute => image.removeAttribute(attribute));
    });
    return doc.body.innerHTML;
};

/** URL path image extensions recognized when pasting a bare image URL. */
const IMAGE_PATH_EXTENSIONS = /(?:png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;
const BARE_URL_RE = /^(https?:\/\/\S+)$/i;
const IMAGE_MARKDOWN_RE = /^!\[[^\]\n]*\]\([^()\s]+\)$/i;

/**
 * Markdown for a pasted image reference, or null when the pasted text is no
 * single-line image URL/image markdown. Detection is shape-only: the URL
 * path must end in an image extension — nothing is fetched to identify the
 * target (that would leak the address before any approval).
 */
export const imagePasteMarkdown = (text: string, allowedDomains: readonly string[]): string | null => {
    const trimmed = text.trim();
    if (trimmed.includes("\n")) return null;
    if (IMAGE_MARKDOWN_RE.test(trimmed)) {
        const markdown = prepareMarkdownDestination(trimmed, allowedDomains);
        return markdown ?? null;
    }
    const bare = trimmed.match(BARE_URL_RE);
    if (!bare) return null;
    const { kind, url } = classifyUrl(bare[1], allowedDomains);
    const pathPortion = url.split(/[?#]/)[0];
    if (!pathPortion.match(IMAGE_PATH_EXTENSIONS)) return null;
    if (kind === "blocked") return null;
    const file = pathPortion.split("/").pop() ?? "";
    let label = file;
    try {
        label = decodeURIComponent(file);
    } catch {
        // keep the raw basename for malformed sequences
    }
    return `![${label}](<${url}>)`;
};

const prepareMarkdownDestination = (markdown: string, allowedDomains: readonly string[]): string | null => {
    const match = markdown.match(/^!\[([^\]\n]*)\]\(([^()\s]+)\)$/i);
    if (!match) return null;
    const { kind, url } = classifyImageUrl(match[2], allowedDomains);
    if (kind === "blocked") return null;
    return `![${match[1]}](<${url}>)`;
};

/**
 * Flatten clipboard HTML before TipTap parses it: anchors become the text
 * "description (url)" (or just the text when there is no href) — the
 * link-mark pass re-creates marks for URLs the policy allows; pasted images
 * become approval-gated image nodes with sanitized destinations.
 */
export const flattenPastedLinks = (html: string, allowedDomains: readonly string[]): string => {
    const withPasteableImages = pasteReadyImages(html, allowedDomains);
    if (!/<a[\s>]/i.test(withPasteableImages)) return withPasteableImages;
    const doc = new DOMParser().parseFromString(withPasteableImages, "text/html");
    doc.querySelectorAll("a").forEach(anchor => {
        const label = anchor.textContent ?? "";
        const url = classifyUrl(anchor.getAttribute("href") ?? "", allowedDomains).url;
        const text = label.includes(url) || stripScheme(label) === stripScheme(url) ? url || label : describeLinkText(label, url);
        anchor.replaceWith(doc.createTextNode(text));
    });
    return doc.body.innerHTML;
};
