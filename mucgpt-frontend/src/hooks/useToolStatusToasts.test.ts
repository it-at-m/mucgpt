// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToastMessage } from "../components/GlobalToastHandler/types";
import { useGlobalToastContext } from "../components/GlobalToastHandler/GlobalToastContext";
import { useToolStatusToasts } from "./useToolStatusToasts";
import { ToolStreamState, type ToolStatus } from "../utils/ToolStreamHandler";

vi.mock("../components/GlobalToastHandler/GlobalToastContext", async importOriginal => {
    const actual = await importOriginal<typeof import("../components/GlobalToastHandler/GlobalToastContext")>();
    return { ...actual, useGlobalToastContext: vi.fn() };
});

const status = (name: string, state: ToolStatus["state"], message = "", timestamp = 1): ToolStatus => ({ name, state, message, timestamp });

describe("useToolStatusToasts", () => {
    let toasts: ToastMessage[];
    let showLoadingToast: ReturnType<typeof vi.fn>;
    let showToast: ReturnType<typeof vi.fn>;
    let updateToast: ReturnType<typeof vi.fn>;
    let dismissToast: ReturnType<typeof vi.fn>;

    const renderWith = (activeTools: ToolStatus[]) => renderHook(({ tools }) => useToolStatusToasts(tools), { initialProps: { tools: activeTools } });

    beforeEach(() => {
        toasts = [];
        showLoadingToast = vi.fn().mockImplementation((title: string) => `loading-${title}`);
        showToast = vi.fn().mockImplementation(() => "one-off-toast");
        updateToast = vi.fn();
        dismissToast = vi.fn();
        vi.mocked(useGlobalToastContext).mockImplementation(
            () =>
                ({
                    toasts,
                    showToast,
                    showSuccess: vi.fn(),
                    showError: vi.fn(),
                    showWarning: vi.fn(),
                    showInfo: vi.fn(),
                    showLoadingToast,
                    updateToast,
                    dismissToast
                }) as never
        );
    });

    it("shows a persistent loading toast when a tool starts", () => {
        renderWith([status("Web Search", ToolStreamState.STARTED, "suche…")]);

        expect(showLoadingToast).toHaveBeenCalledExactlyOnceWith("Web Search", "suche…", {
            persistent: true,
            showIcon: true,
            dismissible: true
        });
        expect(showToast).not.toHaveBeenCalled();
        expect(updateToast).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when the tool sends none", () => {
        renderWith([status("Web Search", ToolStreamState.STARTED)]);

        expect(showLoadingToast).toHaveBeenCalledWith("Web Search", "Processing...", expect.anything());
    });

    it("updates the existing loading toast when the same tool starts again", () => {
        const { rerender } = renderWith([status("Web Search", ToolStreamState.STARTED, "first")]);

        rerender({ tools: [status("Web Search", ToolStreamState.STARTED, "second", 2)] });

        expect(showLoadingToast).toHaveBeenCalledOnce();
        expect(updateToast).toHaveBeenCalledExactlyOnceWith("loading-Web Search", {
            type: "loading",
            title: "Web Search",
            message: "second",
            persistent: true,
            showIcon: true,
            dismissible: true
        });
    });

    it("does not process the same tool status twice", () => {
        const tool = status("Web Search", ToolStreamState.STARTED, "suche…");
        const { rerender } = renderWith([tool]);
        rerender({ tools: [tool] });
        rerender({ tools: [tool] });

        expect(showLoadingToast).toHaveBeenCalledOnce();
    });

    it("promotes an active loading toast to a timed success toast on tool end", () => {
        const { rerender } = renderWith([status("Web Search", ToolStreamState.STARTED, "läuft")]);
        // the toast context meanwhile reports the active loading toast
        toasts = [{ id: "loading-Web Search" } as ToastMessage];

        rerender({ tools: [status("Web Search", ToolStreamState.ENDED, "fertig")] });

        expect(updateToast).toHaveBeenCalledWith("loading-Web Search", {
            type: "success",
            title: "Web Search",
            message: "fertig",
            persistent: false,
            timeout: 4000,
            showIcon: true,
            dismissible: true
        });
        expect(showToast).not.toHaveBeenCalled();
    });

    it("shows a standalone success toast when the loading toast is already gone", () => {
        renderWith([status("Web Search", ToolStreamState.ENDED, "fertig")]);

        expect(showToast).toHaveBeenCalledExactlyOnceWith({
            type: "success",
            title: "Web Search",
            message: "fertig",
            timeout: 4000,
            showIcon: true,
            dismissible: true
        });
        expect(updateToast).not.toHaveBeenCalled();
    });

    it("ignores tool statuses without a state and unknown states", () => {
        renderWith([status("Alpha", null), status("Beta", null, "text")]);

        expect(showLoadingToast).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
    });

    it("dismisses all loading toasts once no tool is active anymore", () => {
        const { rerender } = renderWith([status("Web Search", ToolStreamState.STARTED, "läuft")]);
        expect(showLoadingToast).toHaveBeenCalledOnce();

        rerender({ tools: [] });

        expect(dismissToast).toHaveBeenCalledWith("loading-Web Search");
    });

    it("dismisses remaining loading toasts on unmount", () => {
        const { unmount } = renderWith([status("Web Search", ToolStreamState.STARTED, "läuft")]);

        unmount();

        expect(dismissToast).toHaveBeenCalledWith("loading-Web Search");
    });
});
