// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "prosemirror-model";

import { canvasExtensions } from "./canvasExtensions";
import { interceptLinkClicks, prepareCanvasMarkdown } from "./canvasLinkPolicy";
import { allowForSession } from "../MarkdownRenderer/externalLinkGuard";

const DOMAIN = "www.muenchen.de";

const ingest = (markdown: string, domains: readonly string[] = [DOMAIN]): Editor => {
    const editor = new Editor({ extensions: canvasExtensions(undefined, () => domains), content: "" });
    // setContent (not constructor content) so the link-mark pass applies, as
    // in every real ingestion path.
    editor.commands.setContent(prepareCanvasMarkdown(markdown, domains));
    return editor;
};

const linksOf = (editor: Editor): Array<{ href: string; text: string }> => {
    const links: Array<{ href: string; text: string }> = [];
    editor.state.doc.descendants((node: ProseMirrorNode) => {
        const link = node.marks.find(mark => mark.type.name === "link");
        if (link) links.push({ href: String(link.attrs.href), text: node.text ?? "" });
    });
    return links;
};

describe("canvas link policy ingestion", () => {
    it("marks the URL part of a plain-text link with the sanitized href", () => {
        const editor = ingest("Anleitung: [Formular](https://evil.example.com/d?token=1) ansehen");
        expect(editor.state.doc.textContent).toBe("Anleitung: Formular (https://evil.example.com/d) ansehen");
        expect(linksOf(editor)).toEqual([{ href: "https://evil.example.com/d", text: "https://evil.example.com/d" }]);
        editor.destroy();
    });

    it("keeps the full URL for allowlisted hosts", () => {
        const editor = ingest("[Suche](https://www.muenchen.de/suche?q=1)");
        expect(linksOf(editor)).toEqual([{ href: "https://www.muenchen.de/suche?q=1", text: "https://www.muenchen.de/suche?q=1" }]);
        editor.destroy();
    });

    it("does not mark blocked destinations", () => {
        const editor = ingest("[X](javascript:alert(1))");
        expect(editor.state.doc.textContent).toBe("X (javascript:alert(1))");
        expect(linksOf(editor)).toEqual([]);
        editor.destroy();
    });

    it("turns images into sanitized image nodes and blocked images into text", () => {
        const editor = ingest("![Plan](https://evil.example.com/p?d=1) und ![Logo](https://www.muenchen.de/l.png) und ![Bad](javascript:x)");
        const images: Array<{ src: string | null; alt: string | null }> = [];
        editor.state.doc.descendants((node: ProseMirrorNode) => {
            if (node.type.name === "image") images.push({ src: node.attrs.src, alt: node.attrs.alt });
        });
        expect(images).toEqual([
            { src: "https://evil.example.com/p", alt: "Plan" },
            { src: "https://www.muenchen.de/l.png", alt: "Logo" }
        ]);
        expect(editor.state.doc.textContent).toContain("Bad (javascript:x)");
        editor.destroy();
    });

    it("keeps code spans untouched by the mark pass", () => {
        const editor = ingest("Code `(<https://evil.example.com/x>)` bleibt Text");
        expect(linksOf(editor)).toEqual([]);
        editor.destroy();
    });

    it("marks bare www.-domains like the chat's autolink literals", () => {
        const foreign = ingest("Siehe www.google.de heute.");
        expect(foreign.state.doc.textContent).toContain("www.google.de");
        expect(linksOf(foreign)).toEqual([{ href: "http://www.google.de/", text: "www.google.de" }]);
        foreign.destroy();

        const allowlisted = ingest("Siehe www.muenchen.de heute.");
        expect(linksOf(allowlisted)).toEqual([{ href: "https://www.muenchen.de", text: "www.muenchen.de" }]);
        allowlisted.destroy();
    });

    it("marks a bare www.-domain inside parentheses and trims trailing punctuation", () => {
        const editor = ingest("Beschreibung (www.example.com/detail).");
        expect(linksOf(editor)).toEqual([{ href: "http://www.example.com/detail", text: "www.example.com/detail" }]);
        editor.destroy();
    });

    it("does not mark scheme-less text that is not a www. domain", () => {
        const editor = ingest("Siehe example.de heute.");
        expect(linksOf(editor)).toEqual([]);
        editor.destroy();
    });

    it("round-trips the marked text form", () => {
        const editor = ingest("[Formular](https://evil.example.com/d?token=1)");
        const storage = editor.storage as unknown as Record<string, { serializer: { serialize(node: unknown): string } }>;
        const markdown = storage.markdown.serializer.serialize(editor.state.doc);
        editor.commands.setContent(markdown);
        const second = storage.markdown.serializer.serialize(editor.state.doc);
        expect(second).toBe(markdown);
        expect(second).not.toContain("token=1");
        editor.destroy();
    });
});

describe("interceptLinkClicks", () => {
    const makeEvent = (href: string) => {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", href);
        return { target: anchor, preventDefault: vi.fn() } as unknown as Event;
    };

    it("asks for confirmation for sanitized links and blocks the default", () => {
        const event = makeEvent("https://evil.example.com/p");
        expect(interceptLinkClicks(event, ["www.muenchen.de"])).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it("leaves allowlisted and session-allowed links to the default", () => {
        expect(interceptLinkClicks(makeEvent("https://www.muenchen.de/x"), ["www.muenchen.de"])).toBe(false);

        allowForSession("https://allowed.example.org/a");
        expect(interceptLinkClicks(makeEvent("https://allowed.example.org/a"), ["www.muenchen.de"])).toBe(false);

        const outside = makeEvent("https://evil.example.com/p");
        expect(interceptLinkClicks(outside, ["www.muenchen.de"])).toBe(true);
        expect(outside.preventDefault).toHaveBeenCalled();
    });
});
