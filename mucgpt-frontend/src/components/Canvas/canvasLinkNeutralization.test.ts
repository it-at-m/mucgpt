// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { flattenPastedLinks, withoutLinkMarks } from "./canvasLinkNeutralization";

describe("flattenPastedLinks", () => {
    it("flattens anchors into description (url) text", () => {
        const html = '<p>Versand an <a href="https://muenchen.de/form">das Formular</a> heute.</p>';
        expect(flattenPastedLinks(html)).toBe("<p>Versand an das Formular (https://muenchen.de/form) heute.</p>");
    });

    it("keeps the inner text when the anchor has no href", () => {
        expect(flattenPastedLinks("<p><a>Linktext</a></p>")).toBe("<p>Linktext</p>");
    });

    it("uses a bare URL when the anchor has no text", () => {
        expect(flattenPastedLinks('<a href="https://muenchen.de"></a>')).toBe("https://muenchen.de");
    });

    it("does not duplicate the URL when the text already contains it", () => {
        expect(flattenPastedLinks('<a href="https://muenchen.de">https://muenchen.de</a>')).toBe("https://muenchen.de");
    });

    it("leaves HTML without anchors untouched", () => {
        const html = "<p><strong>fett</strong> und <u>unterstrichen</u></p>";
        expect(flattenPastedLinks(html)).toBe(html);
    });
});

describe("withoutLinkMarks", () => {
    it("strips link marks from nested content, keeping text and other marks", () => {
        const docJson = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [
                        { type: "text", text: "a", marks: [{ type: "bold" }] },
                        { type: "text", text: "b", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }
                    ]
                }
            ]
        };
        const result = withoutLinkMarks(docJson) as typeof docJson;
        const texts = (result.content![0] as Record<string, unknown>).content as Array<Record<string, unknown>>;
        expect(texts).toHaveLength(2);
        expect(texts[1].marks).toEqual([]);
        expect(texts[1].text).toBe("b");
        expect(texts[0].marks).toEqual([{ type: "bold" }]);
    });

    it("returns non-object input unchanged", () => {
        expect(withoutLinkMarks(null)).toBeNull();
        expect(withoutLinkMarks("doc")).toBe("doc");
    });
});
