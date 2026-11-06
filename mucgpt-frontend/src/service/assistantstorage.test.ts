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

describe("assistant chat transfer", () => {
    const service = new AssistantStorageService(ASSISTANT_STORE);
    const sourceAssistantId = "source_assistant";
    const targetAssistantId = "target_assistant";
    const chatId = "CHAT_source_assistant_thread";
    const fetchMock = vi.fn<typeof fetch>();
    const chatRecord = (id: string, backendPersisted?: boolean) => ({ id, config: {}, messages: [], backendPersisted });

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "" });
        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValue([chatRecord(chatId, true)]);
        vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
        vi.spyOn(StorageService.prototype, "connectToDB").mockResolvedValue({
            put: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined)
        } as never);
    });

    afterEach(() => vi.unstubAllGlobals());

    it("re-binds persisted chats on the server before re-keying them locally", async () => {
        await service.transferChatsToAssistant(sourceAssistantId, targetAssistantId);

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/backend/v1/conversations/thread/assistant",
            expect.objectContaining({ method: "PATCH", body: JSON.stringify({ assistant_id: targetAssistantId }) })
        );
        expect(StorageService.prototype.connectToDB).toHaveBeenCalled();
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "CHAT_target_assistant_thread" }));
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);
    });

    it("removes each source record right after its successful transfer, so a mid-loop failure leaves no duplicated chats", async () => {
        const firstChat = chatRecord("CHAT_source_assistant_first", true);
        const secondChat = chatRecord("CHAT_source_assistant_second", true);
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([firstChat, secondChat]);
        const deletedIds: string[] = [];
        vi.mocked(StorageService.prototype.delete).mockImplementation(async id => {
            deletedIds.push(String(id));
            return true;
        });
        fetchMock.mockImplementation(input => {
            const conversationId = String(input).split("/conversations/")[1]?.split("/")[0];
            return Promise.resolve(new Response(null, { status: conversationId === "first" ? 204 : 500 }));
        });

        await expect(service.transferChatsToAssistant(sourceAssistantId, targetAssistantId)).rejects.toMatchObject({ status: 500 });

        // The first chat is fully moved (put + source delete) before the second
        // one fails, so the failure never leaves it under both assistant ids.
        expect(deletedIds).toEqual(["CHAT_source_assistant_first"]);
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledTimes(1);
        expect(db.put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "CHAT_target_assistant_first" }));
    });

    it("re-binds browser-only chats too, tolerating a missing server row", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([chatRecord(chatId)]);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await service.transferChatsToAssistant(sourceAssistantId, targetAssistantId);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/conversations/thread/assistant", expect.objectContaining({ method: "PATCH" }));
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);
    });

    it("tolerates a retired conversation row (403) and keeps the local transfer going", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([chatRecord(chatId)]);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
        await service.transferChatsToAssistant(sourceAssistantId, targetAssistantId);

        expect(StorageService.prototype.connectToDB).toHaveBeenCalled();
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "CHAT_target_assistant_thread" }));
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);
    });

    it("tolerates a missing server row (404) but propagates other re-bind failures without touching local records", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await service.transferChatsToAssistant(sourceAssistantId, targetAssistantId);
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
        vi.mocked(StorageService.prototype.delete).mockClear();
        await expect(service.transferChatsToAssistant(sourceAssistantId, targetAssistantId)).rejects.toMatchObject({ status: 500 });
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();
    });
});
