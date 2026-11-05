// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Answer } from "./Answer";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../MarkdownRenderer/MarkdownRenderer", () => ({ MarkdownRenderer: ({ children }: { children: string }) => <p>{children}</p> }));
vi.mock("../AnswerActivity/AnswerActivity", () => ({ AnswerActivity: () => null }));
vi.mock("../FollowUpAction", () => ({ FollowUpActionList: () => <button>Follow-up question</button> }));

class ClipboardItemStub {
    formats: Record<string, Blob>;

    constructor(formats: Record<string, Blob>) {
        this.formats = formats;
    }

    get types(): string[] {
        return Object.keys(this.formats);
    }
}

describe("answer copy", () => {
    const answer = { answer: "Original answer", tokens: 0, user_tokens: 0 };

    afterEach(() => {
        vi.unstubAllGlobals();
        cleanup();
    });

    it("copies the rendered answer as html plus the raw markdown as plain text", async () => {
        const user = userEvent.setup();
        const write = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { write, writeText } });
        vi.stubGlobal("ClipboardItem", ClipboardItemStub);
        render(<Answer answer={answer} isLatest />);

        await user.click(screen.getByRole("button", { name: "components.answer.copy" }));

        expect(write).toHaveBeenCalledTimes(1);
        const item = write.mock.calls[0][0][0] as unknown as ClipboardItemStub;
        expect(item.types).toEqual(["text/html", "text/plain"]);
        expect(await item.formats["text/html"].text()).toContain("<p>Original answer</p>");
        expect(await item.formats["text/plain"].text()).toBe("Original answer");
        expect(writeText).not.toHaveBeenCalled();
    });

    it("copies plain markdown while the unformatted view is active", async () => {
        const user = userEvent.setup();
        const write = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { write, writeText } });
        vi.stubGlobal("ClipboardItem", ClipboardItemStub);
        render(<Answer answer={answer} isLatest />);

        await user.click(screen.getByRole("button", { name: "components.answer.unformat" }));
        await user.click(screen.getByRole("button", { name: "components.answer.copy" }));

        expect(writeText).toHaveBeenCalledWith("Original answer");
        expect(write).not.toHaveBeenCalled();
    });

    it("falls back to plain markdown when rich clipboard writing fails", async () => {
        const user = userEvent.setup();
        const write = vi.fn().mockRejectedValueOnce(new Error("denied"));
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { write, writeText } });
        vi.stubGlobal("ClipboardItem", ClipboardItemStub);
        render(<Answer answer={answer} isLatest />);

        await user.click(screen.getByRole("button", { name: "components.answer.copy" }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith("Original answer"));
    });
});
