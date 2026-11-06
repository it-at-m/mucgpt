import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCommunityAssistantApi } from "../api/assistant-client";
import { ApiError } from "../api/fetch-utils";
import { CommunityAssistantStorageService } from "../service/communityassistantstorage";
import { CommunityAssistantSnapshot } from "../api/models";
import { resolveOrphanedAssistantChats } from "./orphanedAssistantChats";

vi.mock("../api/assistant-client", () => ({
    getCommunityAssistantApi: vi.fn()
}));

const revokedSnapshot: Partial<CommunityAssistantSnapshot> = {
    snapshot_version: 1,
    id: "a3",
    version: "1",
    title: "Verweigert",
    description: "Kein Zugriff mehr",
    system_message: "Prompt",
    creativity: "low",
    examples: [],
    quick_prompts: [],
    tags: [],
    hierarchical_access: [],
    tools: [],
    is_visible: true
};

const storageWithSnapshot = () =>
    ({
        getAssistantConfig: vi.fn().mockResolvedValue(revokedSnapshot)
    }) as unknown as CommunityAssistantStorageService;

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

    it("marks a 404 as deleted and adds the snapshot details when a local snapshot exists", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("not found", 404));
        const communityAssistantStorageService = storageWithSnapshot();

        const orphans = await resolveOrphanedAssistantChats(["a3"], new Map([["a3", 21]]), communityAssistantStorageService);

        expect(orphans).toEqual([
            { id: "a3", kind: "deleted", title: "Verweigert", description: "Kein Zugriff mehr", snapshot: revokedSnapshot, lastUsed: 21 }
        ]);
    });

    it("marks a 403 as revoked and takes title and description from the local snapshot", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("forbidden", 403));
        const communityAssistantStorageService = storageWithSnapshot();

        const orphans = await resolveOrphanedAssistantChats(["a3"], new Map([["a3", 21]]), communityAssistantStorageService);

        expect(orphans).toEqual([
            { id: "a3", kind: "revoked", title: "Verweigert", description: "Kein Zugriff mehr", snapshot: revokedSnapshot, lastUsed: 21 }
        ]);
    });

    it("marks a 403 as revoked without snapshot details when no storage service is given", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("forbidden", 403));

        const orphans = await resolveOrphanedAssistantChats(["a3"], new Map([["a3", 21]]));

        expect(orphans).toEqual([{ id: "a3", kind: "revoked", lastUsed: 21 }]);
    });

    it("skips hidden assistants so deliberately suppressed ones stay suppressed", async () => {
        vi.mocked(getCommunityAssistantApi).mockResolvedValue({
            id: "a1",
            is_visible: false,
            latest_version: { name: "Hidden", description: "" }
        } as never);

        const orphans = await resolveOrphanedAssistantChats(["a1"], new Map([["a1", 11]]));

        expect(orphans).toEqual([]);
    });

    it("classifies numeric legacy ids by probing the assistant API (404 → deleted)", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("not found", 404));

        const orphans = await resolveOrphanedAssistantChats(["123"], new Map([["123", 4]]));

        expect(orphans).toEqual([{ id: "123", kind: "deleted", lastUsed: 4 }]);
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
