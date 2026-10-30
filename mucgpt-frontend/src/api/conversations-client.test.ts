import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteConversationApi } from "./conversations-client";
import { ApiError } from "./fetch-utils";

vi.mock("./core-client", () => ({ API_BASE: "/api/backend/" }));

describe("deleteConversationApi", () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf-token" });
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it.each([200, 204, 404])("completes deletion for HTTP %s without requiring a JSON response", async status => {
        fetchMock.mockResolvedValue(new Response(null, { status }));

        await expect(deleteConversationApi("chat/with spaces")).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledWith(
            "/api/backend/v1/conversations/chat%2Fwith%20spaces",
            expect.objectContaining({ method: "DELETE", credentials: "same-origin", redirect: "manual" })
        );
        const headers = fetchMock.mock.calls[0][1]?.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token");
    });

    it.each([400, 401, 403, 500, 502, 503])("propagates HTTP %s as ApiError", async status => {
        fetchMock.mockResolvedValue(new Response(null, { status }));

        const deletion = deleteConversationApi("chat");
        await expect(deletion).rejects.toBeInstanceOf(ApiError);
        await expect(deletion).rejects.toMatchObject({ status });
    });

    it("propagates network failure", async () => {
        const failure = new TypeError("Failed to fetch");
        fetchMock.mockRejectedValue(failure);
        await expect(deleteConversationApi("chat")).rejects.toBe(failure);
    });

    it("preserves authentication redirect rejection and scheduled reload", async () => {
        vi.useFakeTimers();
        const reload = vi.fn();
        vi.stubGlobal("location", { reload });
        fetchMock.mockResolvedValue({ type: "opaqueredirect" } as Response);

        await expect(deleteConversationApi("chat")).rejects.toThrow("Authentifizierungsinformationen");
        expect(reload).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(5000);
        expect(reload).toHaveBeenCalledOnce();
    });
});
