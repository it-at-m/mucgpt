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
 * Sanitize draw.io viewer DOM in place.
 *
 * Why not DOMPurify on the whole SVG? draw.io labels with style html=1 live in
 * <foreignObject><div>…</div></foreignObject>. DOMPurify strips that inner HTML,
 * which removes box text. We only remove known-dangerous tags/attrs instead.
 */
export function sanitizeDrawioViewerHost(host: HTMLElement): boolean {
    host.querySelectorAll([...FORBIDDEN_TAGS].join(",")).forEach(node => node.remove());

    host.querySelectorAll("*").forEach(element => {
        for (const attr of Array.from(element.attributes)) {
            const name = attr.name;
            const value = attr.value;
            if (/^on/i.test(name) || /javascript:/i.test(value) || /data:text\/html/i.test(value) || /vbscript:/i.test(value)) {
                element.removeAttribute(name);
            }
        }
    });

    return Boolean(host.querySelector("svg"));
}
