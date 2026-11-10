// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerError } from "./AnswerError";
import { ChatProviderError } from "../../utils/providerError";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("AnswerError details dialog", () => {
    const detail = "exception: openai.InternalServerError\nbody: {..secret..}";
    const error = new ChatProviderError("server_error", detail, undefined, 500);
    const writeText = vi.fn();

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    const renderClosedError = () => {
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        return render(<AnswerError error={error} />);
    };

    it("shows technical details only inside the opened dialog", async () => {
        const user = userEvent.setup();
        renderClosedError();

        expect(screen.getByText("common.errors.provider.server_error")).toBeInTheDocument();
        expect(screen.queryByText(/secret/)).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "common.errors.provider.details" }));
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText(/secret/)).toBeInTheDocument();
        expect(within(dialog).getByText(/HTTP status: 500/)).toBeInTheDocument();
    });

    it("confirms a successful copy", async () => {
        const user = userEvent.setup();
        writeText.mockResolvedValue(undefined);
        renderClosedError();

        await user.click(screen.getByRole("button", { name: "common.errors.provider.details" }));
        await user.click(screen.getByRole("button", { name: "common.errors.provider.copy_details" }));

        expect(writeText).toHaveBeenCalledWith(expect.stringContaining("secret"));
        expect(screen.getByRole("button", { name: "common.errors.provider.details_copied" })).toBeInTheDocument();
    });

    it("shows feedback when copying fails", async () => {
        const user = userEvent.setup();
        writeText.mockRejectedValueOnce(new Error("clipboard unavailable"));
        renderClosedError();

        await user.click(screen.getByRole("button", { name: "common.errors.provider.details" }));
        await user.click(screen.getByRole("button", { name: "common.errors.provider.copy_details" }));

        expect(screen.getByRole("button", { name: "common.errors.provider.details_copy_failed" })).toBeInTheDocument();
    });
});
