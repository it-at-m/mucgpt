import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/fetch-utils";
import type { ChatResponse } from "../api/models";
import { getConversationMessagesApi, listConversationsApi } from "../api/conversations-client";
import { StorageService } from "./storage";
import { ASSISTANT_STORE, CHAT_STORE } from "../constants";
import { loadConversation, syncConversationHistory, toChatTurns } from "./conversationHistory";

vi.mock("../api/conversations-client", () => ({
    getConversationMessagesApi: vi.fn(),
    listConversationsApi: vi.fn()
}));

describe("conversation history", () => {
    const put = vi.fn();
    const close = vi.fn();

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.spyOn(StorageService.prototype, "connectToDB").mockResolvedValue({ put, close } as never);
        vi.spyOn(StorageService.prototype, "get").mockResolvedValue(undefined);
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValue([]);
    });

    it("restores ordinary and assistant metadata in an empty browser without fetching transcripts", async () => {
        vi.mocked(listConversationsApi).mockResolvedValue([
            { conversation_id: "normal", assistant_id: null, title: "Normal chat", created_at: "2026-10-20T10:00:00Z", updated_at: "2026-10-20T10:00:00Z" },
            {
                conversation_id: "thread",
                assistant_id: "assistant-id",
                title: "Assistant chat",
                created_at: "2026-10-20T10:00:00Z",
                updated_at: "2026-10-20T10:00:00Z"
            }
        ]);

        await syncConversationHistory();

        expect(put).toHaveBeenCalledWith(CHAT_STORE.objectStore_name, expect.objectContaining({ id: "normal", name: "Normal chat", messages: [] }));
        expect(put).toHaveBeenCalledWith(
            ASSISTANT_STORE.objectStore_name,
            expect.objectContaining({ id: "CHAT_assistant-id_thread", name: "Assistant chat", messages: [] })
        );
        expect(getConversationMessagesApi).not.toHaveBeenCalled();
    });

    it("keeps a legacy assistant chat associated locally rather than duplicating it", async () => {
        vi.mocked(StorageService.prototype.getAll)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "CHAT_assistant-id_thread", name: "Local title", favorite: true, config: {}, messages: [] }]);
        vi.mocked(listConversationsApi).mockResolvedValue([
            { conversation_id: "thread", assistant_id: null, title: "Server title", created_at: "2026-10-20T10:00:00Z", updated_at: "2026-10-20T10:00:00Z" }
        ]);

        await syncConversationHistory();

        expect(put).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledWith(
            ASSISTANT_STORE.objectStore_name,
            expect.objectContaining({ id: "CHAT_assistant-id_thread", name: "Server title", favorite: true })
        );
    });

    it.each([
        { id: "thread", assistant_id: null, store: CHAT_STORE },
        { id: "CHAT_assistant-id_thread", assistant_id: "assistant-id", store: ASSISTANT_STORE }
    ])("refreshes cached titles from server metadata for $id", async ({ id, assistant_id, store }) => {
        const cached = [{ id, name: "Old title", backendPersisted: true, favorite: true, config: {}, messages: [] }];
        vi.mocked(StorageService.prototype.getAll)
            .mockResolvedValueOnce(assistant_id ? [] : cached)
            .mockResolvedValueOnce(assistant_id ? cached : []);
        vi.mocked(listConversationsApi).mockResolvedValue([
            {
                conversation_id: "thread",
                assistant_id,
                title: "Renamed on another device",
                created_at: "2026-10-20T10:00:00Z",
                updated_at: "2026-10-20T11:00:00Z"
            }
        ]);

        await syncConversationHistory();

        expect(put).toHaveBeenCalledWith(store.objectStore_name, expect.objectContaining({ id, name: "Renamed on another device", favorite: true }));
    });

    it("converts messages into turns including multiple assistant messages and an unanswered question", () => {
        expect(
            toChatTurns([
                { role: "system", content: "Instructions" },
                { role: "user", content: "Question" },
                { role: "assistant", content: "First" },
                { role: "assistant", content: "Second" },
                { role: "user", content: "Next question" }
            ])
        ).toEqual([
            { user: "Question", response: { answer: "First\n\nSecond" } },
            { user: "Next question", response: { answer: "" } }
        ]);
    });

    it("removes server-deleted cached chats while retaining local-only history", async () => {
        vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
        vi.mocked(StorageService.prototype.getAll)
            .mockResolvedValueOnce([
                { id: "deleted", backendPersisted: true, config: {}, messages: [] },
                { id: "local-only", config: {}, messages: [] }
            ])
            .mockResolvedValueOnce([{ id: "CHAT_assistant-id_deleted-thread", backendPersisted: true, config: {}, messages: [] }]);
        vi.mocked(listConversationsApi).mockResolvedValue([]);

        await syncConversationHistory();

        expect(StorageService.prototype.delete).toHaveBeenCalledTimes(2);
        expect(StorageService.prototype.delete).toHaveBeenCalledWith("deleted");
        expect(StorageService.prototype.delete).toHaveBeenCalledWith("CHAT_assistant-id_deleted-thread");
    });

    it.each(["assistant-id", null])("retains an underscored assistant conversation and its cached metadata (assistant_id: %s)", async assistant_id => {
        const cached = {
            id: "CHAT_assistant-id_thread_part",
            name: "Local title",
            backendPersisted: true,
            favorite: true,
            config: { system: "Cached instructions" },
            messages: [{ user: "Question", response: { answer: "Cached answer", tokens: 42 } }],
            _last_edited: Date.parse("2026-10-20T12:00:00Z")
        };
        const deleteChat = vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
        vi.mocked(StorageService.prototype.getAll).mockResolvedValueOnce([]).mockResolvedValueOnce([cached]);
        vi.mocked(listConversationsApi).mockResolvedValue([
            {
                conversation_id: "thread_part",
                assistant_id,
                title: "Server title",
                created_at: "2026-10-20T10:00:00Z",
                updated_at: "2026-10-20T11:00:00Z"
            }
        ]);

        await syncConversationHistory();

        expect(deleteChat).not.toHaveBeenCalled();
        expect(put).toHaveBeenCalledExactlyOnceWith(ASSISTANT_STORE.objectStore_name, { ...cached, name: "Server title" });
    });

    it("removes an assistant cache row when the server conversation belongs to another assistant", async () => {
        const deleteChat = vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
        vi.mocked(StorageService.prototype.getAll)
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "CHAT_other-assistant_thread_part", backendPersisted: true, config: {}, messages: [] }]);
        vi.mocked(listConversationsApi).mockResolvedValue([
            {
                conversation_id: "thread_part",
                assistant_id: "assistant-id",
                title: "Server title",
                created_at: "2026-10-20T10:00:00Z",
                updated_at: "2026-10-20T11:00:00Z"
            }
        ]);

        await syncConversationHistory();

        expect(deleteChat).toHaveBeenCalledExactlyOnceWith("CHAT_other-assistant_thread_part");
        expect(put).toHaveBeenCalledWith(ASSISTANT_STORE.objectStore_name, expect.objectContaining({ id: "CHAT_assistant-id_thread_part" }));
    });

    it("fetches an assistant transcript using its backend id and caches it with the local prefix", async () => {
        vi.mocked(getConversationMessagesApi).mockResolvedValue([
            { role: "user", content: "Question" },
            { role: "assistant", content: "Answer" }
        ]);
        const storage = new StorageService<ChatResponse, { system: string }>(ASSISTANT_STORE);

        const chat = await loadConversation(storage, "CHAT_assistant-id_thread", "thread", { system: "Assistant prompt" });

        expect(getConversationMessagesApi).toHaveBeenCalledWith("thread");
        expect(chat.messages).toEqual([{ user: "Question", response: { answer: "Answer" } }]);
        expect(put).toHaveBeenCalledWith(ASSISTANT_STORE.objectStore_name, expect.objectContaining({ id: "CHAT_assistant-id_thread" }));
    });

    it("restores server tool steps in a fresh browser and keeps them on the correct turn", async () => {
        vi.mocked(getConversationMessagesApi).mockResolvedValue([
            {
                role: "user",
                content: "Question",
                activity_steps: [
                    { tool_call_id: "search", tool_name: "InternetSearch", status: "done", description: "Search Kita fees", detail: "Kita fees" },
                    { tool_call_id: "read", tool_name: "web_url_read", status: "error", description: null, detail: "https://muenchen.de" }
                ]
            },
            { role: "assistant", content: "Answer" },
            { role: "user", content: "Next question" },
            { role: "assistant", content: "Next answer" }
        ]);
        const storage = new StorageService<ChatResponse, Record<string, never>>(CHAT_STORE);

        const chat = await loadConversation(storage, "thread", "thread", {});

        expect(chat.messages[0].response.activitySteps).toEqual([
            { toolCallId: "search", toolName: "InternetSearch", status: "done", description: "Search Kita fees", detail: "Kita fees" },
            { toolCallId: "read", toolName: "web_url_read", status: "error", detail: "https://muenchen.de" }
        ]);
        expect(chat.messages[1].response.activitySteps).toBeUndefined();
        expect(put).toHaveBeenCalledWith(CHAT_STORE.objectStore_name, chat);
    });

    it("uses server steps while preserving matching local timings and usage", async () => {
        vi.mocked(StorageService.prototype.get).mockResolvedValue({
            id: "thread",
            config: {},
            messages: [
                {
                    user: "Question",
                    response: {
                        answer: "Answer",
                        tokens: 42,
                        activitySteps: [
                            { toolCallId: "search", toolName: "InternetSearch", status: "running", startedAt: 1000, endedAt: 3000 },
                            { toolCallId: "stale", toolName: "search", status: "done" }
                        ]
                    }
                }
            ]
        });
        vi.mocked(getConversationMessagesApi).mockResolvedValue([
            {
                role: "user",
                content: "Question",
                activity_steps: [{ tool_call_id: "search", tool_name: "InternetSearch", status: "done", description: "Search fees" }]
            },
            { role: "assistant", content: "Answer" }
        ]);
        const storage = new StorageService<ChatResponse, Record<string, never>>(CHAT_STORE);

        const chat = await loadConversation(storage, "thread", "thread", {});

        expect(chat.messages[0].response.tokens).toBe(42);
        expect(chat.messages[0].response.activitySteps).toEqual([
            { toolCallId: "search", toolName: "InternetSearch", status: "done", description: "Search fees", startedAt: 1000, endedAt: 3000 }
        ]);
    });

    it("restores per-turn context usage and historical model limits in an empty browser", async () => {
        const firstUsage = {
            context_tokens: 240,
            user_tokens: 300,
            tokens: 60,
            usage_cost: 0.04,
            usage_model: "first",
            usage_max_input_tokens: 10000,
            usage_context_warning_threshold_percent: 60,
            usage_context_critical_threshold_percent: 80
        };
        const secondUsage = { context_tokens: 450, usage_model: "second", usage_max_input_tokens: 20000 };
        vi.mocked(getConversationMessagesApi).mockResolvedValue([
            { role: "user", content: "Question", usage: firstUsage },
            { role: "assistant", content: "Answer" },
            { role: "user", content: "Next question", usage: secondUsage },
            { role: "assistant", content: "Next answer" }
        ]);
        const storage = new StorageService<ChatResponse, Record<string, never>>(CHAT_STORE);

        const chat = await loadConversation(storage, "thread", "thread", {});

        expect(chat.messages[0].response).toEqual({ answer: "Answer", ...firstUsage });
        expect(chat.messages[1].response).toEqual({ answer: "Next answer", ...secondUsage });
    });

    it("prefers server usage over stale cache and retains unavailable legacy fields", async () => {
        vi.mocked(StorageService.prototype.get).mockResolvedValue({
            id: "thread",
            config: {},
            messages: [
                {
                    user: "Question",
                    response: {
                        answer: "Answer",
                        context_tokens: 1,
                        tokens: 60,
                        usage_cost: 0.04,
                        usage_model: "first",
                        usage_max_input_tokens: 10000
                    }
                }
            ]
        });
        vi.mocked(getConversationMessagesApi).mockResolvedValue([
            { role: "user", content: "Question", usage: { context_tokens: 240 } },
            { role: "assistant", content: "Answer" }
        ]);
        const storage = new StorageService<ChatResponse, Record<string, never>>(CHAT_STORE);

        const chat = await loadConversation(storage, "thread", "thread", {});

        expect(chat.messages[0].response).toMatchObject({ context_tokens: 240, tokens: 60, usage_cost: 0.04, usage_max_input_tokens: 10000 });
    });

    it("allows local-only transcripts on 404 but surfaces authorization and server errors", async () => {
        const cached = { id: "local", backendPersisted: true, config: {}, messages: [{ user: "Question", response: { answer: "Answer" } }] };
        vi.mocked(StorageService.prototype.get).mockResolvedValue(cached);
        const storage = new StorageService<ChatResponse, Record<string, never>>(CHAT_STORE);
        vi.mocked(getConversationMessagesApi).mockRejectedValue(new ApiError("Missing", 404));
        expect(await loadConversation(storage, "local", "local", {})).toBe(cached);

        for (const status of [403, 500]) {
            vi.mocked(getConversationMessagesApi).mockRejectedValue(new ApiError("Failed", status));
            await expect(loadConversation(storage, "local", "local", {})).rejects.toMatchObject({ status });
        }
        vi.mocked(StorageService.prototype.get).mockResolvedValue({ ...cached, backendPersisted: false });
        vi.mocked(getConversationMessagesApi).mockRejectedValue(new ApiError("No ownership row", 403));
        expect((await loadConversation(storage, "local", "local", {})).messages).toEqual(cached.messages);
    });
});
