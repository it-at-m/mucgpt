import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

import {
    AUTOLINK_RE,
    INLINE_IMAGE_RE,
    INLINE_LINK_RE,
    anchorHrefOf,
    classifyImageUrl,
    classifyUrl,
    describeLinkText,
    destinationOf,
    markdownLinksToPlainText
} from "../MarkdownRenderer/markdownLinkPolicy";
import { isAllowedForSession, requestExternalLink } from "../MarkdownRenderer/externalLinkGuard";

/**
 * Canvas link/image policy (issue #228): agent-written markdown keeps its
 * `desc (url)` text form, and the link-mark pass below decides per URL
 * whether the `(url)` part becomes a clickable link (allowlisted host:
 * full URL; otherwise: query string, fragment and userinfo stripped).
 * Images become approval-gated nodes (canvasImage.tsx); their ingestion
 * runs through prepareCanvasMarkdown first.
 */

/**
 * Markdown entering the editor: link and image destinations are rewritten to
 * their policy URL (allowlisted host: unchanged; otherwise the URL without
 * query string, fragment and userinfo), so the visible "desc (url)" text and
 * the later link mark carry the sanitized URL; blocked destinations keep
 * their raw form as text. Valid image destinations become image markdown for
 * the parser; blocked images degrade to their alt text.
 */
export const prepareCanvasMarkdown = (markdown: string, allowedDomains: readonly string[]): string => {
    const policyUrl = (destination: string): string => {
        const url = destinationOf(destination);
        const { kind, url: safeUrl } = classifyUrl(url, allowedDomains);
        return kind === "blocked" ? url : safeUrl;
    };
    let prepared = markdown.replace(INLINE_LINK_RE, (_match, label: string, destination: string) => `[${label}](${policyUrl(destination)})`);
    prepared = prepared.replace(AUTOLINK_RE, (match, url: string) => {
        const { kind, url: safeUrl } = classifyUrl(url, allowedDomains);
        return kind === "blocked" ? match : `<${safeUrl}>`;
    });
    prepared = prepared.replace(INLINE_IMAGE_RE, (_match, alt: string, destination: string) => {
        const url = destinationOf(destination);
        const { kind, url: safeUrl } = classifyImageUrl(url, allowedDomains);
        return kind === "blocked" ? describeLinkText(alt, url) : `![${alt}](${safeUrl})`;
    });
    const tokens: string[] = [];
    prepared = prepared.replace(/!\[[^\]\n]*\]\([^)\n]+\)/g, match => `\uE000${tokens.push(match) - 1}\uE001`);
    prepared = markdownLinksToPlainText(prepared);
    prepared = prepared.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => tokens[Number(index)] ?? "");
    return prepared;
};

// Bare autolink-literal domains, mirrored from the GFM behavior of the chat:
// a `www.`-prefixed host plus optional path is clickable (the chat invents
// `http:` for it), while other scheme-less text stays plain.
const CLICKABLE_TEXT_RE =
    /\((https?:\/\/[^()\s]+|mailto:[^\s()]+)\)|\b(?:https?:\/\/|mailto:)[^\s<>()[\]]+[^\s<>()[\].,;:!?'"{}]|(?<![\w.:])(?<!\bhttps?:\/\/)\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>()[\]]*[^\s<>()[\].,;:!?'"{}])?/gi;

/**
 * Applies the link policy to a document: text like `(https://host/path)`
 * (the plain-text link view), bare URLs and bare `www.`-autolink domains
 * become a link mark on the URL part; existing marks are re-classified and
 * unsanitized/blocked marks are removed. Idempotent: nothing changes when
 * everything already complies.
 */
const policyTransactions = (state: EditorState, allowedDomains: readonly string[]): Transaction | null => {
    const markType = state.schema.marks.link;
    if (!markType) return null;
    const tr = state.tr;
    state.doc.descendants((node, position) => {
        if (!node.isText) return;
        const text = node.text ?? "";
        for (const mark of node.marks) {
            if (mark.type !== markType) continue;
            const { kind, url } = classifyUrl(String(mark.attrs.href ?? ""), allowedDomains);
            if (kind === "allowed") continue;
            const from = position;
            const to = position + text.length;
            if (kind === "blocked") tr.removeMark(from, to, markType);
            else tr.addMark(from, to, markType.create({ href: url }));
        }
        if (node.marks.some(mark => mark.type.name === "code")) return;
        for (const match of text.matchAll(CLICKABLE_TEXT_RE)) {
            const parenthesized = match[1];
            const bareDomain = parenthesized === undefined && match[0].toLowerCase().startsWith("www.");
            const candidate = parenthesized ?? (bareDomain ? `http://${match[0]}` : match[0]);
            const { kind, url: classifiedUrl } = classifyUrl(candidate, allowedDomains);
            if (kind === "blocked") continue;
            const href = anchorHrefOf(kind, classifiedUrl);
            const start = position + match.index + (parenthesized ? 1 : 0);
            const end = position + match.index + match[0].length - (parenthesized ? 1 : 0);
            tr.addMark(start, end, markType.create({ href }));
        }
    });
    return tr.docChanged ? tr : null;
};

/**
 * DOM click/auxclick guard for the canvas editor: whitelisted and
 * session-allowed links follow their default navigation, every other
 * clickable link asks for confirmation first (externalLinkGuard).
 */
export const interceptLinkClicks = (event: Event, allowedDomains: readonly string[]): boolean => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return false;
    const { kind, url } = classifyUrl(anchor.getAttribute("href") ?? "", allowedDomains);
    if (kind !== "sanitized" || isAllowedForSession(url)) return false;
    event.preventDefault();
    requestExternalLink(url);
    return true;
};

export const canvasLinkMarks = (getAllowedDomains: () => readonly string[]) =>
    Extension.create({
        name: "canvasLinkMarks",
        addProseMirrorPlugins() {
            return [
                new Plugin({
                    key: new PluginKey("canvasLinkMarks"),
                    appendTransaction: (transactions, _oldState, newState) =>
                        transactions.some(transaction => transaction.docChanged) ? policyTransactions(newState, getAllowedDomains()) : null
                })
            ];
        }
    });

/**
 * Sanitize link marks of a ProseMirror document JSON (e.g. a stored
 * revision): allowed hosts keep their full href, everything else gets the
 * sanitized href, blocked destinations lose the mark.
 */
export const withPolicyLinkMarks = (docJson: unknown, allowedDomains: readonly string[]): unknown => {
    if (Array.isArray(docJson)) return docJson.map(node => withPolicyLinkMarks(node, allowedDomains));
    if (docJson === null || typeof docJson !== "object") return docJson;
    const source = docJson as Record<string, unknown>;
    const result: Record<string, unknown> = { ...source };
    if (Array.isArray(source.marks)) {
        result.marks = source.marks.flatMap(mark => {
            const entry = mark as Record<string, unknown> | null;
            if (entry?.type !== "link") return [mark];
            const attrs = (entry.attrs ?? {}) as Record<string, unknown>;
            const { kind, url } = classifyUrl(String(attrs.href ?? ""), allowedDomains);
            if (kind === "blocked") return [];
            if (kind === "allowed") return [mark];
            return [{ ...entry, attrs: { ...attrs, href: url } }];
        });
    }
    if (source.content) result.content = withPolicyLinkMarks(source.content, allowedDomains);
    return result;
};
