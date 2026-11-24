// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CanvasController } from "../../hooks/useCanvasController";
import { CanvasToolbar } from "./CanvasToolbar";
import { canvasExtensions } from "./canvasExtensions";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../GlobalToastHandler/GlobalToastContext", () => ({
    useGlobalToastContext: () => ({ showError: vi.fn(), showSuccess: vi.fn() })
}));
vi.mock("../EdelweissSpinner", () => ({ EdelweissSpinner: () => <span /> }));
vi.mock("../../api/core-client", () => ({ exportCanvasApi: vi.fn() }));

const controllerStub = {
    getMarkdown: () => "",
    snapshot: vi.fn(),
    setIsOpen: vi.fn()
} as unknown as CanvasController;

const editorFor = (markdown: string) => new Editor({ extensions: canvasExtensions(), content: markdown });

const renderToolbar = (editor: Editor) => render(<CanvasToolbar editor={editor} controller={controllerStub} onOpenVersions={vi.fn()} disabled={false} />);

/** Puts the caret inside the first block so heading commands act on it. */
const focusEditor = (editor: Editor) => {
    editor.commands.setTextSelection(1);
};

describe("CanvasToolbar heading buttons", () => {
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
        user = userEvent.setup();
    });

    afterEach(() => {
        cleanup();
    });

    it("toggles a paragraph to H3 and back to normal text", async () => {
        const editor = editorFor("Schnellmeldung");
        try {
            renderToolbar(editor);
            focusEditor(editor);

            await user.click(screen.getByRole("button", { name: "canvas.toolbar.heading_3" }));
            await waitFor(() => expect(editor.getHTML()).toContain("<h3>"));

            await user.click(screen.getByRole("button", { name: "canvas.toolbar.heading_3" }));
            await waitFor(() => expect(editor.getHTML()).not.toContain("<h3>"));
        } finally {
            editor.destroy();
        }
    });

    it("shows H3 pressed while the caret is in an agent-authored H4 and toggles it back to normal text", async () => {
        const editor = editorFor("#### Stufe 4");
        try {
            renderToolbar(editor);
            focusEditor(editor);

            const h3Button = screen.getByRole("button", { name: "canvas.toolbar.heading_3" });
            await waitFor(() => expect(h3Button).toHaveAttribute("aria-pressed", "true"));

            await user.click(h3Button);
            await waitFor(() => {
                expect(editor.getHTML()).not.toContain("<h3>");
                expect(editor.getHTML()).not.toContain("<h4>");
            });
        } finally {
            editor.destroy();
        }
    });

    it.each(["##### Stufe 5", "###### Stufe 6"])("toggles agent-authored %s back to normal text with the H3 button", async markdown => {
        const editor = editorFor(markdown);
        try {
            renderToolbar(editor);
            focusEditor(editor);

            const h3Button = screen.getByRole("button", { name: "canvas.toolbar.heading_3" });
            await waitFor(() => expect(h3Button).toHaveAttribute("aria-pressed", "true"));

            await user.click(h3Button);
            await waitFor(() => {
                // The conversion may leave an empty trailing block; only the
                // heading node itself must be gone.
                expect(editor.getHTML()).not.toMatch(/<h[3-6]/);
                expect(editor.getHTML()).toContain(`<p>${markdown.replace(/^#+ /, "")}</p>`);
            });
        } finally {
            editor.destroy();
        }
    });
});
