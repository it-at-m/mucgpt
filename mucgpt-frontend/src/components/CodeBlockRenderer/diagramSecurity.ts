/**
 * Security helpers for draw.io viewer output.
 * Mermaid keeps its own inline DOMPurify path — do not change Mermaid.tsx for this.
 */

/** Maximum character cap aligned with Mermaid's existing guard. */
export const DIAGRAM_MAX_INPUT_LENGTH = 50000;

const SUSPICIOUS_DIAGRAM_PATTERNS = [/<script/i, /javascript:/i, /data:text\/html/i, /vbscript:/i, /on\w+\s*=/i];

const FORBIDDEN_TAGS = new Set(["script", "object", "embed", "link", "meta", "base", "iframe", "form"]);

/**
 * Size + suspicious-pattern checks for untrusted draw.io source from the model.
 * Same rules Mermaid uses; Mermaid keeps its own inline copy.
 */
export function isSafeDiagramInput(raw: string, label: string): boolean {
    if (raw.length > DIAGRAM_MAX_INPUT_LENGTH) {
        console.warn(`${label} input too large, potential DoS attempt`);
        return false;
    }
    if (SUSPICIOUS_DIAGRAM_PATTERNS.some(pattern => pattern.test(raw))) {
        console.warn(`Potentially malicious content detected in ${label} input`);
        return false;
    }
    return true;
}

/**
 * Remove the mxGraph model-level link attributes from draw.io XML before the
 * viewer loads it: the viewer opens a clicked cell's `link` value directly
 * (getClickableLinkForCell), which anchors-in-the-output stripping cannot reach.
 * Parsed with DOMParser so values containing ` link="…"` text stay intact; the
 * attribute regex only guards unparseable input.
 */
export function stripDrawioCellLinks(xml: string): string {
    const attributeStrip = (value: string): string => value.replace(/\s+(?:link|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*')/g, "");
    try {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        if (doc.querySelector("parsererror")) return attributeStrip(xml);
        for (const element of Array.from(doc.querySelectorAll("*"))) {
            element.removeAttribute("link");
            element.removeAttribute("xlink:href");
        }
        return new XMLSerializer().serializeToString(doc);
    } catch {
        return xml.replace(/\s+(?:link|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*')/g, "");
    }
}

/**
 * Draw.io supports compressed `<diagram>` bodies (base64, inflated by the
 * viewer before parsing); those bypass the model-level link strip above, so
 * only literal XML diagrams may be rendered.
 */
export function hasCompressedDiagram(xml: string): boolean {
    return /<diagram\b[^>]*>\s*[^<\s]/i.test(xml.trim());
}

/**
 * Sanitize draw.io viewer DOM in place.
 *
 * Why not DOMPurify on the whole SVG? draw.io labels with style html=1 live in
 * <foreignObject><div>…</div></foreignObject>. DOMPurify strips that inner HTML,
 * which removes box text. We only remove known-dangerous tags/attrs instead.
 */
export function sanitizeDrawioViewerHost(host: HTMLElement): boolean {
    host.querySelectorAll([...FORBIDDEN_TAGS].join(",")).forEach(node => node.remove());

    // Anchors in draw.io HTML labels must not navigate (issue #228: markdown
    // injection); the link text stays visible.
    host.querySelectorAll("a").forEach(anchor => {
        anchor.removeAttribute("href");
        anchor.removeAttribute("xlink:href");
    });

    host.querySelectorAll("*").forEach(element => {
        for (const attr of Array.from(element.attributes)) {
            const name = attr.name;
            // Browsers ignore C0 controls / space in URL schemes, so
            // `java\nscript:` still executes as javascript: — strip them first.
            // eslint-disable-next-line no-control-regex
            const normalizedValue = attr.value.replace(/[\x00-\x20]/g, "");
            if (/^on/i.test(name) || /javascript:/i.test(normalizedValue) || /data:text\/html/i.test(normalizedValue) || /vbscript:/i.test(normalizedValue)) {
                element.removeAttribute(name);
            }
        }
    });

    return Boolean(host.querySelector("svg"));
}
