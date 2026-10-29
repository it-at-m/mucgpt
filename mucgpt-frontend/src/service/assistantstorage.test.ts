import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/fetch-utils";
import { ASSISTANT_STORE } from "../constants";
import { AssistantStorageService } from "./assistantstorage";
import { StorageService } from "./storage";

vi.mock("../api/core-client", () => ({ API_BASE: "/api/backend/" }));

describe("assistant cleanup", () => {
    const service = new AssistantStorageService(ASSISTANT_STORE);
    const configId = "BOTCONFIG_assistant_with_underscores";
    const chatId = "CHAT_assistant_with_underscores_thread";
    const assistantId = "assistant_with_underscores";
    const fetchMock = vi.fn<typeof fetch>();
    const record = (id: string) => ({ id, config: {}, messages: [] });

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "" });
        fetchMock.mockReset();
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValue([record(configId), record(chatId), record("CHAT_other_thread")]);
        vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
    });

    afterEach(() => vi.unstubAllGlobals());

    it.each([200, 204, 404])("removes a chat and then its configuration after HTTP %s", async status => {
        fetchMock.mockResolvedValue(new Response(null, { status }));
        await service.deleteConfigAndChatsForAssistant(assistantId);

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/conversations/thread", expect.objectContaining({ method: "DELETE" }));
        expect(StorageService.prototype.delete).toHaveBeenNthCalledWith(1, chatId);
        expect(StorageService.prototype.delete).toHaveBeenNthCalledWith(2, configId);
        expect(StorageService.prototype.delete).toHaveBeenCalledTimes(2);
    });

    it("waits for server completion before touching local records", async () => {
        let complete!: (response: Response) => void;
        fetchMock.mockReturnValue(new Promise(resolve => (complete = resolve)));
        const deletion = service.deleteConfigAndChatsForAssistant(assistantId);
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();

        complete(new Response(null, { status: 204 }));
        await deletion;
        expect(StorageService.prototype.delete).toHaveBeenCalledTimes(2);
    });

    it.each([403, 500, 502, 503, "network"])("retains chat and configuration after %s failure and permits retry", async status => {
        const failure = status === "network" ? new TypeError("Failed to fetch") : new ApiError("Failed to delete conversation", Number(status));
        if (status === "network") fetchMock.mockRejectedValue(failure);
        else fetchMock.mockResolvedValue(new Response(null, { status: Number(status) }));

        await expect(service.deleteConfigAndChatsForAssistant(assistantId)).rejects.toMatchObject({ message: failure.message });
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();

        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        await service.deleteConfigAndChatsForAssistant(assistantId);
        expect(StorageService.prototype.delete).toHaveBeenNthCalledWith(1, chatId);
        expect(StorageService.prototype.delete).toHaveBeenNthCalledWith(2, configId);
    });

    it("keeps completed deletions complete and retains failed and unattempted chats for retry", async () => {
        const remaining = [record(configId), record(chatId), record("CHAT_assistant_with_underscores_failed"), record("CHAT_assistant_with_underscores_next")];
        vi.mocked(StorageService.prototype.getAll).mockImplementation(async () => [...remaining]);
        vi.mocked(StorageService.prototype.delete).mockImplementation(async id => {
            remaining.splice(
                remaining.findIndex(chat => chat.id === id),
                1
            );
            return true;
        });
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 503 }));

        await expect(service.deleteConfigAndChatsForAssistant(assistantId)).rejects.toMatchObject({ status: 503 });
        expect(remaining.map(chat => chat.id)).toEqual([configId, "CHAT_assistant_with_underscores_failed", "CHAT_assistant_with_underscores_next"]);

        fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
        await service.deleteConfigAndChatsForAssistant(assistantId);
        expect(remaining).toEqual([]);
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            "/api/backend/v1/conversations/thread",
            "/api/backend/v1/conversations/failed",
            "/api/backend/v1/conversations/failed",
            "/api/backend/v1/conversations/next"
        ]);
    });

    it("deletes configuration-only records without calling the conversation endpoint", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([record(configId)]);
        await service.deleteConfigAndChatsForAssistant(assistantId);
        await AssistantStorageService.deleteChatOnServer(assistantId, configId);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(StorageService.prototype.delete).toHaveBeenCalledExactlyOnceWith(configId);
    });

    it("chat-only cleanup retains configuration", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        await service.deleteChatsForAssistant(assistantId);
        expect(StorageService.prototype.delete).toHaveBeenCalledExactlyOnceWith(chatId);
    });

    it("does not remove configuration or report success when reading local chats fails", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue(undefined);
        await expect(service.deleteConfigAndChatsForAssistant(assistantId)).rejects.toThrow("Failed to load chats");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();
    });

    it.each(["chat", "configuration"])("propagates local %s deletion failure", async target => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        vi.mocked(StorageService.prototype.delete).mockImplementation(async id => (id === (target === "chat" ? chatId : configId) ? undefined : true));
        await expect(service.deleteConfigAndChatsForAssistant(assistantId)).rejects.toThrow("Failed to delete assistant");
        if (target === "chat") expect(StorageService.prototype.delete).not.toHaveBeenCalledWith(configId);
    });
});
