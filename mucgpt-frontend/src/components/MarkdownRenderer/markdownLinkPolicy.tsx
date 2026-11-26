import { isValidElement, type ReactNode } from "react";
import { Button } from "@fluentui/react-components";
import type { Components } from "react-markdown";
import { useTranslation } from "react-i18next";
import { collectVerbatimRanges } from "../Canvas/canvasHtmlWhitelist";
import { useConfigContext } from "../../context/ConfigContext";
import { getApprovedImageUrls, useImageApprovals } from "./imageApprovals";
import { isAllowedForSession, requestExternalLink } from "./externalLinkGuard";
import styles from "./MarkdownRenderer.module.css";

/**
 * Markdown link/image policy (issue #228: markdown injection).
 *
 * Links and images in LLM output, tool output, document content or shared
 * assistant metadata can exfiltrate conversation data. The policy:
 * - links on a configured allowlist domain (exact host, no port/userinfo,
 *   from `GET /config`) render clickable as `desc (url)` with the full URL;
 * - every other link stays clickable in the same format but loses its query
 *   string, fragment and userinfo — the covert channels in a URL;
 * - images from allowlist domains load automatically; all other images render
 *   as a `desc (url)` placeholder with an approval button, and are fetched
 *   only after the user has seen and approved the URL;
 * - non-http(s)/mailto URLs (javascript:, data:, relative paths, …) render as
 *   non-clickable text.
 */
interface SafeLinkProps {
    href?: string;
    children?: ReactNode;
}

interface SafeImageProps {
    alt?: string;
    src?: string;
    title?: string;
}

const flattenText = (node: ReactNode): string => {
    if (node === null || node === undefined || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(flattenText).join("");
    if (isValidElement(node)) return flattenText((node.props as { children?: ReactNode }).children);
    return "";
};

/** A URL without its optional scheme prefix and trailing slash, for autolink comparison. */
export const stripScheme = (url: string): string =>
    url
        .trim()
        .replace(/^(?:https?:\/\/|mailto:)/i, "")
        .replace(/\/$/, "");

/**
 * Visible text for a neutralized link or image: the label plus the URL in
 * parentheses, unless one of them is empty or the label already contains the
 * URL.
 */
export const describeLinkText = (label: string, url: string): string => {
    const text = label.trim();
    const target = url.trim();
    if (!target) return text;
    if (!text) return target;
    return text.includes(target) ? text : `${text} (${target})`;
};

export type UrlPolicyKind = "allowed" | "sanitized" | "blocked";

/**
 * True when the link text already shows the URL (or its scheme-less form),
 * so appending the parenthesized URL would duplicate it.
 */
export const linkTextRedundant = (text: string, url: string): boolean => text.includes(url) || stripScheme(text) === stripScheme(url);

export interface ClassifiedUrl {
    kind: UrlPolicyKind;
    url: string;
}

/**
 * Classify a URL destination. Allowlisted exact hosts (web schemes, no port,
 * no userinfo) keep the full URL; everything clickable is stripped of query
 * string, fragment and userinfo; anything unparseable or outside
 * `schemes` is blocked.
 */
const classifyBySchemes = (raw: string, allowedDomains: readonly string[], schemes: readonly string[]): ClassifiedUrl => {
    const candidate = raw.trim();
    let parsed: URL;
    try {
        parsed = new URL(candidate);
    } catch {
        return { kind: "blocked", url: candidate };
    }
    if (!schemes.includes(parsed.protocol)) return { kind: "blocked", url: candidate };
    const isWeb = parsed.protocol === "https:" || parsed.protocol === "http:";
    const hostAllowed = isWeb && parsed.username === "" && parsed.password === "" && parsed.port === "" && allowedDomains.includes(parsed.hostname);
    if (hostAllowed) return { kind: "allowed", url: candidate };
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return { kind: "sanitized", url: parsed.href };
};

const CLICKABLE_SCHEMES = ["https:", "http:", "mailto:"];

/**
 * Classify a link destination. Allowlisted exact hosts keep the full URL;
 * everything else is stripped of query string, fragment and userinfo and
 * stays clickable; unparseable or non-web/mailto destinations are blocked.
 */
export const classifyUrl = (raw: string, allowedDomains: readonly string[]): ClassifiedUrl => classifyBySchemes(raw, allowedDomains, CLICKABLE_SCHEMES);

/**
 * Classify an image source: only http(s) URLs can ever load, allowlisted
 * hosts automatically, everything else through the approval flow on the
 * sanitized URL.
 */
export const classifyImageUrl = (raw: string, allowedDomains: readonly string[]): ClassifiedUrl => classifyBySchemes(raw, allowedDomains, ["https:", "http:"]);

/**
 * Embeddable outside the render policy (export inlining): allowlisted host
 * or explicitly approved for the conversation.
 */
export const isEmbeddableImageUrl = (url: string, allowedDomains: readonly string[]): boolean =>
    classifyImageUrl(url, allowedDomains).kind === "allowed" || getApprovedImageUrls().includes(url);

/**
 * Click target for rendered links. Autolink literals invent a scheme for
 * bare hosts (www.muenchen.de -> http://www.muenchen.de); an allowlisted
 * bare host is a trusted TLS endpoint, so the invented scheme is upgraded
 * there, never for paths or foreign hosts (allowlisted http-only services
 * with a path must keep working).
 */
export const anchorHrefOf = (kind: UrlPolicyKind, url: string): string =>
    kind === "allowed" && /^http:\/\/[^/?#]+$/.test(url) ? "https://" + url.slice("http://".length) : url;

export const SafeMarkdownLink = ({ href, children }: SafeLinkProps) => {
    const { allowed_link_domains: allowedDomains } = useConfigContext();
    const raw = (href ?? "").trim();
    if (!raw) return <>{children}</>;
    const { kind, url: classifiedUrl } = classifyUrl(raw, allowedDomains);
    const url = anchorHrefOf(kind, classifiedUrl);
    const text = flattenText(children);
    // Non-whitelisted links confirm with the user before the browser leaves
    // the app (click and middle-click; the dialog store decides per session).
    const guardedActivation = (event: { preventDefault(): void }) => {
        if (kind === "sanitized" && !isAllowedForSession(url)) {
            event.preventDefault();
            requestExternalLink(url);
        }
    };
    if (kind === "blocked") {
        return text.includes(raw) ? (
            <>{children}</>
        ) : (
            <>
                {children}
                <span className={styles.linkUrl}> ({raw})</span>
            </>
        );
    }
    if (linkTextRedundant(text, url) || text.includes(raw)) {
        return (
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={guardedActivation} onAuxClick={guardedActivation}>
                {children}
            </a>
        );
    }
    return (
        <>
            {children}
            <span className={styles.linkUrl}>
                {" "}
                (
                <a href={url} target="_blank" rel="noopener noreferrer" onClick={guardedActivation} onAuxClick={guardedActivation}>
                    {url}
                </a>
                )
            </span>
        </>
    );
};

/**
 * The image ask: the sanitized URL is visible as text; "show" fetches and
 * renders it, "don't show" leaves only the muted text for this session.
 */
const ImageApprovalPlaceholder = ({ label, url }: { label: string; url: string }) => {
    const { t } = useTranslation();
    const approvals = useImageApprovals();
    if (approvals.isRejected(url)) {
        const text = describeLinkText(label, url);
        return <span className={styles.linkUrl}>{text}</span>;
    }
    return (
        <span className={styles.imagePlaceholder} role="group">
            <span className={styles.linkUrl}>{describeLinkText(label, url)}</span>
            <Button size="small" appearance="primary" onClick={() => approvals.approve(url)}>
                {t("chat.image_show")}
            </Button>
            <Button size="small" onClick={() => approvals.reject(url)}>
                {t("chat.image_hide")}
            </Button>
        </span>
    );
};

/**
 * The image policy view: allowlisted or approved URLs render as <img>,
 * everything else as a placeholder whose URL is never fetched without an
 * explicit approval. Shared by chat answers and the canvas image node view.
 */
export const PolicyImage = ({ src, alt }: { src: string; alt: string }) => {
    const { allowed_link_domains: allowedDomains } = useConfigContext();
    const approvals = useImageApprovals();
    const raw = src.trim();
    if (!raw) return null;
    const { kind, url } = classifyImageUrl(raw, allowedDomains);
    if (kind === "blocked") {
        const text = describeLinkText(alt, raw);
        return text ? <span className={styles.linkUrl}>{text}</span> : null;
    }
    if (kind === "allowed" || approvals.isApproved(url)) {
        return <img src={url} alt={alt || url} className={styles.markdownImage} loading="lazy" />;
    }
    return <ImageApprovalPlaceholder label={alt} url={url} />;
};

export const SafeMarkdownImage = ({ alt, src, title }: SafeImageProps) => <PolicyImage src={src ?? ""} alt={(alt ?? "").trim() || (title ?? "").trim()} />;

export const safeMarkdownComponents: Components = {
    a: SafeMarkdownLink,
    img: SafeMarkdownImage
};

/** Merge the safe link/image policy with local component overrides. */
export const withSafeMarkdownLinks = (components: Components = {}): Components => ({
    ...safeMarkdownComponents,
    ...components
});

const transformOutsideVerbatim = (markdown: string, transform: (part: string) => string): string => {
    let output = "";
    let position = 0;
    for (const range of collectVerbatimRanges(markdown)) {
        if (position > range.start) continue; // already covered (code span inside a fence)
        if (position < range.start) output += transform(markdown.slice(position, range.start));
        output += markdown.slice(range.start, range.end);
        position = range.end;
    }
    output += transform(markdown.slice(position));
    return output;
};

// Inline destinations: the label uses a deterministic one-level-bracket-balanced
// pattern (linear scan, no backtracking blowup). Labels can legitimately
// contain nested link markup (e.g. `[see [b](c) d](url)`), so the passes
// below finish with an adjacency break instead of relying on the label
// shape; the destination is angle-wrapped (`<url with spaces>`) or one
// paren-balanced level, optionally followed by a quoted/parenthesized title.
const LABEL_PATTERN = "((?:[^\\[\\]]|\\[[^\\[\\]]*\\])*)";
const DESTINATION_PATTERN = "((?:<[^>]*>|(?:[^()\\s]|\\([^()]*\\))+))";
const TITLE_PATTERN = "[ \\t]*(?:\"[^\"]*\"|'[^']*'|\\([^()]*\\))?[ \\t]*";
export const INLINE_IMAGE_RE = new RegExp(`!\\[${LABEL_PATTERN}\\]\\([ \\t]*${DESTINATION_PATTERN}${TITLE_PATTERN}\\)`, "g");
export const INLINE_LINK_RE = new RegExp(`\\[${LABEL_PATTERN}\\]\\([ \\t]*${DESTINATION_PATTERN}${TITLE_PATTERN}\\)`, "g");

/** Anchored single-image shape (paste detection); same grammar as INLINE_IMAGE_RE. */
export const INLINE_IMAGE_SHAPE_RE = new RegExp(`^!\\[${LABEL_PATTERN}\\]\\([ \\t]*${DESTINATION_PATTERN}${TITLE_PATTERN}\\)$`, "i");

/** Autolinks `<scheme:rest>`; the scheme list mirrors GFM's understood schemes. */
export const AUTOLINK_RE = /<((?:https?|mailto|xmpp):[^>\s]+)>/g;

// `[desc](url "title")` — an angle-wrapped destination keeps its inner value as-is.
export const destinationOf = (destination: string): string => {
    const trimmed = destination.trim();
    const wrapped = trimmed.match(/^<([^>]*)>$/);
    return wrapped ? wrapped[1] : trimmed;
};

interface FlattenOptions {
    /** Escape `<`/`>` in the output so element-like fragments cannot appear (plain-text display contexts). */
    escapeHtml?: boolean;
    /** Keep destinations as `label (url)` text; false keeps labels only (compact node labels). */
    keepDestinations?: boolean;
}

// Link definitions `[ref]: url` — the destination must look like a URL (scheme,
// leading `/`, relative `./` or `../`, or `<…>`-wrapped) so plain texts like
// `[Policy]: Never …` stay untouched. Footnote definitions (`[^1]: …`) are excluded.
const DEFINITION_RE =
    /^ {0,3}\[([^^][^\]]*)\]:[ \t]*(<[^\s>]*>|\/\S*|\.{1,2}\/\S*|[a-z][a-z0-9+.-]*:(?:\/\/)?\S+)[^\S\n]*(?:"[^"]*"|'[^']*'|\([^)]*\))?[^\S\n]*$\n?/gim;

const referenceKey = (label: string): string => label.trim().toLowerCase();

const flattenPart = (part: string, definitions: Map<string, string>, options: Required<FlattenOptions>): string => {
    let text = part;
    // Definition lines go first: their destinations must not turn into
    // resolved shortcut references below
    text = text.replace(DEFINITION_RE, "");
    const withDestination = (label: string, url: string): string => (options.keepDestinations ? describeLinkText(label, url) : label);
    const resolveReference = (label: string, ref: string): string => {
        const url = definitions.get(referenceKey(ref || label));
        return url ? withDestination(label, url) : label;
    };
    // Reference-style images ![alt][ref] and collapsed references [desc][]
    text = text.replace(/!\[([^\]]*)\]\[([^\]]*)\]/g, (_match, alt: string, ref: string) => resolveReference(alt, ref));
    // Reference links [desc][ref], collapsed [desc][]
    text = text.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (_match, desc: string, ref: string) => resolveReference(desc, ref));
    // Shortcut references ![label] / [label] resolve only when a definition
    // exists; without one CommonMark renders them literally as well
    text = text.replace(/(!?)\[([^^\]\n]+)\](?!\[|\()/g, (match, _bang: string, label: string) => {
        const url = definitions.get(referenceKey(label));
        if (!url) return match;
        return withDestination(label, url);
    });
    // Images ![alt](url) before links, so [![alt](src)](url) keeps its shape
    text = text.replace(INLINE_IMAGE_RE, (_match, alt: string, url: string) => withDestination(alt, destinationOf(url)));
    // Inline links [desc](url)
    text = text.replace(INLINE_LINK_RE, (_match, desc: string, url: string) => withDestination(desc, destinationOf(url)));
    // Autolinks <https://example.com>
    text = text.replace(AUTOLINK_RE, "$1");
    // No `](` adjacency may survive conversion: labels can legitimately
    // contain nested link syntax, whose leftovers must not re-form links.
    text = text.replace(/\]\(/g, "] ");
    if (options.escapeHtml) {
        // the output is display text: escape remaining `<` so element-like
        // fragments (e.g. unterminated `<script`) cannot ever appear
        text = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    return text;
};

const splitAtVerbatimRanges = (markdown: string): string[] => {
    const parts: string[] = [];
    let position = 0;
    for (const range of collectVerbatimRanges(markdown)) {
        if (position > range.start) continue; // already covered (code span inside a fence)
        if (position < range.start) parts.push(markdown.slice(position, range.start));
        position = range.end;
    }
    if (position < markdown.length) parts.push(markdown.slice(position));
    return parts;
};

/**
 * One implementation behind both flattening entry points: definitions are
 * collected once across all non-code ranges (a code span between a reference
 * and its definition must not hide the definition), then every link/image
 * form is broken down outside fenced and inline code.
 */
const flattenMarkdownLinks = (markdown: string, options: Required<FlattenOptions>): string => {
    const definitions = new Map<string, string>();
    for (const part of splitAtVerbatimRanges(markdown)) {
        for (const match of part.matchAll(DEFINITION_RE)) {
            const key = referenceKey(match[1]);
            if (!definitions.has(key)) definitions.set(key, match[2]);
        }
    }
    return transformOutsideVerbatim(markdown, part => flattenPart(part, definitions, options));
};

/**
 * Neutralize markdown link/image syntax to labels only (e.g. before rendering
 * a mindmap): destinations and definitions vanish, `<`/`>` are escaped.
 */
export const stripMarkdownLinks = (markdown: string): string => flattenMarkdownLinks(markdown, { escapeHtml: true, keepDestinations: false });

/**
 * Break markdown links and images down to their visible plain-text form
 * ("description (url)"). Used in the canvas ingestion pipeline, where
 * prepareCanvasMarkdown protects policy-compliant image syntax from this
 * conversion; the link-mark pass afterwards decides which "(url)" parts
 * become clickable.
 */
export const markdownLinksToPlainText = (markdown: string): string => flattenMarkdownLinks(markdown, { escapeHtml: false, keepDestinations: true });
