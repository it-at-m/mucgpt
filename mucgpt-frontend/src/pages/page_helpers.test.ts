import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatRequest, ChatResponse, Model } from "../api";
import type { StorageService } from "../service/storage";
import type { ChatOptions } from "./chat/Chat";
import { getConversationActionCapabilities } from "../utils/conversationActions";
import { handleRegenerate, makeApiRequest } from "./page_helpers";

vi.mock("../api/core-client", () => ({ createChatName: vi.fn(), MucgptAgUiAgent: vi.fn() }));

describe("request-mode conversation actions", () => {
    const answers = [{ user: "Question", response: { answer: "Original answer", tokens: 0, user_tokens: 0 } }];
    const dispatch = vi.fn();
    const callApi = vi.fn();
    const popMessage = vi.fn().mockResolvedValue(undefined);
    const appendMessage = vi.fn().mockResolvedValue(undefined);
    const storage = { popMessage, appendMessage } as unknown as StorageService<ChatResponse, ChatOptions>;
    const loading = { current: false };

    const sendRequest = (chatApi: (request: ChatRequest) => Promise<Response>, persist?: boolean) =>
        makeApiRequest(
            answers,
            "Follow-up question",
            dispatch,
            chatApi,
            { llm_name: "test-model" } as Model,
            { current: "thread" },
            storage,
            { system: "", creativity: "low" },
            { answer: "", tokens: 0, user_tokens: 0 },
            { current: null },
            loading,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            persist
        );

    beforeEach(() => {
        vi.clearAllMocks();
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
});
