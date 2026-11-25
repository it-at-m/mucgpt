import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { safeMarkdownComponents, stripMarkdownLinks } from "./markdownLinkPolicy";

const renderMarkdown = (markdown: string): string =>
    renderToStaticMarkup(
        <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
            {markdown}
        </Markdown>
    );

describe("markdownLinkPolicy", () => {
    it("renders links as plain text with the URL appended and no anchor", () => {
        const html = renderMarkdown("[MUCGPT](https://mucgpt.example.com)");
        expect(html).not.toContain("<a");
        expect(html).not.toContain("href");
        expect(html).toContain("MUCGPT");
        expect(html).toContain("(https://mucgpt.example.com)");
    });

    it("does not duplicate the URL when the link text already is the URL", () => {
        const html = renderMarkdown("<https://mucgpt.example.com>");
        expect(html).not.toContain("<a");
        expect(html.match(/mucgpt\.example\.com/g)).toHaveLength(1);
    });

    it("never renders an img element, not even for markdown images", () => {
        const html = renderMarkdown("![tracking pixel](https://evil.example.com/pixel.png?d=secret)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("src=");
        expect(html).toContain("tracking pixel");
    });

    it("falls back to the URL for images without alt text", () => {
        const html = renderMarkdown("![](https://evil.example.com/pixel.png)");
        expect(html).not.toContain("<img");
        expect(html).toContain("https://evil.example.com/pixel.png");
    });

    it("keeps other markdown intact", () => {
        const html = renderMarkdown("# Title\n\n**bold** and `code`");
        expect(html).toContain("Title");
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<code>code</code>");
    });
});

describe("stripMarkdownLinks", () => {
    it("unwraps inline links", () => {
        expect(stripMarkdownLinks("- [Node](https://evil.example.com)")).toBe("- Node");
    });

    it("drops images, keeping only their alt text", () => {
        expect(stripMarkdownLinks("topic ![tiny](https://evil.example.com/x.png) more")).toBe("topic tiny more");
    });

    it("unwraps reference-style links and drops their definitions", () => {
        const result = stripMarkdownLinks("A [B][ref] node\n\n[ref]: https://evil.example.com");
        expect(result).not.toContain("evil.example.com");
        expect(result).toContain("A B node");
    });

    it("unwraps autolinks", () => {
        expect(stripMarkdownLinks("<https://evil.example.com>")).toBe("https://evil.example.com");
    });

    it("leaves fenced and inline code untouched", () => {
        const markdown = "text [a](https://x.example.com)\n\n```\n[keep](https://code.example.com)\n```\n\ninline `[also kept](y)`";
        const result = stripMarkdownLinks(markdown);
        expect(result).toContain("[keep](https://code.example.com)");
        expect(result).toContain("`[also kept](y)`");
        expect(result).toContain("text a");
    });
});
