import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, ChatResponse, Model } from "../api";
import type { StorageService } from "../service/storage";
import type { ChatOptions } from "./chat/Chat";
import { getConversationActionCapabilities } from "../utils/conversationActions";
import { createChatName } from "../api/core-client";
import { deleteConversationApi } from "../api/conversations-client";
import { ChatProviderError } from "../utils/providerError";
import { handleRegenerate, makeApiRequest } from "./page_helpers";

vi.mock("../api/core-client", () => ({ createChatName: vi.fn(), MucgptAgUiAgent: vi.fn() }));
vi.mock("../api/conversations-client", () => ({ deleteConversationApi: vi.fn() }));

describe("request-mode conversation actions", () => {
    const answers = [{ user: "Question", response: { answer: "Original answer", tokens: 0, user_tokens: 0 } }];
    const dispatch = vi.fn();
    const callApi = vi.fn();
    const fetchHistory = vi.fn();
    const popMessage = vi.fn().mockResolvedValue(undefined);
    const appendMessage = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn();
    const deleteChat = vi.fn();
    const storage = { popMessage, appendMessage, create, delete: deleteChat } as unknown as StorageService<ChatResponse, ChatOptions>;
    const loading = { current: false };

    const sendRequest = (chatApi: (request: ChatRequest) => Promise<Response>, persist?: boolean, activeChat: string | null = "thread", assistantId?: string) =>
        makeApiRequest(
            answers,
            "Follow-up question",
            dispatch,
            chatApi,
            { id: "test-model" } as Model,
            { current: activeChat ?? undefined },
            storage,
            { system: "", creativity: "low" },
            { answer: "", tokens: 0, user_tokens: 0 },
            { current: null },
            loading,
            fetchHistory,
            assistantId,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            persist
        );

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(createChatName).mockResolvedValue("Generated name");
        vi.mocked(deleteConversationApi).mockResolvedValue(undefined);
        create.mockResolvedValue("created-chat-id");
        deleteChat.mockResolvedValue(true);
        loading.current = false;
        vi.useFakeTimers();
        vi.stubGlobal("requestAnimationFrame", vi.fn());
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("defaults to blocking replacement actions before any backendPersisted cache flag exists", () => {
        expect(getConversationActionCapabilities()).toEqual({ canRegenerate: false, canRetry: false });
        expect(getConversationActionCapabilities(true)).toEqual({ canRegenerate: false, canRetry: false });
        expect(getConversationActionCapabilities(false)).toEqual({ canRegenerate: true, canRetry: true });
    });

    it.each([undefined, true])("direct regeneration with persist=%s leaves history and loading untouched", async persist => {
        await handleRegenerate(answers, dispatch, "thread", storage, "system", callApi, loading, persist);
        await vi.runAllTimersAsync();
        expect(popMessage).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(callApi).not.toHaveBeenCalled();
        expect(loading.current).toBe(false);
        expect(answers[0].response.answer).toBe("Original answer");
    });

    it("preserves explicit stateless regeneration when the page has already set its loading indicator", async () => {
        loading.current = true;
        await handleRegenerate(answers, dispatch, "thread", storage, "system", callApi, loading, false);
        expect(popMessage).toHaveBeenCalledOnce();
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_ANSWERS", payload: [] });
        await vi.runAllTimersAsync();
        expect(callApi).toHaveBeenCalledExactlyOnceWith("Question", "system");
    });

    it("does not mutate an empty stateless conversation", async () => {
        await handleRegenerate([], dispatch, "thread", storage, "system", callApi, loading, false);
        expect(popMessage).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(callApi).not.toHaveBeenCalled();
    });

    it("blocks regeneration after a persistence-enabled request fails before local storage is updated", async () => {
        const chatApi = vi.fn().mockRejectedValue(new Error("Failed run may already have a checkpoint"));
        await expect(sendRequest(chatApi)).rejects.toThrow("Failed run may already have a checkpoint");
        expect(chatApi).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ persist: true }));
        expect(appendMessage).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(deleteConversationApi).not.toHaveBeenCalled();
        expect(deleteChat).not.toHaveBeenCalled();
        await handleRegenerate(answers, dispatch, "thread", storage, "system", callApi, loading);
        expect(popMessage).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(callApi).not.toHaveBeenCalled();
        expect(loading.current).toBe(false);
    });

    it.each([undefined, true, false])("normal follow-ups still send exactly one new user turn with persist=%s", async persist => {
        const chatApi = vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"Follow-up answer"}}]}\n\ndata: [DONE]\n\n'));
        await sendRequest(chatApi, persist);
        expect(chatApi).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                conversation_id: "thread",
                persist: persist ?? true,
                history: [
                    { user: "Question", assistant: "Original answer" },
                    { user: "Follow-up question", assistant: undefined }
                ]
            })
        );
        expect(popMessage).not.toHaveBeenCalled();
        if (persist ?? true) expect(appendMessage).toHaveBeenCalledOnce();
        else expect(appendMessage).not.toHaveBeenCalled();
    });

    it("propagates a structured legacy SSE error instead of parsing it as a failed chunk", async () => {
        const errorChunk = {
            id: "error",
            object: "chat.completion.chunk",
            created: 1,
            choices: [{ delta: {}, index: 0, finish_reason: "error" }],
            error: { code: "rate_limited", detail: "status: 429", status_code: 429 }
        };
        const chatApi = vi
            .fn()
            .mockResolvedValue(new Response(`data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: ${JSON.stringify(errorChunk)}\n\n`));

        await expect(sendRequest(chatApi, true)).rejects.toMatchObject({
            name: ChatProviderError.name,
            code: "rate_limited",
            detail: "status: 429"
        });
        await vi.runAllTimersAsync();

        const finalUpdates = dispatch.mock.calls.filter(([action]) => action.type === "UPDATE_LAST_ANSWER");
        expect(finalUpdates).toHaveLength(0);
        expect(appendMessage).not.toHaveBeenCalled();
    });

    it.each([undefined, "assistant-1"])("discards an orphaned failed first conversation and succeeds on retry (assistant=%s)", async assistantId => {
        const errorChunk = {
            id: "error",
            object: "chat.completion.chunk",
            created: 1,
            choices: [{ delta: {}, index: 0, finish_reason: "error" }],
            error: { code: "server_error", detail: "provider failed", status_code: 500 }
        };
        const failedRequest = vi.fn().mockResolvedValue(new Response(`data: ${JSON.stringify(errorChunk)}\n\n`));
        await expect(sendRequest(failedRequest, true, null, assistantId)).rejects.toMatchObject({
            name: ChatProviderError.name,
            code: "server_error"
        });

        const failedConversationId = failedRequest.mock.calls[0][0].conversation_id;
        const expectedLocalId = assistantId ? `CHAT_${assistantId}_${failedConversationId}` : failedConversationId;
        expect(deleteConversationApi).toHaveBeenCalledExactlyOnceWith(failedConversationId);
        expect(deleteChat).toHaveBeenCalledExactlyOnceWith(expectedLocalId);
        expect(fetchHistory).toHaveBeenCalledTimes(1);
        expect(createChatName).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();

        const successfulRequest = vi.fn().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"Retry answer"}}]}\n\ndata: [DONE]\n\n'));
        await sendRequest(successfulRequest, true, null, assistantId);
        await vi.runAllTimersAsync();

        const successfulConversationId = successfulRequest.mock.calls[0][0].conversation_id;
        expect(successfulConversationId).not.toBe(failedConversationId);
        expect(deleteConversationApi).toHaveBeenCalledTimes(1);
        expect(createChatName).toHaveBeenCalledWith(successfulConversationId, "Follow-up question", "Retry answer", "");
        expect(create).toHaveBeenCalledWith(
            [{ user: "Follow-up question", response: expect.objectContaining({ answer: "Retry answer" }) }],
            { system: "", creativity: "low" },
            assistantId ? `CHAT_${assistantId}_${successfulConversationId}` : successfulConversationId,
            "Generated name",
            false
        );
        expect(dispatch).toHaveBeenCalledWith({ type: "SET_ACTIVE_CHAT", payload: "created-chat-id" });
    });

    it("does not discard a non-persisted failed request", async () => {
        const chatApi = vi.fn().mockRejectedValue(new Error("stateless failure"));
        await expect(sendRequest(chatApi, false, null)).rejects.toThrow("stateless failure");

        expect(deleteConversationApi).not.toHaveBeenCalled();
        expect(deleteChat).not.toHaveBeenCalled();
        expect(fetchHistory).not.toHaveBeenCalled();
    });

    it("maps a gateway status for a failed first request and surfaces it in the error", async () => {
        const chatApi = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "gateway rejected the request" }), { status: 429 }));
        await expect(sendRequest(chatApi, true, null)).rejects.toMatchObject({
            name: ChatProviderError.name,
            code: "rate_limited",
            statusCode: 429
        });

        expect(deleteConversationApi).toHaveBeenCalledTimes(1);
        expect(fetchHistory).toHaveBeenCalledTimes(1);
    });

    it("propagates the original provider error when orphan cleanup fails", async () => {
        const errorChunk = {
            id: "error",
            object: "chat.completion.chunk",
            created: 1,
            choices: [{ delta: {}, index: 0, finish_reason: "error" }],
            error: { code: "connection_error", detail: "provider unreachable", status_code: null }
        };
        vi.mocked(deleteConversationApi).mockRejectedValueOnce(new Error("delete failed"));
        const chatApi = vi.fn().mockResolvedValue(new Response(`data: ${JSON.stringify(errorChunk)}\n\n`));

        await expect(sendRequest(chatApi, true, null)).rejects.toMatchObject({
            name: ChatProviderError.name,
            code: "connection_error"
        });

        expect(deleteChat).not.toHaveBeenCalled();
        expect(fetchHistory).toHaveBeenCalledTimes(1);
    });
});
