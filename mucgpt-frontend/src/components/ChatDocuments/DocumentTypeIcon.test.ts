import { describe, expect, it } from "vitest";

import { getDocumentKind } from "./DocumentTypeIcon";

describe("getDocumentKind", () => {
    it.each([
        ["Bescheid.PDF", "pdf"],
        ["Notizen.md", "text"],
        ["Antrag.docx", "text"],
        ["Haushalt.xlsx", "spreadsheet"],
        ["export.csv", "spreadsheet"],
        ["Vortrag.pptx", "presentation"],
        ["Anfrage.msg", "email"],
        ["Scan.jpeg", "image"]
    ])("maps %s to %s", (filename, kind) => {
        expect(getDocumentKind(filename)).toBe(kind);
    });

    it("uses the last extension so migrated browser documents count as text", () => {
        expect(getDocumentKind("Protokoll.pdf.txt")).toBe("text");
    });

    it.each(["README", ".env", "archiv.zip", "endung."])("falls back to a generic document for %s", filename => {
        expect(getDocumentKind(filename)).toBe("other");
    });
});
