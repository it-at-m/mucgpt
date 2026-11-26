// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { flattenPastedLinks, imagePasteMarkdown } from "./canvasLinkNeutralization";
import { withPolicyLinkMarks } from "./canvasLinkPolicy";

const DOMAIN = "www.muenchen.de";

describe("flattenPastedLinks", () => {
    it("flattens anchors into description (url) text", () => {
        const html = '<p>Versand an <a href="https://muenchen.de/form">das Formular</a> heute.</p>';
        expect(flattenPastedLinks(html, [])).toBe("<p>Versand an das Formular (https://muenchen.de/form) heute.</p>");
    });

    it("keeps the inner text when the anchor has no href", () => {
        expect(flattenPastedLinks("<p><a>Linktext</a></p>", [])).toBe("<p>Linktext</p>");
    });

    it("uses a bare URL when the anchor has no text", () => {
        expect(flattenPastedLinks('<a href="https://muenchen.de"></a>', [])).toBe("https://muenchen.de/");
    });

    it("does not duplicate the URL when the text already contains it", () => {
        expect(flattenPastedLinks('<a href="https://muenchen.de">https://muenchen.de</a>', [])).toBe("https://muenchen.de/");
    });

    it("leaves HTML without anchors untouched", () => {
        const html = "<p><strong>fett</strong> und <u>unterstrichen</u></p>";
        expect(flattenPastedLinks(html, [])).toBe(html);
    });

    it("keeps pasted images as sanitized img elements for the approval flow", () => {
        const html = '<p>Schaubild: <img src="https://evil.example.com/p?d=1" alt="Plan" width="200"> Ende.</p>';
        expect(flattenPastedLinks(html, [])).toBe('<p>Schaubild: <img src="https://evil.example.com/p" alt="Plan"> Ende.</p>');
    });

    it("keeps allowlisted pasted images with their query intact", () => {
        expect(flattenPastedLinks('<img src="https://www.muenchen.de/logo?e=1" alt="Logo">', ["www.muenchen.de"])).toBe(
            '<img src="https://www.muenchen.de/logo?e=1" alt="Logo">'
        );
    });

    it("degrades blocked pasted images to alt (src) text", () => {
        expect(flattenPastedLinks('<img src="javascript:alert(1)" alt="X">', ["www.muenchen.de"])).toBe("X (javascript:alert(1))");
    });

    it("flattens sourceless images into nothing", () => {
        expect(flattenPastedLinks('<p><img alt="x"> okay</p>', [])).toBe("<p> okay</p>");
    });

    it("keeps link-wrapped images as their alt (src) text inside the flattened anchor", () => {
        expect(flattenPastedLinks('<a href="https://evil.example.com/a"><img src="https://evil.example.com/b.png" alt="B"></a>', [])).toBe(
            "B (https://evil.example.com/b.png) (https://evil.example.com/a)"
        );
    });

    it("keeps allowlisted hrefs with query strings intact", () => {
        const html = '<a href="https://www.muenchen.de/suche?q=1">Suche</a>';
        expect(flattenPastedLinks(html, [DOMAIN])).toBe("Suche (https://www.muenchen.de/suche?q=1)");
    });

    it("strips query strings from pasted foreign hrefs", () => {
        expect(flattenPastedLinks('<a href="https://evil.example.com/p?d=1#f">Lesen</a>', [])).toBe("Lesen (https://evil.example.com/p)");
    });

    it("keeps blocked destinations in their raw text form", () => {
        expect(flattenPastedLinks('<a href="javascript:alert(1)">X</a>', [DOMAIN])).toBe("X (javascript:alert(1))");
    });
});

describe("withPolicyLinkMarks", () => {
    const docWithHref = (href: string) => ({
        type: "doc",
        content: [
            {
                type: "paragraph",
                content: [{ type: "text", text: "b", marks: [{ type: "link", attrs: { href } }] }]
            }
        ]
    });

    it("keeps allowlisted hrefs byte-for-byte", () => {
        const result = withPolicyLinkMarks(docWithHref("https://www.muenchen.de/x?q=1"), ["www.muenchen.de"]);
        const text = (result as ReturnType<typeof docWithHref>).content[0].content[0];
        expect(text.marks).toEqual([{ type: "link", attrs: { href: "https://www.muenchen.de/x?q=1" } }]);
    });

    it("sanitizes foreign hrefs in place", () => {
        const result = withPolicyLinkMarks(docWithHref("https://example.com/p?d=1#f"), []);
        const text = (result as ReturnType<typeof docWithHref>).content[0].content[0];
        expect(text.marks).toEqual([{ type: "link", attrs: { href: "https://example.com/p" } }]);
    });

    it("drops marks with blocked destinations", () => {
        const result = withPolicyLinkMarks(docWithHref("javascript:alert(1)"), []);
        const text = (result as ReturnType<typeof docWithHref>).content[0].content[0];
        expect(text.marks).toEqual([]);
        expect(text.text).toBe("b");
    });

    it("returns non-object input unchanged", () => {
        expect(withPolicyLinkMarks(null, [])).toBeNull();
        expect(withPolicyLinkMarks("doc", [])).toBe("doc");
    });
});

describe("imagePasteMarkdown", () => {
    it("builds angle-wrapped image markdown from a bare image URL", () => {
        expect(imagePasteMarkdown("https://evil.example.com/photos/plan.png", [])).toBe("![plan.png](<https://evil.example.com/photos/plan.png>)");
    });

    it("sanitizes the destination before building the markdown", () => {
        expect(imagePasteMarkdown("https://evil.example.com/plan.jpeg?v=2", [])).toBe("![plan.jpeg](<https://evil.example.com/plan.jpeg>)");
        expect(imagePasteMarkdown("https://www.muenchen.de/logo.png?x=1", ["www.muenchen.de"])).toBe("![logo.png](<https://www.muenchen.de/logo.png?x=1>)");
    });

    it("returns null for blocked destinations, non-image text and multiline paste", () => {
        expect(imagePasteMarkdown("javascript:alert(1)", [])).toBeNull();
        expect(imagePasteMarkdown("https://evil.example.com/page.html", [])).toBeNull();
        expect(imagePasteMarkdown("a.png\nb.png", [])).toBeNull();
        expect(imagePasteMarkdown("just text", [])).toBeNull();
    });

    it("normalizes pasted image markdown destinations", () => {
        expect(imagePasteMarkdown("![Plan](https://evil.example.com/p.gif?d=1)", [])).toBe("![Plan](<https://evil.example.com/p.gif>)");
        expect(imagePasteMarkdown("![X](javascript:alert(1))", [])).toBeNull();
    });
});
