import { describe, expect, it } from "vitest";
import { stripDrawioCellLinks } from "./diagramSecurity";

describe("stripDrawioCellLinks", () => {
    it("removes link attributes from cells and user objects", () => {
        const xml =
            '<mxGraphModel><root><mxCell id="2" value="click" link="https://evil.example.com/?d=secret" vertex="1"/><UserObject label="x" id="3" itatm-link-test="keep">' +
            "<mxCell link='single' style='a;b'/></UserObject></root></mxGraphModel>";
        const result = stripDrawioCellLinks(xml);
        expect(result).not.toContain('link="https://evil.example.com');
        expect(result).not.toContain("link='single'");
        expect(result).not.toContain("single");
        expect(result).toContain('value="click" vertex="1"');
        expect(result).toContain('itatm-link-test="keep"');
    });

    it("removes xlink:href attributes", () => {
        expect(stripDrawioCellLinks('<mxCell xlink:href="https://evil.example.com" id="1"/>')).toBe('<mxCell id="1"/>');
    });

    it("leaves XML without link attributes unchanged", () => {
        const xml = '<mxGraphModel><mxCell id="1" style="rounded=1"/></mxGraphModel>';
        expect(stripDrawioCellLinks(xml)).toBe(xml);
    });
});
