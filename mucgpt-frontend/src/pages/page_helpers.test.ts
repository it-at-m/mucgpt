import { describe, expect, it, vi } from "vitest";
import type { ChatResponse, Model } from "../api";
import type { StorageService } from "../service/storage";
import type { ChatOptions } from "./chat/Chat";
import { makeApiRequest } from "./page_helpers";

type AgentHandlers = {
    onTextMessageContentEvent: (event: unknown) => void;
    onRunFinishedEvent: (event: unknown) => void;
};

vi.mock("../api/core-client", () => ({
    createChatName: vi.fn(),
    MucgptAgUiAgent: class {
        subscribe() {
            return { unsubscribe: vi.fn() };
        }

        async runAgent(_input: unknown, handlers: AgentHandlers) {
            handlers.onTextMessageContentEvent({ event: { type: "TEXT_MESSAGE_CONTENT", delta: "AG-UI answer" } });
            handlers.onRunFinishedEvent({ event: { type: "RUN_FINISHED", usage: [] } });
        }
    }
}));
vi.mock("i18next", () => ({ default: { t: (key: string) => `t:${key}`, resolvedLanguage: "de" } }));
vi.mock("../api/conversations-client", () => ({ deleteConversationApi: vi.fn() }));

describe("AG-UI chat requests", () => {
    it("streams through the AG-UI client without a legacy chat API", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const dispatch = vi.fn();
        const storage = {
            appendMessage: vi.fn(),
            create: vi.fn(),
            delete: vi.fn()
        } as unknown as StorageService<ChatResponse, ChatOptions>;

        await makeApiRequest(
            [],
            "Question",
            dispatch,
            { id: "test-model", input_cost_per_token: 0, output_cost_per_token: 0 } as Model,
            { current: undefined },
            storage,
            { system: "", creativity: "low" },
            { answer: "", tokens: 0, user_tokens: 0 },
            { current: null },
            { current: false },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            undefined,
            undefined
        );

        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "UPDATE_LAST_ANSWER" }));
    });
});

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
        resolve = res;
    });
    return { promise, resolve };
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe("chat title generation", () => {
    type MakeApiRequestArgs = Parameters<typeof makeApiRequest>;

    const baseArgs = (overrides: Record<number, unknown> = {}): MakeApiRequestArgs => {
        const args = [
            [], // answers
            "Question",
            vi.fn(), // dispatch
            { id: "test-model", input_cost_per_token: 0, output_cost_per_token: 0 } as Model,
            { current: undefined }, // activeChatRef
            null, // storage (replaced per test)
            { system: "sys", creativity: "low" } as ChatOptions,
            { answer: "", tokens: 0, user_tokens: 0 } as ChatResponse,
            { current: null }, // chatMessageStreamEnd
            { current: false }, // isLoadingRef
            vi.fn(), // fetchHistory
            undefined, // assistant_id
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true, // persist
            undefined,
            undefined
        ];
        const result = args as unknown[];
        for (const [index, value] of Object.entries(overrides)) {
            result[Number(index)] = value;
        }
        return result as MakeApiRequestArgs;
    };

    function makeStorage(overrides: Record<string, unknown> = {}) {
        return {
            create: vi.fn().mockResolvedValue("chat-1"),
            appendMessage: vi.fn().mockResolvedValue(undefined),
            get: vi.fn().mockResolvedValue({ name: "Old title", manuallyRenamed: false, messages: [] }),
            renameChat: vi.fn().mockResolvedValue({ name: "New title" }),
            delete: vi.fn(),
            ...overrides
        } as unknown as StorageService<ChatResponse, ChatOptions>;
    }

    it("creates an unnamed placeholder chat on the first send and generates the initial title", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        vi.mocked(createChatName).mockResolvedValue("Generated title");
        const dispatch = vi.fn();
        const fetchHistory = vi.fn();
        const storage = makeStorage();

        await makeApiRequest(...baseArgs({ 1: "Question", 2: dispatch, 4: { current: undefined }, 5: storage, 10: fetchHistory }));
        await vi.waitFor(() => expect(createChatName).toHaveBeenCalledTimes(1));

        // Placeholder chat is created immediately with the unnamed title.
        expect(vi.mocked(storage.create).mock.calls[0][0]).toEqual([]);
        expect(vi.mocked(storage.create).mock.calls[0][2]).toEqual(expect.any(String));
        expect(vi.mocked(storage.create).mock.calls[0][3]).toBe("t:components.history.unnamed_chat");
        // The chat becomes active via the id the storage service returned.
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "SET_ACTIVE_CHAT", payload: "chat-1" }));
        expect(fetchHistory).toHaveBeenCalled();

        // Initial title generation: no previous turn, the placeholder name is
        // sent as the current title so the model can keep it if it fits.
        expect(createChatName).toHaveBeenCalledWith(
            expect.objectContaining({
                conversationId: "chat-1",
                query: "Question",
                systemMessage: "sys",
                language: "de",
                currentTitle: "Old title"
            })
        );
        const titleArgs = vi.mocked(createChatName).mock.calls[0][0];
        expect(titleArgs.previousTurn).toBeUndefined();

        // The generated title replaces the placeholder name.
        expect(storage.renameChat).toHaveBeenCalledWith("chat-1", "Generated title");
        await vi.waitFor(() => expect(fetchHistory).toHaveBeenCalledTimes(2));
    });

    it("regenerates the title on the 3rd turn with the current title and previous turn", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        vi.mocked(createChatName).mockResolvedValue("Better title");
        const storage = makeStorage();

        await makeApiRequest(
            ...baseArgs({
                0: [
                    { user: "First question", response: { answer: "First answer" } },
                    { user: "Second question", response: { answer: "Second answer" } }
                ],
                4: { current: "chat-1" },
                5: storage
            })
        );
        await vi.waitFor(() => expect(createChatName).toHaveBeenCalledTimes(1));

        expect(storage.appendMessage).toHaveBeenCalled();
        expect(createChatName).toHaveBeenCalledWith(
            expect.objectContaining({
                conversationId: "chat-1",
                currentTitle: "Old title",
                previousTurn: { query: "Second question", answer: "Second answer" }
            })
        );
        expect(storage.renameChat).toHaveBeenCalledWith("chat-1", "Better title");
    });

    it.each([[1], [3]])("does not regenerate the title on completed turn %s+1 (even turn)", async (priorTurnCount: number) => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        const storage = makeStorage();
        const answers = Array.from({ length: priorTurnCount }, (_, i) => ({ user: `Q${i}`, response: { answer: `A${i}` } }));

        await makeApiRequest(...baseArgs({ 0: answers, 4: { current: "chat-1" }, 5: storage }));
        await flushMicrotasks();

        expect(createChatName).not.toHaveBeenCalled();
        expect(storage.renameChat).not.toHaveBeenCalled();
    });

    it("skips title generation for manually renamed chats", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        const storage = makeStorage({ get: vi.fn().mockResolvedValue({ name: "My title", manuallyRenamed: true, messages: [] }) });

        await makeApiRequest(
            ...baseArgs({
                0: [
                    { user: "Q", response: { answer: "A" } },
                    { user: "Q2", response: { answer: "A2" } }
                ],
                4: { current: "chat-1" },
                5: storage
            })
        );
        await flushMicrotasks();

        expect(createChatName).not.toHaveBeenCalled();
        expect(storage.renameChat).not.toHaveBeenCalled();
    });

    it("silently ignores a failed title generation", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        vi.mocked(createChatName).mockRejectedValue(new Error("LLM down"));
        const storage = makeStorage();
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        await makeApiRequest(...baseArgs({ 0: [], 4: { current: undefined }, 5: storage }));
        await vi.waitFor(() => expect(createChatName).toHaveBeenCalledTimes(1));
        await flushMicrotasks();

        expect(storage.renameChat).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("skips the rename when the generated title matches the current one", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        vi.mocked(createChatName).mockResolvedValue("Old title");
        const storage = makeStorage();

        await makeApiRequest(...baseArgs({ 0: [], 4: { current: undefined }, 5: storage }));
        await vi.waitFor(() => expect(createChatName).toHaveBeenCalledTimes(1));
        await flushMicrotasks();

        expect(storage.renameChat).not.toHaveBeenCalled();
    });

    it("runs only one title generation per chat (in-flight guard)", async () => {
        vi.stubGlobal("requestAnimationFrame", vi.fn());
        const { createChatName } = await import("../api/core-client");
        const pending = deferred<string>();
        vi.mocked(createChatName).mockImplementation(() => pending.promise);
        const storage = makeStorage();
        const fetchHistory = vi.fn();

        // First send: chat created, initial title generation starts and stays pending.
        await makeApiRequest(...baseArgs({ 2: vi.fn(), 4: { current: undefined }, 5: storage, 10: fetchHistory }));

        // Second send on the same chat reaches the 3rd turn while the first
        // title generation is still running: the in-flight guard skips it.
        const answers = [
            { user: "Q", response: { answer: "A" } },
            { user: "Q2", response: { answer: "A2" } }
        ];
        await makeApiRequest(...baseArgs({ 0: answers, 4: { current: "chat-1" }, 5: storage, 10: fetchHistory }));
        await flushMicrotasks();

        expect(createChatName).toHaveBeenCalledTimes(1);

        // Once the pending generation finishes, the guard is released and the
        // next eligible turn may generate again.
        pending.resolve("Final title");
        await flushMicrotasks();
        expect(storage.renameChat).toHaveBeenCalledWith("chat-1", "Final title");

        vi.mocked(createChatName).mockResolvedValue("Another title");
        const answers2 = [...answers, { user: "Q3", response: { answer: "A3" } }, { user: "Q4", response: { answer: "A4" } }];
        await makeApiRequest(...baseArgs({ 0: answers2, 4: { current: "chat-1" }, 5: storage, 10: fetchHistory }));
        await flushMicrotasks();
        await vi.waitFor(() => expect(createChatName).toHaveBeenCalledTimes(2));
    });
});
