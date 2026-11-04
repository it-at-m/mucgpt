import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommunityAssistantApi } from "../api/assistant-client";
import { ApiError } from "../api/fetch-utils";
import { resolveOrphanedAssistantChats } from "./orphanedAssistantChats";

vi.mock("../api/assistant-client", () => ({
    getCommunityAssistantApi: vi.fn()
}));

describe("resolveOrphanedAssistantChats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks a live assistant response as unsubscribed and keeps its title", async () => {
        vi.mocked(getCommunityAssistantApi).mockResolvedValue({
            id: "a1",
            latest_version: { name: "Title", description: "Desc" }
        } as never);

        const orphans = await resolveOrphanedAssistantChats(["a1"], new Map([["a1", 42]]));

        expect(orphans).toEqual([{ id: "a1", kind: "unsubscribed", title: "Title", description: "Desc", lastUsed: 42 }]);
    });

    it("marks a 404 as deleted", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("not found", 404));

        const orphans = await resolveOrphanedAssistantChats(["a1"], new Map([["a1", 7]]));

        expect(orphans).toEqual([{ id: "a1", kind: "deleted", lastUsed: 7 }]);
    });

    it("skips assistants on other errors and sorts the rest by last usage", async () => {
        vi.mocked(getCommunityAssistantApi).mockImplementation(id => {
            if (id === "a1") return Promise.resolve({ id, latest_version: { name: "First", description: "" } } as never);
            if (id === "a2") return Promise.reject(new ApiError("not found", 404));
            return Promise.reject(new Error("network down"));
        });
        vi.spyOn(console, "error").mockImplementation(() => {});

        const orphans = await resolveOrphanedAssistantChats(
            ["a1", "a2", "a3"],
            new Map([
                ["a1", 3],
                ["a2", 5],
                ["a3", 9]
            ])
        );

        expect(orphans).toEqual([
            { id: "a2", kind: "deleted", lastUsed: 5 },
            { id: "a1", kind: "unsubscribed", title: "First", description: "", lastUsed: 3 }
        ]);
    });
});
