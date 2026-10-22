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
import { parseCanvasRevisions, type CanvasRevisions } from "../../service/canvasStorage";
import type { CanvasControllerInstance } from "../../hooks/useCanvasController";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const controllerFor = (revisions: CanvasRevisions): CanvasControllerInstance => ({ revisions, restore: () => {} }) as unknown as CanvasControllerInstance;

const cleanups: (() => void)[] = [];
afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()!();
    document.body.innerHTML = "";
});

const renderDrawer = (revisions: CanvasRevisions): HTMLElement[] => {
    act(() => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root: Root = createRoot(container);
        root.render(createElement(CanvasVersionsDrawer, { open: true, onClose: () => {}, controller: controllerFor(revisions) }));
        cleanups.push(() => act(() => root.unmount()));
    });
    return Array.from(document.body.querySelectorAll("article"));
};

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

    it("leaves SVG-namespace anchors untouched by the HTML-only hardening hook", () => {
        const sanitized = DOMPurify.sanitize('<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><text>x</text></a></svg>', {
            USE_PROFILES: { svg: true }
        });
        expect(sanitized).toContain("<a");
        expect(sanitized).not.toContain('rel="noopener noreferrer"');
    });
});
