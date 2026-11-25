// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExternalLinkDialog } from "./ExternalLinkDialog";
import { allowForSession, dismissExternalLink, isAllowedForSession, openExternalUrl, requestExternalLink } from "./externalLinkGuard";

const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);

beforeEach(() => {
    windowOpen.mockClear();
    dismissExternalLink();
});

describe("externalLinkGuard", () => {
    it("requests, dismisses and session-allows URLs", () => {
        act(() => requestExternalLink("https://evil.example.com/p"));
        expect(screen.queryByText("https://evil.example.com/p")).toBeNull();

        act(() => dismissExternalLink());
        expect(isAllowedForSession("https://evil.example.com/p")).toBe(false);

        act(() => allowForSession("https://evil.example.com/p"));
        expect(isAllowedForSession("https://evil.example.com/p")).toBe(true);
    });

    it("opens web targets in a new tab and mailto targets via anchor", () => {
        openExternalUrl("https://example.org/x");
        expect(windowOpen).toHaveBeenCalledWith("https://example.org/x", "_blank", "noopener,noreferrer");

        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
        openExternalUrl("mailto:support@muenchen.de");
        expect(clickSpy).toHaveBeenCalled();
        expect(windowOpen).toHaveBeenCalledTimes(1);
        clickSpy.mockRestore();
    });
});

describe("ExternalLinkDialog", () => {
    it("opens on request, cancels without navigation and clears the request", () => {
        render(<ExternalLinkDialog />);
        act(() => requestExternalLink("https://evil.example.com/x"));
        expect(screen.getByText("external_link.title")).toBeTruthy();
        expect(screen.getByText(/evil\.example\.com\/x/)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "external_link.cancel" }));
        expect(windowOpen).not.toHaveBeenCalled();
        expect(screen.queryByText("external_link.title")).toBeNull();
    });

    it("opens the URL on confirmation and remembers it when the checkbox is set", () => {
        render(<ExternalLinkDialog />);
        act(() => requestExternalLink("https://evil.example.com/y"));

        fireEvent.click(screen.getByRole("button", { name: "external_link.open" }));
        expect(windowOpen).toHaveBeenCalledWith("https://evil.example.com/y", "_blank", "noopener,noreferrer");
        expect(isAllowedForSession("https://evil.example.com/y")).toBe(false);

        act(() => requestExternalLink("https://evil.example.com/z"));
        fireEvent.click(screen.getByRole("checkbox"));
        fireEvent.click(screen.getByRole("button", { name: "external_link.open" }));
        expect(windowOpen).toHaveBeenLastCalledWith("https://evil.example.com/z", "_blank", "noopener,noreferrer");
        expect(isAllowedForSession("https://evil.example.com/z")).toBe(true);
        expect(screen.queryByText("external_link.title")).toBeNull();
    });
});
