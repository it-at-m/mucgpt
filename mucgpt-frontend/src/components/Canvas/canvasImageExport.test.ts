// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { getApprovedImageUrls } from "../MarkdownRenderer/imageApprovals";
import { configureImageApprovals } from "../MarkdownRenderer/imageApprovals";
import { inlineApprovedImages, markdownForExport } from "./canvasImageExport";
import { flattenImagesToText } from "./canvasLinkNeutralization";
import { generateHTML } from "@tiptap/html";
import { canvasExtensions } from "./canvasExtensions";

const DOMAINS = ["www.muenchen.de"];

describe("canvas image export adapters", () => {
    it("renders the node as a span without a fetchable src", () => {
        const html = generateHTML(
            {
                type: "doc",
                content: [
                    {
                        type: "paragraph",
                        content: [{ type: "image", attrs: { src: "https://example.com/p.png?d=1", alt: "Plan" } }]
                    }
                ]
            },
            canvasExtensions()
        );
        expect(html).not.toContain("<img");
        expect(html).not.toMatch(/\ssrc="/);
        expect(html).toContain('data-canvas-image-src="https://example.com/p.png?d=1"');
        expect(html).toContain('data-canvas-image-alt="Plan"');
    });

    it("degrades unapproved images to alt (url) text in the export HTML", async () => {
        configureImageApprovals(null, []);
        const html = '<p>A <span data-canvas-image-src="https://example.com/p.png" data-canvas-image-alt="Plan"></span> B</p>';
        const result = await inlineApprovedImages(html, "pdf");
        expect(result).toBe("<p>A Plan (https://example.com/p.png) B</p>");
    });

    it("inlines approved images as data URIs for the PDF export", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("pixels", { headers: { "Content-Type": "image/png" } }));
        configureImageApprovals(null, ["https://example.com/ok.png"]);
        expect(getApprovedImageUrls()).toContain("https://example.com/ok.png");
        const html = '<p>A <span data-canvas-image-src="https://example.com/ok.png" data-canvas-image-alt="Logo"></span> B</p>';
        const result = await inlineApprovedImages(html, "pdf");
        expect(result).toContain('<img src="data:image/png;base64,');
        expect(result).toContain('alt="Logo"');
        vi.restoreAllMocks();
    });

    it("keeps markdown image syntax only for approved URLs", () => {
        configureImageApprovals(null, ["https://example.com/ok.png"]);
        expect(markdownForExport("![Plan](https://example.com/ok.png)")).toBe("![Plan](https://example.com/ok.png)");
        expect(markdownForExport("![Plan](https://example.com/no.png)")).toBe("Plan (https://example.com/no.png)");
    });
});

describe("flattenImagesToText with the span serialization", () => {
    it("turns editor image spans and stray imgs into alt (url) text", () => {
        const html =
            '<p>A <span data-canvas-image-src="https://example.com/p.png?d=1" data-canvas-image-alt="Plan"></span> B <img src="https://example.com/x.png" alt="Bild"></p>';
        const result = flattenImagesToText(html, DOMAINS);
        expect(result).not.toContain("<img");
        expect(result).not.toContain("data-canvas-image-src");
        expect(result).toContain("Plan (https://example.com/p.png)");
        expect(result).toContain("Bild (https://example.com/x.png)");
    });
});
