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

    it("re-binds browser-only chats too, tolerating a missing server row", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([chatRecord(chatId)]);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await service.transferChatsToAssistant(sourceAssistantId, targetAssistantId);
        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/conversations/thread/assistant", expect.objectContaining({ method: "PATCH" }));
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

describe("assistant chat conversion to normal chats", () => {
    const service = new AssistantStorageService(ASSISTANT_STORE);
    const assistantId = "local_assistant";
    const chatId = "CHAT_local_assistant_thread";
    const fetchMock = vi.fn<typeof fetch>();
    const chatRecord = (id: string, backendPersisted?: boolean, config?: object) => ({
        id,
        config: config ?? {},
        messages: [],
        name: "Mein Chat",
        backendPersisted
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "" });
        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValue([chatRecord(chatId, true, { system_message: "Alter Prompt", creativity: "high" })]);
        vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
        vi.spyOn(StorageService.prototype, "get").mockResolvedValue(undefined);
        vi.spyOn(StorageService.prototype, "connectToDB").mockResolvedValue({
            put: vi.fn().mockResolvedValue(undefined),
            close: vi.fn().mockResolvedValue(undefined)
        } as never);
    });

    afterEach(() => vi.unstubAllGlobals());

    it("detaches chats on the server and re-keys them as normal chats with a mapped config", async () => {
        await service.convertChatsToNormalChats(assistantId);

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/backend/v1/conversations/thread/assistant",
            expect.objectContaining({ method: "PATCH", body: JSON.stringify({ assistant_id: null }) })
        );
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith(
            "chat",
            expect.objectContaining({
                id: "thread",
                name: "Mein Chat",
                config: { system: "Alter Prompt", creativity: "high" }
            })
        );
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);
    });

    it("maps a legacy system config and also detaches browser-only chats", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([chatRecord(chatId, undefined, { system: "Legacy Prompt" })]);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await service.convertChatsToNormalChats(assistantId);

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
            "/api/backend/v1/conversations/thread/assistant",
            expect.objectContaining({ method: "PATCH", body: JSON.stringify({ assistant_id: null }) })
        );
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith("chat", expect.objectContaining({ id: "thread", config: { system: "Legacy Prompt", creativity: "low" } }));
    });

    it("preserves an existing normal chat record instead of overwriting it during conversion", async () => {
        vi.mocked(StorageService.prototype.get).mockImplementation(async (id: string) =>
            id === "thread" ? { id: "thread", config: { system: "Newer Prompt" }, messages: [] } : undefined
        );
        await service.convertChatsToNormalChats(assistantId);

        const db = await StorageService.prototype.connectToDB();
        expect(db.put).not.toHaveBeenCalled();
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);
    });

    it("aborts when the local chat read fails", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue(undefined);
        await expect(service.convertChatsToNormalChats(assistantId)).rejects.toThrow("Failed to load chats");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();
    });

    it("aborts when removing the converted chat record fails, retaining the conversion", async () => {
        vi.mocked(StorageService.prototype.delete).mockResolvedValue(false as never);
        await expect(service.convertChatsToNormalChats(assistantId)).rejects.toThrow("Failed to delete assistant chat");
        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalled();
        expect(StorageService.prototype.get).toHaveBeenCalled();
    });

    it("falls back to the assistant configuration for chats without a stored per-chat config", async () => {
        vi.mocked(StorageService.prototype.getAll).mockResolvedValue([chatRecord(chatId, true)]);
        vi.mocked(StorageService.prototype.get).mockImplementation(async (id: string) =>
            id.startsWith("BOTCONFIG") ? { config: { system_message: "Assistent Prompt", creativity: "medium" }, messages: [] } : undefined
        );
        await service.convertChatsToNormalChats(assistantId);

        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith("chat", expect.objectContaining({ id: "thread", config: { system: "Assistent Prompt", creativity: "medium" } }));
    });

    it("keeps a per-chat system prompt that differs from the assistant configuration", async () => {
        vi.mocked(StorageService.prototype.get).mockImplementation(async (id: string) =>
            id.startsWith("BOTCONFIG") ? { config: { system_message: "Assistent Prompt", creativity: "medium" }, messages: [] } : undefined
        );
        await service.convertChatsToNormalChats(assistantId);

        const db = await StorageService.prototype.connectToDB();
        expect(db.put).toHaveBeenCalledWith("chat", expect.objectContaining({ id: "thread", config: { system: "Alter Prompt", creativity: "high" } }));
    });

    it("tolerates a missing server row (404) but propagates other detach failures without converting", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
        await service.convertChatsToNormalChats(assistantId);
        expect(StorageService.prototype.delete).toHaveBeenCalledWith(chatId);

        fetchMock.mockReset();
        fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
        vi.mocked(StorageService.prototype.delete).mockClear();
        const db = await StorageService.prototype.connectToDB();
        vi.mocked(db.put).mockClear();
        await expect(service.convertChatsToNormalChats(assistantId)).rejects.toMatchObject({ status: 500 });
        expect(db.put).not.toHaveBeenCalled();
        expect(StorageService.prototype.delete).not.toHaveBeenCalled();
    });
});
