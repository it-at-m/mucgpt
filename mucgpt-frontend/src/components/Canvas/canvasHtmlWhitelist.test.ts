// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANVAS_SUPPORTED_HTML_TAGS, collectVerbatimRanges, effectiveAllowedTags, sanitizeCanvasMarkdown } from "./canvasHtmlWhitelist";

describe("sanitizeCanvasMarkdown", () => {
    it("passes whitelisted bare tags through", () => {
        expect(sanitizeCanvasMarkdown("Hello <u>world</u>", ["u"])).toBe("Hello <u>world</u>");
    });

    it("passes whitelisted tags case-insensitively", () => {
        expect(sanitizeCanvasMarkdown("Hello <U>world</U>", ["u"])).toBe("Hello <U>world</U>");
    });

    it("escapes non-whitelisted tags to literal text", () => {
        expect(sanitizeCanvasMarkdown("Hello <b>world</b>", ["u"])).toBe("Hello &lt;b&gt;world&lt;/b&gt;");
    });

    it("escapes attributes on whitelisted tags; the bare closing tag is droppable markup", () => {
        expect(sanitizeCanvasMarkdown('Hello <u onclick="steal()">world</u>', ["u"])).toBe('Hello &lt;u onclick="steal()"&gt;world</u>');
    });

    it("escapes everything when the allowlist is empty", () => {
        expect(sanitizeCanvasMarkdown("Hello <u>world</u>", [])).toBe("Hello &lt;u&gt;world&lt;/u&gt;");
    });

    it("preserves code span content verbatim (the renderer escapes it)", () => {
        expect(sanitizeCanvasMarkdown("<u>a</u> und `<u>b</u>`", ["u"])).toBe("<u>a</u> und `<u>b</u>`");
    });

    it("identifies longer runs of the same fence character as closing fences", () => {
        const text = "```\n<unescaped>\n`````\n```\n<b>verbatim</b>\n```\nund <b>escaped</b>";
        expect(sanitizeCanvasMarkdown(text, [])).toBe("```\n<unescaped>\n`````\n```\n<b>verbatim</b>\n```\nund &lt;b&gt;escaped&lt;/b&gt;");
    });

    it("does not close fences on tab- or 4-space-indented lines", () => {
        const text = "```\n<unescaped>\n\t```\n```\n<b>after close</b>";
        expect(sanitizeCanvasMarkdown(text, [])).toBe("```\n<unescaped>\n\t```\n```\n&lt;b&gt;after close&lt;/b&gt;");
        const indentedClose = "```\n<unescaped>\n    ```\n```\n<u>b</u>";
        expect(sanitizeCanvasMarkdown(indentedClose, ["u"])).toBe(indentedClose);
    });

    it("preserves code fences verbatim", () => {
        const markdown = "```text\n<div>not html</div>\n```\n\n<u>real</u>";
        expect(sanitizeCanvasMarkdown(markdown, ["u"])).toBe(markdown);
    });

    it("preserves unterminated code fences up to the end", () => {
        const markdown = "Text\n\n~~~\n<div>not html</div>";
        expect(sanitizeCanvasMarkdown(markdown, ["u"])).toBe(markdown);
    });

    it("escapes tags before and after fenced blocks", () => {
        expect(sanitizeCanvasMarkdown('<b>a</b>\n\n```js\nconst s = "<b>";\n```\n\n<b>c</b>', ["u"])).toBe(
            '&lt;b&gt;a&lt;/b&gt;\n\n```js\nconst s = "<b>";\n```\n\n&lt;b&gt;c&lt;/b&gt;'
        );
    });

    it("does not escape lone angle brackets or comparisons", () => {
        expect(sanitizeCanvasMarkdown("a < b und c > d", ["u"])).toBe("a < b und c > d");
    });

    it("is idempotent", () => {
        const input = "Ein <u>Text</u> mit <b>HTML</b> und ```text\n<div>block</div>\n```\n\n Ende.";
        const once = sanitizeCanvasMarkdown(input, ["u"]);
        expect(sanitizeCanvasMarkdown(once, ["u"])).toBe(once);
    });

    it("is idempotent for text that already round-tripped through the editor", () => {
        const input = 'Hello &lt;u onclick="steal()"&gt;world</u>';
        const once = sanitizeCanvasMarkdown(input, ["u"]);
        expect(sanitizeCanvasMarkdown(once, ["u"])).toBe(once);
    });

    it("keeps already-escaped entities untouched", () => {
        const input = "Hello &lt;b&gt;world";
        expect(sanitizeCanvasMarkdown(input, ["u"])).toBe(input);
    });

    it("handles empty markdown", () => {
        expect(sanitizeCanvasMarkdown("", ["u"])).toBe("");
    });
});

describe("effectiveAllowedTags", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("keeps supported entries and normalizes case", () => {
        expect(effectiveAllowedTags(["u", "U"])).toEqual(CANVAS_SUPPORTED_HTML_TAGS);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("drops entries unknown to this release and warns once per call", () => {
        expect(effectiveAllowedTags(["u", "mark"])).toEqual(["u"]);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain("<mark>");
    });

    it("falls back to the supported registry without config", () => {
        expect(effectiveAllowedTags(undefined)).toEqual(CANVAS_SUPPORTED_HTML_TAGS);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("deduplicates lowercase entries", () => {
        expect(effectiveAllowedTags(["u", "u"])).toEqual(["u"]);
    });
});

// Parity vectors for the verbatim-range parser (issue #228 mirror): the
// backend's _code_ranges in generation_router.py must produce identical
// ranges for the same inputs — keep both suites' vectors in sync.
describe("collectVerbatimRanges parity with the backend mirror", () => {
    const vectors: Array<[string, Array<[number, number]>]> = [
        ["```\ncode\n```\ntext", [[0, 13]]],
        ["a `span` b", [[2, 8]]],
        ["text\n\n~~~\nunclosed ~~~ fence\nmore", [[6, 33]]],
        [
            "before\n```\n`inner span`\n```\nafter `x` end",
            [
                [7, 28],
                [34, 37]
            ]
        ],
        [
            "```\nfirst\n```\nmiddle\n```\nsecond\n```",
            [
                [0, 14],
                [21, 35]
            ]
        ]
    ];

    it.each(vectors)("keeps the same verbatim ranges as the backend for %j", (text, expected) => {
        expect(collectVerbatimRanges(text).map(range => [range.start, range.end])).toEqual(expected);
    });
});
