// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import DOMPurify from "dompurify";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "de" } })
}));

import { CanvasVersionsDrawer } from "./CanvasVersionsDrawer";
import { canvasExtensions } from "./canvasExtensions";
import { getSchema } from "@tiptap/core";
import { parseCanvasRevisions, type CanvasRevisions } from "../../service/canvasStorage";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const controllerFor = (revisions: CanvasRevisions): CanvasControllerInstance => ({ revisions, restore: () => {} }) as unknown as CanvasControllerInstance;

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()!();
    document.body.innerHTML = "";
});

const renderDrawerWith = (controller: CanvasControllerInstance): HTMLElement[] => {
    act(() => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root: Root = createRoot(container);
        root.render(createElement(CanvasVersionsDrawer, { open: true, onClose: () => {}, controller }));
        cleanups.push(() => act(() => root.unmount()));
    });
    return Array.from(document.body.querySelectorAll("article"));
};

const renderDrawer = (revisions: CanvasRevisions): HTMLElement[] => renderDrawerWith(controllerFor(revisions));

const previewOf = (article: HTMLElement): string => (article.querySelectorAll("div")[1] as HTMLElement).innerHTML;

describe("CanvasVersionsDrawer", () => {
    it("renders an empty preview instead of crashing on malformed doc_json", () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
        const articles = renderDrawer({
            auto: [{ revision: 1, doc_json: { type: "doc", content: [{ type: "doesNotExist" }] }, timestamp: 1, source: "agent" }],
            manual: []
        });
        expect(articles).toHaveLength(1);
        expect(previewOf(articles[0])).toBe("");
        consoleError.mockRestore();
    });

    it("renders a sanitized preview for valid doc_json", () => {
        const articles = renderDrawer({
            auto: [
                {
                    revision: 1,
                    doc_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello preview" }] }] },
                    timestamp: 1,
                    source: "agent"
                }
            ],
            manual: []
        });
        expect(articles).toHaveLength(1);
        expect(previewOf(articles[0])).toContain("Hello preview");
    });

    it("renders a diff to the current text, the close action and the diff caption", () => {
        const schema = getSchema(canvasExtensions());
        const currentDoc = schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Aktueller Text" }] }] });
        renderDrawerWith({
            revisions: {
                auto: [
                    {
                        revision: 1,
                        doc_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Alter Text" }] }] },
                        timestamp: 1,
                        source: "agent"
                    }
                ],
                manual: []
            },
            restore: () => {},
            editor: { state: { doc: currentDoc, schema } }
        } as unknown as CanvasControllerInstance);

        const text = document.body.textContent ?? "";
        expect(text).toContain("canvas.versions.diff_caption");
        expect(text).toContain("Alter Text");
        expect(text).toContain("Aktueller Text");
        expect(document.querySelector('[aria-label="canvas.versions.close"]')).not.toBeNull();
    });

    it("only marks the changed block and keeps unchanged blocks plain", () => {
        const schema = getSchema(canvasExtensions());
        const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
        const currentDoc = schema.nodeFromJSON({ type: "doc", content: [paragraph("Bleibt"), paragraph("Aktueller Text")] });
        const revisionDocJson = { type: "doc", content: [paragraph("Bleibt"), paragraph("Alter Text")] };

        renderDrawerWith({
            revisions: { auto: [{ revision: 1, doc_json: revisionDocJson, timestamp: 1, source: "agent" }], manual: [] },
            restore: () => {},
            editor: { state: { doc: currentDoc, schema } }
        } as unknown as CanvasControllerInstance);

        const lines = (kind: string) => Array.from(document.querySelectorAll(`[data-canvas-diff-kind="${kind}"]`)).map(node => node.textContent);
        expect(lines("equal")).toEqual(["Bleibt"]);
        expect(lines("delete")).toEqual(["Aktueller Text"]);
        expect(lines("insert")).toEqual(["Alter Text"]);
        // Added text is shown before the removed text (matches the ✓/✕ order).
        const order = Array.from(document.querySelectorAll("[data-canvas-diff-kind]")).map(node => node.getAttribute("data-canvas-diff-kind"));
        expect(order).toEqual(["equal", "insert", "delete"]);
    });

    it("drops malformed-timestamp entries before render and renders the valid ones", () => {
        const rings = parseCanvasRevisions({
            auto: [
                { revision: 1, doc_json: { type: "doc" }, timestamp: "garbage", source: "agent" },
                {
                    revision: 2,
                    doc_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Valid entry" }] }] },
                    timestamp: 1,
                    source: "agent"
                }
            ],
            manual: []
        });
        const articles = renderDrawer(rings);
        expect(articles).toHaveLength(1);
        expect(previewOf(articles[0])).toContain("Valid entry");
    });

    it("hardens anchors surviving sanitization with rel and a safe target", () => {
        const sanitized = DOMPurify.sanitize('<a href="https://example.com">link</a>', { USE_PROFILES: { html: true } });
        expect(sanitized).toContain('rel="noopener noreferrer"');
        expect(sanitized).toContain('target="_blank"');
    });

    it("hardens the link of a rendered revision preview, not just sanitized strings", () => {
        const articles = renderDrawer({
            auto: [
                {
                    revision: 1,
                    doc_json: {
                        type: "doc",
                        content: [
                            {
                                type: "paragraph",
                                content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }]
                            }
                        ]
                    },
                    timestamp: 1,
                    source: "agent"
                }
            ],
            manual: []
        });
        expect(articles).toHaveLength(1);
        const anchor = articles[0].querySelector("a");
        expect(anchor).not.toBeNull();
        expect(anchor!.getAttribute("rel")).toBe("noopener noreferrer");
        expect(anchor!.getAttribute("target")).toBe("_blank");
    });

    it("leaves SVG-namespace anchors untouched by the HTML-only hardening hook", () => {
        const sanitized = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><text>x</text></a></svg>', {
            USE_PROFILES: { svg: true }
        });
        expect(sanitized).toContain("<a");
        expect(sanitized).not.toContain('rel="noopener noreferrer"');
    });
});
