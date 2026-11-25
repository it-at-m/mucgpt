import { beforeEach, describe, expect, it, vi } from "vitest";
import { validate as isUuid } from "uuid";
import { ApiError, handleApiRequest } from "../../api/fetch-utils";
import type { ChatResponse } from "../../api/models";
import { ASSISTANT_STORE, CHAT_STORE } from "../../constants";
import { StorageService, type DBObject } from "../storage";
import { migrateLocalChatsToBackend, type ImportConversationPayload } from "./chatMigration";

vi.mock("../../api/fetch-utils", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/fetch-utils")>()),
    handleApiRequest: vi.fn(),
    // the real one reads the xsrf cookie, there is no document in node
    postConfig: (body: unknown) => ({ method: "POST", body: JSON.stringify(body) })
}));

const CHAT_ID = "2f0f1b52-8a5e-4c3a-9a51-1b9a3f6e2c11";
const OTHER_ID = "7c1d9e3a-4b2f-4d6e-8f10-2a3b4c5d6e7f";
const ASSISTANT_ID = "a8e4c2d1-5f6b-4a7c-9d8e-0f1a2b3c4d5e";
const LAST_EDITED = Date.UTC(2025, 2, 1, 12, 0);

type Chat = DBObject<ChatResponse, unknown>;

function chat(overrides: Partial<Chat> = {}): Chat {
    return {
        id: CHAT_ID,
        name: "Kita Gebühren",
        favorite: true,
        _last_edited: LAST_EDITED,
        config: {},
        messages: [{ user: "q1", response: { answer: "a1" } }],
        ...overrides
    };
}

describe("chat migration", () => {
    const put = vi.fn();
    const del = vi.fn();
    const close = vi.fn();
    const transaction = vi.fn(() => ({ store: { put, delete: del }, done: Promise.resolve() }));

    /** Local chats per store: [chat store, assistant store]. */
    function localChats(chats: Chat[], assistantChats: Chat[] = []) {
        vi.spyOn(StorageService.prototype, "getAll").mockImplementation(async function (this: StorageService<ChatResponse, unknown>) {
            return this.config === ASSISTANT_STORE ? assistantChats : chats;
        });
    }

    function sentPayloads(): ImportConversationPayload[] {
        // handleApiRequest gets a request thunk, the payload sits in its fetch body
        return fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    }

    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(StorageService.prototype, "connectToDB").mockResolvedValue({ transaction, close } as never);
        vi.mocked(handleApiRequest).mockImplementation(async request => {
            await request();
            return { status: "imported" };
        });
        localChats([]);
    });

    it("uploads a local chat and marks it without touching the timestamp", async () => {
        localChats([chat()]);

        await migrateLocalChatsToBackend();

        expect(sentPayloads()).toEqual([
            {
                conversation_id: CHAT_ID,
                title: "Kita Gebühren",
                last_edited: new Date(LAST_EDITED).toISOString(),
                turns: [{ user: "q1", assistant: "a1" }]
            }
        ]);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
        expect(transaction).toHaveBeenCalledWith(CHAT_STORE.objectStore_name, "readwrite");
        expect(put).toHaveBeenCalledWith({ ...chat(), backendPersisted: true });
        expect(del).not.toHaveBeenCalled();
    });

    it("takes assistant and conversation id from an assistant chat key", async () => {
        const key = `CHAT_${ASSISTANT_ID}_${CHAT_ID}`;
        localChats([], [chat({ id: key }), chat({ id: `BOTCONFIG_${ASSISTANT_ID}` })]);

        await migrateLocalChatsToBackend();

        expect(sentPayloads()).toHaveLength(1);
        expect(sentPayloads()[0]).toMatchObject({ conversation_id: CHAT_ID, assistant_id: ASSISTANT_ID });
        expect(transaction).toHaveBeenCalledWith(ASSISTANT_STORE.objectStore_name, "readwrite");
        expect(put).toHaveBeenCalledWith(expect.objectContaining({ id: key, backendPersisted: true }));
    });

    it("gives a non uuid key a fresh id and re-keys it in one transaction", async () => {
        localChats([chat({ id: "legacy-chat" })]);

        await migrateLocalChatsToBackend();

        const newId = sentPayloads()[0].conversation_id;
        expect(isUuid(newId)).toBe(true);
        expect(put).toHaveBeenCalledWith(expect.objectContaining({ id: newId, favorite: true, _last_edited: LAST_EDITED }));
        expect(del).toHaveBeenCalledWith("legacy-chat");
        expect(transaction).toHaveBeenCalledTimes(1);
    });

    it("drops failed turns and skips chats with nothing left", async () => {
        localChats([
            chat({
                messages: [
                    { user: "q1", response: { answer: "a1" } },
                    { user: "q2", response: { answer: "partial", error: "boom" } },
                    { user: "q3", response: { answer: "   " } }
                ]
            }),
            chat({ id: OTHER_ID, messages: [{ user: "q", response: { answer: "", error: "boom" } }] }),
            chat({ id: "empty-placeholder", messages: [] })
        ]);

        await migrateLocalChatsToBackend();

        expect(sentPayloads()).toHaveLength(1);
        expect(sentPayloads()[0].turns).toEqual([{ user: "q1", assistant: "a1" }]);
    });

    it("leaves already persisted chats alone", async () => {
        localChats([chat({ backendPersisted: true })]);

        await migrateLocalChatsToBackend();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(put).not.toHaveBeenCalled();
    });

    it("keeps a rejected chat local and carries on", async () => {
        localChats([chat(), chat({ id: OTHER_ID })]);
        vi.mocked(handleApiRequest).mockRejectedValueOnce(new ApiError("Conversation id is not available", 409)).mockResolvedValueOnce({ status: "imported" });

        await migrateLocalChatsToBackend();

        expect(put).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledWith(expect.objectContaining({ id: OTHER_ID }));
    });

    it.each([new ApiError("down", 500), new TypeError("Failed to fetch")])("stops on %s and retries next start", async error => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        localChats([chat(), chat({ id: OTHER_ID })]);
        vi.mocked(handleApiRequest).mockRejectedValueOnce(error);

        await migrateLocalChatsToBackend();

        expect(handleApiRequest).toHaveBeenCalledTimes(1);
        expect(put).not.toHaveBeenCalled();
    });

    it("retries a busy import before marking the chat persisted", async () => {
        vi.useFakeTimers();
        localChats([chat()]);
        vi.mocked(handleApiRequest)
            .mockRejectedValueOnce(new ApiError("busy", 423, undefined, 1))
            .mockResolvedValueOnce({ status: "imported" });

        const migration = migrateLocalChatsToBackend();
        await vi.advanceTimersByTimeAsync(1_000);
        await migration;

        expect(handleApiRequest).toHaveBeenCalledTimes(2);
        expect(put).toHaveBeenCalledWith({ ...chat(), backendPersisted: true });
        vi.useRealTimers();
    });

    it("retries an overloaded import before marking the chat persisted", async () => {
        vi.useFakeTimers();
        localChats([chat()]);
        vi.mocked(handleApiRequest)
            .mockRejectedValueOnce(new ApiError("overloaded", 429, undefined, 1))
            .mockResolvedValueOnce({ status: "imported" });

        const migration = migrateLocalChatsToBackend();
        await vi.advanceTimersByTimeAsync(1_000);
        await migration;

        expect(handleApiRequest).toHaveBeenCalledTimes(2);
        expect(put).toHaveBeenCalledWith({ ...chat(), backendPersisted: true });
        vi.useRealTimers();
    });

    it("keeps an unavailable conversation local without retrying", async () => {
        localChats([chat()]);
        vi.mocked(handleApiRequest).mockRejectedValueOnce(new ApiError("unavailable", 409));

        await migrateLocalChatsToBackend();

        expect(handleApiRequest).toHaveBeenCalledOnce();
        expect(put).not.toHaveBeenCalled();
    });

    it("falls back to a default title and cuts long ones", async () => {
        localChats([chat({ name: "  " }), chat({ id: OTHER_ID, name: "x".repeat(300) })]);

        await migrateLocalChatsToBackend();

        expect(sentPayloads().map(p => p.title)).toEqual(["New Chat", "x".repeat(200)]);
    });
});
