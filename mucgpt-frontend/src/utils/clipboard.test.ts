// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyRichText, serializeForClipboard } from "./clipboard";

class ClipboardItemStub {
    formats: Record<string, Blob>;

    constructor(formats: Record<string, Blob>) {
        this.formats = formats;
    }

    get types(): string[] {
        return Object.keys(this.formats);
    }
}

describe("copyRichText", () => {
    beforeEach(() => {
        vi.stubGlobal("navigator", { clipboard: { write: vi.fn().mockResolvedValue(undefined), writeText: vi.fn().mockResolvedValue(undefined) } });
        vi.stubGlobal("ClipboardItem", ClipboardItemStub);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("writes html and plain text as separate clipboard formats", async () => {
        await copyRichText("<p>hello</p>", "hello");
        const write = vi.mocked(navigator.clipboard.write);
        expect(write).toHaveBeenCalledTimes(1);
        const item = write.mock.calls[0][0][0] as unknown as ClipboardItemStub;
        expect(item.types).toEqual(["text/html", "text/plain"]);
        expect(await item.formats["text/html"].text()).toBe("<p>hello</p>");
        expect(await item.formats["text/plain"].text()).toBe("hello");
        expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it("falls back to plain text when clipboard.write fails", async () => {
        vi.mocked(navigator.clipboard.write).mockRejectedValueOnce(new Error("denied"));
        await copyRichText("<p>hello</p>", "hello");
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    });
});

describe("serializeForClipboard", () => {
    it("serializes the element and strips clipboard-only controls", () => {
        document.body.innerHTML = '<div id="answer"><p>text</p><div data-clipboard-ignore="true"><button>copy</button></div></div>';
        const element = document.getElementById("answer") as HTMLElement;

        const html = serializeForClipboard(element);

        expect(html).toContain("<p>text</p>");
        expect(html).not.toContain("data-clipboard-ignore");
        expect(html).not.toContain("copy");
        expect(element.querySelector("button")).not.toBeNull();
    });

    it("removes nested clipboard-only controls such as diagram toolbars", () => {
        document.body.innerHTML =
            '<div id="answer"><div class="diagram"><svg /></div><div class="controls" data-clipboard-ignore="true"><span>100%</span><button>zoom</button></div></div>';
        const element = document.getElementById("answer") as HTMLElement;

        const html = serializeForClipboard(element);

        expect(html).toContain("<svg");
        expect(html).not.toContain("100%");
        expect(html).not.toContain("zoom");
    });

    it("resolves relative link and image URLs against the document base", () => {
        document.body.innerHTML = '<div id="answer"><a href="pfad/dok.pdf">link</a><img src="bilder/bild.png" alt="" /></div>';
        const element = document.getElementById("answer") as HTMLElement;

        const html = serializeForClipboard(element);

        expect(html).toContain(`href="${new URL("pfad/dok.pdf", document.baseURI).href}"`);
        expect(html).toContain(`src="${new URL("bilder/bild.png", document.baseURI).href}"`);
    });

    it("keeps absolute and non-parsable URLs unchanged", () => {
        document.body.innerHTML = '<div id="answer"><a href="https://example.org/x">a</a><a href="http://[">b</a></div>';
        const element = document.getElementById("answer") as HTMLElement;

        const html = serializeForClipboard(element);

        expect(html).toContain('href="https://example.org/x"');
        expect(html).toContain('href="http://["');
    });
});
