// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureImageApprovals, getApprovedImageUrls } from "../MarkdownRenderer/imageApprovals";
import { DOCX_DECODABLE_MIMES, inlineApprovedImages, markdownForExport } from "./canvasImageExport";
import { flattenImagesToText } from "./canvasLinkNeutralization";
import { generateHTML } from "@tiptap/html";
import { canvasExtensions } from "./canvasExtensions";

const DOMAINS = ["www.muenchen.de"];

describe("canvas image export adapters", () => {
    beforeEach(() => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("pixels", { headers: { "Content-Type": "image/jpeg" } }));
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
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

    it("degrades unapproved images to desc text plus a real link on the url only (PDF)", async () => {
        configureImageApprovals(null, []);
        const html = '<p>A <span data-canvas-image-src="https://example.com/p.png" data-canvas-image-alt="Plan"></span> B</p>';
        const result = await inlineApprovedImages(html, "pdf", DOMAINS);
        expect(result).toBe('<p>A Plan (<a href="https://example.com/p.png">https://example.com/p.png</a>) B</p>');
        const noAlt = '<p><span data-canvas-image-src="https://example.com/p.png" data-canvas-image-alt=""></span></p>';
        expect(await inlineApprovedImages(noAlt, "pdf", DOMAINS)).toBe('<p><a href="https://example.com/p.png">https://example.com/p.png</a></p>');
    });

    it("keeps the whole desc (url) text linked in the DOCX export", async () => {
        configureImageApprovals(null, []);
        const html = '<p>A <span data-canvas-image-src="https://example.com/p.png" data-canvas-image-alt="Plan"></span> B</p>';
        const result = await inlineApprovedImages(html, "docx", DOMAINS);
        expect(result).toBe('<p>A <a href="https://example.com/p.png">Plan (https://example.com/p.png)</a> B</p>');
    });

    it("keeps degraded images as plain text inside anchors and for blocked destinations", async () => {
        configureImageApprovals(null, []);
        const linked =
            '<p><a href="https://example.com/page"><span data-canvas-image-src="https://example.com/p.png" data-canvas-image-alt="Plan"></span></a></p>';
        expect(await inlineApprovedImages(linked, "pdf", DOMAINS)).toBe('<p><a href="https://example.com/page">Plan (https://example.com/p.png)</a></p>');
        const blocked = '<p><span data-canvas-image-src="data:text/html,evil" data-canvas-image-alt="Plan"></span></p>';
        expect(await inlineApprovedImages(blocked, "pdf", DOMAINS)).toBe("<p>Plan (data:text/html,evil)</p>");
    });

    it("inlines approved images as data URIs for the PDF export", async () => {
        configureImageApprovals(null, ["https://example.com/ok.png"]);
        expect(getApprovedImageUrls()).toContain("https://example.com/ok.png");
        const html = '<p>A <span data-canvas-image-src="https://example.com/ok.png" data-canvas-image-alt="Logo"></span> B</p>';
        const result = await inlineApprovedImages(html, "pdf", DOMAINS);
        expect(result).toContain('<img src="data:image/jpeg;base64,');
        expect(result).toContain('alt="Logo"');
    });

    it("inlines approved images for the DOCX export and keeps Excel as text", async () => {
        configureImageApprovals(null, ["https://example.com/ok.png"]);
        const html = '<p>A <span data-canvas-image-src="https://example.com/ok.png" data-canvas-image-alt="Logo"></span> B</p>';
        const forDocx = await inlineApprovedImages(html, "docx", DOMAINS);
        expect(forDocx).toContain('<img src="data:image/jpeg;base64,');
        const forXlsx = await inlineApprovedImages(html, "xlsx", DOMAINS);
        expect(forXlsx).not.toContain("<img");
        expect(forXlsx).toContain("Logo");
    });

    it("keeps allowlisted image markdown in the markdown export", () => {
        configureImageApprovals(null, []);
        expect(markdownForExport("![Logo](https://www.muenchen.de/logo.png?x=1)", ["www.muenchen.de"])).toBe("![Logo](https://www.muenchen.de/logo.png?x=1)");
    });

    it("leaves allowlisted-host images for the backend fetch in PDF and DOCX", async () => {
        configureImageApprovals(null, []);
        const html = '<p><span data-canvas-image-src="https://www.muenchen.de/logo.png?x=1" data-canvas-image-alt="Logo"></span></p>';
        const fetchSpy = vi.mocked(globalThis.fetch);
        fetchSpy.mockClear();

        for (const target of ["pdf", "docx"] as const) {
            const result = await inlineApprovedImages(html, target, DOMAINS);
            expect(result).toContain('data-canvas-image-src="https://www.muenchen.de/logo.png?x=1"');
            expect(result).not.toContain("<img");
        }
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("keeps markdown image syntax only for approved URLs", () => {
        configureImageApprovals(null, ["https://example.com/ok.png"]);
        expect(markdownForExport("![Plan](https://example.com/ok.png)", [])).toBe("![Plan](https://example.com/ok.png)");
        expect(markdownForExport("![Plan](https://example.com/no.png)", [])).toBe("Plan (https://example.com/no.png)");
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

// Parity pin: the backend's IMAGE_DATA_MIMES (app/export/image_fetcher.py)
// must match this set — a data URI with a MIME outside it is rasterized in
// the browser because the DOCX converter cannot decode it.
describe("DOCX_DECODABLE_MIMES parity with the backend", () => {
    it("matches the backend's shared image data MIME set", () => {
        expect([...DOCX_DECODABLE_MIMES].sort()).toEqual(["image/bmp", "image/gif", "image/jpeg", "image/png", "image/tiff"]);
    });
});
