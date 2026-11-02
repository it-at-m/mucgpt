import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityAssistantStrategy, DeletedCommunityAssistantStrategy, LocalAssistantStrategy, OwnedCommunityAssistantStrategy } from "./AssistantStrategy";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ASSISTANT_STORE } from "../../constants";
import { deleteCommunityAssistantApi, unsubscribeFromAssistantApi } from "../../api/assistant-client";

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

    it.each([new CommunityAssistantStrategy(), new DeletedCommunityAssistantStrategy(), new OwnedCommunityAssistantStrategy()])(
        "%s propagates chat cleanup failure and retains configuration and assistant membership",
        async strategy => {
            const failure = new Error("server erasure failed");
            vi.mocked(storage.deleteChatsForAssistant).mockRejectedValue(failure);

            await expect(strategy.deleteAssistant("assistant", storage)).rejects.toBe(failure);
            expect(storage.deleteConfigForAssistant).not.toHaveBeenCalled();
            expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
            expect(deleteCommunityAssistantApi).not.toHaveBeenCalled();
            expect(unsubscribeFromAssistantApi).not.toHaveBeenCalled();
        }
    );

    it("local strategy awaits combined cleanup and propagates failure", async () => {
        const failure = new Error("server erasure failed");
        vi.mocked(storage.deleteConfigAndChatsForAssistant).mockRejectedValue(failure);
        await expect(new LocalAssistantStrategy().deleteAssistant("assistant", storage)).rejects.toBe(failure);
    });

    it("subscribed strategy cleans chats before unsubscribing and removes the snapshot last", async () => {
        await new CommunityAssistantStrategy().deleteAssistant("assistant", storage);
        expect(storage.deleteChatsForAssistant).toHaveBeenCalledWith("assistant");
        expect(unsubscribeFromAssistantApi).toHaveBeenCalledWith("assistant");
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).toHaveBeenCalledWith("assistant");
        expect(vi.mocked(storage.deleteChatsForAssistant).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(unsubscribeFromAssistantApi).mock.invocationCallOrder[0]
        );
        expect(vi.mocked(unsubscribeFromAssistantApi).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).mock.invocationCallOrder[0]
        );
    });

    it("owned strategy cleans chats before deleting the assistant and removes local configuration last", async () => {
        await new OwnedCommunityAssistantStrategy().deleteAssistant("assistant", storage);
        expect(vi.mocked(storage.deleteChatsForAssistant).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(deleteCommunityAssistantApi).mock.invocationCallOrder[0]
        );
        expect(vi.mocked(deleteCommunityAssistantApi).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(storage.deleteConfigForAssistant).mock.invocationCallOrder[0]
        );
    });

    it.each([new CommunityAssistantStrategy(), new OwnedCommunityAssistantStrategy()])("%s retains configuration on assistant API failure", async strategy => {
        const failure = new Error("assistant API failed");
        vi.mocked(unsubscribeFromAssistantApi).mockRejectedValue(failure);
        vi.mocked(deleteCommunityAssistantApi).mockRejectedValue(failure);
        await expect(strategy.deleteAssistant("assistant", storage)).rejects.toBe(failure);
        expect(storage.deleteConfigForAssistant).not.toHaveBeenCalled();
        expect(CommunityAssistantStorageService.prototype.deleteConfigForAssistant).not.toHaveBeenCalled();
    });
});
