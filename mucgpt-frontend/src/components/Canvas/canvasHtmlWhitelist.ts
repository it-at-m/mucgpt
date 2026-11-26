/**
 * Canvas HTML whitelist sanitizer.
 *
 * The canvas document is GFM markdown that additionally allows a small,
 * deployment-configured set of raw HTML tags (canvas_allowed_html_tags, e.g.
 * <u> for underline, which GFM cannot express). The markdown parser runs with
 * html: true so whitelisted tags can become real marks in the editor schema —
 * therefore every other raw HTML tag must be escaped to literal text before
 * the markdown reaches the editor, and tags may not carry attributes.
 *
 * The sanitizer also keeps the store/restore cycle idempotent: with html: true,
 * a literal "<b>" typed as text would otherwise serialize back to raw markup
 * and turn into formatting on the next load — escaping re-normalizes it.
 *
 * Code spans and fenced code blocks are preserved verbatim (escaping inside
 * them would be double-escaped by the markdown renderer); within indented code
 * blocks escaped tags render double-escaped — an accepted edge case, fenced
 * blocks are the norm for canvas code.
 *
 * Extension point: CANVAS_SUPPORTED_HTML_TAGS is the registry of tags this
 * frontend release's editor schema understands. The deployment config may only
 * restrict it to a subset — a tag the schema does not know cannot be rendered,
 * serialized, or exported. Adding a tag therefore means: mark extension here
 * (schema + parseHTML/renderHTML), registry entry, docx converter mapping.
 */

/**
 * Raw HTML tags supported by this release's canvas editor schema
 * (mirrors SUPPORTED_CANVAS_HTML_TAGS in mucgpt-core-service settings.py).
 */
export const CANVAS_SUPPORTED_HTML_TAGS: readonly string[] = ["u"];

const HTML_TAG_PATTERN = /<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^<>]*)?\/?>/g;
const INLINE_CODE_SPAN_PATTERN = /(`+)[\s\S]*?\1/g;
/** Line-start fences per CommonMark: up to three leading spaces. */
const FENCE_OPEN_PATTERN = /^ {0,3}(`{3,}|~{3,})/;

interface Range {
    start: number;
    end: number;
}

/** A closing fence repeats the opening fence character at least `fence.length`
 * times after up to three leading spaces: backtick fences must have no
 * backtick in the rest, tilde fences only whitespace. */
const isClosingFence = (line: string, fence: string): boolean => {
    const indent = line.slice(0, line.length - line.trimStart().length);
    if (!/^ {0,3}$/.test(indent)) return false;
    if (!line.startsWith(indent + fence)) return false;
    let end = indent.length + fence.length;
    while (line[end] === fence[0]) end++;
    const rest = line.slice(end);
    return fence[0] === "~" ? /^\s*$/.test(rest) : !rest.includes("`");
};

/** Fenced code block ranges (unterminated fences run to the end). */
const collectFenceRanges = (text: string): Range[] => {
    const ranges: Range[] = [];
    const lines = text.split("\n");
    let offset = 0;
    let index = 0;
    while (index < lines.length) {
        const opening = lines[index].match(FENCE_OPEN_PATTERN);
        if (opening === null) {
            offset += lines[index].length + 1;
            index++;
            continue;
        }
        const fence = opening[1];
        let endLine = lines.length - 1;
        for (let scan = index + 1; scan < lines.length; scan++) {
            if (isClosingFence(lines[scan], fence)) {
                endLine = scan;
                break;
            }
        }
        const start = offset;
        const end = Math.min(offset + lines.slice(index, endLine + 1).reduce((sum, line) => sum + line.length + 1, 0), text.length);
        ranges.push({ start, end });
        offset = end;
        index = endLine + 1;
    }
    return ranges;
};

/**
 * Ranges that downstream markdown passes must keep verbatim: fenced code
 * blocks plus inline code spans. Shared so every pre-parse pass (HTML
 * escaping, link neutralization) sees the same code boundaries.
 */
export function collectVerbatimRanges(text: string): Range[] {
    if (text.length === 0) return [];
    const fenceRanges = collectFenceRanges(text);

    const codeSpanRanges: Range[] = [];
    let cursor = 0;
    const freeSegments: Range[] = [];
    for (const range of fenceRanges) {
        if (cursor < range.start) freeSegments.push({ start: cursor, end: range.start });
        cursor = Math.max(cursor, range.end);
    }
    if (cursor < text.length) freeSegments.push({ start: cursor, end: text.length });
    for (const segment of freeSegments) {
        const segmentText = text.slice(segment.start, segment.end);
        for (const match of segmentText.matchAll(INLINE_CODE_SPAN_PATTERN)) {
            const matchStart = segment.start + (match.index ?? 0);
            codeSpanRanges.push({ start: matchStart, end: matchStart + match[0].length });
        }
    }
    return [...fenceRanges, ...codeSpanRanges].sort((left, right) => left.start - right.start);
}

/** Escapes every raw HTML tag that is not an attribute-free whitelisted tag. */
const escapeDisallowedTags = (text: string, allowedNames: ReadonlySet<string>): string =>
    text.replace(HTML_TAG_PATTERN, (match, name: string, attributes?: string) =>
        attributes === undefined && allowedNames.has(name.toLowerCase()) ? match : match.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    );

/**
 * Escapes raw HTML tags outside the given allowlist to literal text
 * (`&lt;…&gt;`). `allowedTags` are plain lowercase tag names (e.g. ["u"]).
 */
export function sanitizeCanvasMarkdown(markdown: string, allowedTags: readonly string[]): string {
    if (!markdown) return markdown;
    const allowedNames = new Set(allowedTags.map(tag => tag.toLowerCase()));
    const verbatimRanges = collectVerbatimRanges(markdown);

    const output: string[] = [];
    let position = 0;
    for (const range of verbatimRanges) {
        if (position > range.start) continue; // already covered (code span inside a fence)
        if (position < range.start) {
            output.push(escapeDisallowedTags(markdown.slice(position, range.start), allowedNames));
        }
        output.push(markdown.slice(range.start, range.end));
        position = range.end;
    }
    if (position < markdown.length) {
        output.push(escapeDisallowedTags(markdown.slice(position), allowedNames));
    }
    return output.join("");
}

/**
 * Config may only restrict: an entry the editor schema does not understand
 * cannot be rendered, serialized or exported, so it is dropped from the
 * effective sanitizer list (mirrors the transcription unknown-model warning).
 */
export function effectiveAllowedTags(configuredTags: readonly string[] | undefined): readonly string[] {
    const configured = configuredTags ?? CANVAS_SUPPORTED_HTML_TAGS;
    const unknown = configured.filter(tag => !CANVAS_SUPPORTED_HTML_TAGS.includes(tag.toLowerCase()));
    if (unknown.length) {
        console.warn(
            `canvas_allowed_html_tags: ${unknown.map(tag => `<${tag}>`).join(", ")} not supported by this frontend release; ignored. Supported: ${CANVAS_SUPPORTED_HTML_TAGS.map(tag => `<${tag}>`).join(", ")}. Core and frontend are updated in sync.`
        );
    }
    const effectiveLowercase = configured.filter(tag => CANVAS_SUPPORTED_HTML_TAGS.includes(tag.toLowerCase())).map(tag => tag.toLowerCase());
    return [...new Set(effectiveLowercase)];
}
