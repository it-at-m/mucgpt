// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hasCompressedDiagram, stripDrawioCellLinks } from "./diagramSecurity";

describe("stripDrawioCellLinks", () => {
    it("removes link attributes from cells and user objects, keeping other attributes intact", () => {
        const xml =
            '<mxGraphModel><root><mxCell id="2" value="click" link="https://evil.example.com/?d=secret" vertex="1"/><UserObject label="x" id="3" itatm-link-test="keep">' +
            "<mxCell link='single' style='a;b'/></UserObject></root></mxGraphModel>";
        const result = stripDrawioCellLinks(xml);
        expect(result).not.toContain("evil.example.com");
        expect(result).not.toContain("single");
        expect(result).toContain('value="click"');
        expect(result).toContain('itatm-link-test="keep"');
        expect(result).toContain("style");
    });

    it("removes xlink:href attributes independently of link", () => {
        expect(stripDrawioCellLinks('<mxCell xlink:href="https://evil.example.com" id="1"/>')).not.toContain("evil.example.com");
    });

    it("keeps attribute values that contain link-like text", () => {
        const result = stripDrawioCellLinks('<mxCell tooltip=\'Docs: link="a" here\' value="v"/>');
        expect(result).toContain("Docs:");
        expect(result).toContain("here");
    });

    it("falls back to the attribute regex for unparseable input", () => {
        const garbage = '<mxCell link="https://evil.example.com"'; // no closing tag
        const result = stripDrawioCellLinks(garbage);
        expect(result).not.toContain("evil.example.com");
    });

    it("leaves XML without link attributes unchanged", () => {
        const xml = '<mxGraphModel><mxCell id="1" style="rounded=1"/></mxGraphModel>';
        expect(stripDrawioCellLinks(xml)).not.toContain("link=");
    });
});

describe("hasCompressedDiagram", () => {
    it("detects base64 diagram bodies that the viewer would inflate", () => {
        expect(hasCompressedDiagram('<diagram name="s">zVRLi9swEP8gn3H</diagram>')).toBe(true);
        expect(hasCompressedDiagram('<mxfile><diagram id="d">\nzU8x78</diagram></mxfile>')).toBe(true);
    });

    it("refuses CDATA-wrapped compressed bodies", () => {
        expect(hasCompressedDiagram('<mxfile><diagram id="d"><![CDATA[zVRLi9swEP8gn3H]]></diagram></mxfile>')).toBe(true);
    });

    it("refuses diagram bodies mixed with literal XML (the viewer inflates any text)", () => {
        expect(hasCompressedDiagram('<mxfile><diagram id="d"><mxGraphModel/>LITERAL+CIPHERTEXT</diagram></mxfile>')).toBe(true);
    });

    it("accepts literal XML diagrams, also with reserved characters in attributes", () => {
        expect(hasCompressedDiagram('<mxfile><diagram id="d" name="A > B"><mxGraphModel/></diagram></mxfile>')).toBe(false);
        expect(hasCompressedDiagram("<mxGraphModel><root/></mxGraphModel>")).toBe(false);
    });

    it("refuses unparseable XML", () => {
        expect(hasCompressedDiagram("<diagram><cutoff")).toBe(true);
    });
});
