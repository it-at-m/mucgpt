import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityAssistantStrategy, DeletedCommunityAssistantStrategy, LocalAssistantStrategy, OwnedCommunityAssistantStrategy } from "./AssistantStrategy";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ASSISTANT_STORE } from "../../constants";
import { deleteCommunityAssistantApi, getCommunityAssistantApi, unsubscribeFromAssistantApi } from "../../api/assistant-client";
import { ApiError } from "../../api/fetch-utils";

vi.mock("../../api/assistant-client", () => ({
    createCommunityAssistantApi: vi.fn(),
    deleteCommunityAssistantApi: vi.fn(),
    getCommunityAssistantApi: vi.fn(),
    unsubscribeFromAssistantApi: vi.fn(),
    updateCommunityAssistantApi: vi.fn()
}));

describe("assistant deletion strategies", () => {
    const storage = new AssistantStorageService(ASSISTANT_STORE);

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.spyOn(storage, "deleteChatsForAssistant").mockResolvedValue();
        vi.spyOn(storage, "deleteConfigForAssistant").mockResolvedValue();
        vi.spyOn(storage, "deleteConfigAndChatsForAssistant").mockResolvedValue();
        vi.spyOn(CommunityAssistantStorageService.prototype, "deleteConfigForAssistant").mockResolvedValue();
        vi.mocked(deleteCommunityAssistantApi).mockResolvedValue({ message: "deleted" });
        vi.mocked(unsubscribeFromAssistantApi).mockResolvedValue({ message: "unsubscribed" });
    });

    it("local strategy keeps its chats read-only and removes only the configuration when chats are kept", async () => {
        await new LocalAssistantStrategy().deleteAssistant("assistant", storage, true);
        expect(storage.deleteChatsForAssistant).not.toHaveBeenCalled();
        expect(storage.deleteConfigForAssistant).toHaveBeenCalledWith("assistant");
    });

    it("local strategy deletes chats and configuration when chats are not kept", async () => {
        await new LocalAssistantStrategy().deleteAssistant("assistant", storage, false);
        expect(storage.deleteChatsForAssistant).toHaveBeenCalledWith("assistant");
        expect(vi.mocked(storage.deleteChatsForAssistant).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(storage.deleteConfigForAssistant).mock.invocationCallOrder[0]
        );
    });

    it("subscribed strategy only unsubscribes and retains chats and snapshot", async () => {
        await new CommunityAssistantStrategy().deleteAssistant("assistant");
        expect(unsubscribeFromAssistantApi).toHaveBeenCalledWith("assistant");
        expect(storage.deleteChatsForAssistant).not.toHaveBeenCalled();
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
    });

    it("owned strategy keeps its chats read-only and deletes the assistant when chats are kept", async () => {
        await new OwnedCommunityAssistantStrategy().deleteAssistant("assistant", storage, true);
        expect(deleteCommunityAssistantApi).toHaveBeenCalledWith("assistant");
        expect(storage.deleteChatsForAssistant).not.toHaveBeenCalled();
        expect(vi.mocked(deleteCommunityAssistantApi).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(storage.deleteConfigForAssistant).mock.invocationCallOrder[0]
        );
    });

    it("owned strategy deletes its chats before deleting the assistant when chats are not kept", async () => {
        await new OwnedCommunityAssistantStrategy().deleteAssistant("assistant", storage, false);
        expect(storage.deleteChatsForAssistant).toHaveBeenCalledWith("assistant");
        expect(deleteCommunityAssistantApi).toHaveBeenCalledWith("assistant");
        expect(vi.mocked(storage.deleteChatsForAssistant).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(deleteCommunityAssistantApi).mock.invocationCallOrder[0]
        );
    });

    it("deleted snapshot strategy cleans chats before removing the snapshot and propagates chat cleanup failure", async () => {
        await new DeletedCommunityAssistantStrategy().deleteAssistant("assistant", storage);
        expect(storage.deleteChatsForAssistant).toHaveBeenCalledWith("assistant");
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).toHaveBeenCalledWith("assistant");
        expect(vi.mocked(storage.deleteChatsForAssistant).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).mock.invocationCallOrder[0]
        );

        const failure = new Error("server erasure failed");
        vi.mocked(storage.deleteChatsForAssistant).mockRejectedValue(failure);
        vi.mocked(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).mockClear();
        await expect(new DeletedCommunityAssistantStrategy().deleteAssistant("assistant", storage)).rejects.toBe(failure);
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
    });

    it("subscribed strategy retains nothing to clean up on unsubscribe failure", async () => {
        const failure = new Error("assistant API failed");
        vi.mocked(unsubscribeFromAssistantApi).mockRejectedValue(failure);
        await expect(new CommunityAssistantStrategy().deleteAssistant("assistant")).rejects.toBe(failure);
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
    });

    it("owned strategy retains local configuration on delete failure", async () => {
        const failure = new Error("assistant API failed");
        vi.mocked(deleteCommunityAssistantApi).mockRejectedValue(failure);
        await expect(new OwnedCommunityAssistantStrategy().deleteAssistant("assistant", storage)).rejects.toBe(failure);
        expect(storage.deleteConfigForAssistant).not.toHaveBeenCalled();
    });

    it("subscribed strategy signals a missing config on 404 without a local snapshot", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("not found", 404));
        const config = await new CommunityAssistantStrategy().loadAssistantConfig("assistant");
        expect(config).toBeUndefined();
    });
});
