import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ChatResponse } from "../../api/models";
import { StorageService, type DBObject } from "../storage";
import { migrateLocalChatsToBackend } from "./chatMigration";

const ORIGIN = "http://mucgpt.test";
const IMPORT_URL = `${ORIGIN}/api/backend/v1/conversations/import`;
const CHAT_ID = "2f0f1b52-8a5e-4c3a-9a51-1b9a3f6e2c11";
const LAST_EDITED = Date.UTC(2025, 2, 1, 12, 0);

type Chat = DBObject<ChatResponse, unknown>;

const server = setupServer();

function chat(): Chat {
    return {
        id: CHAT_ID,
        name: "Kita Gebühren",
        _last_edited: LAST_EDITED,
        config: {},
        messages: [{ user: "q1", response: { answer: "a1" } }]
    };
}

describe("chat migration HTTP retry", () => {
    const put = vi.fn();
    const close = vi.fn();
    const get = vi.fn();
    const transaction = vi.fn(() => ({ store: { get, put, delete: vi.fn() }, done: Promise.resolve() }));
    let interceptedFetch: typeof fetch;

    beforeAll(() => {
        server.listen();
        interceptedFetch = globalThis.fetch;
    });
    afterEach(() => {
        server.resetHandlers();
        vi.restoreAllMocks();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });
    afterAll(() => server.close());

    beforeEach(() => {
        vi.clearAllMocks();
        get.mockResolvedValue(chat());
        vi.stubGlobal("document", { cookie: "" });
        vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? new URL(input, ORIGIN) : input;
            return interceptedFetch(url, init);
        });
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValue([chat()]);
        vi.spyOn(StorageService.prototype, "connectToDB").mockResolvedValue({ transaction, close } as never);
    });

    it("uses Retry-After to retry an overloaded import and persists only after success", async () => {
        vi.useFakeTimers();
        let requests = 0;
        server.use(
            http.post(IMPORT_URL, () => {
                requests++;
                if (requests === 1) {
                    return HttpResponse.json({ detail: "Migration capacity is busy" }, { status: 429, headers: { "Retry-After": "1" } });
                }
                return HttpResponse.json({ status: "imported" });
            })
        );

        const migration = migrateLocalChatsToBackend();
        await vi.advanceTimersByTimeAsync(1_000);
        await migration;

        expect(requests).toBe(2);
        expect(put).toHaveBeenCalledOnce();
        expect(put).toHaveBeenCalledWith({ ...chat(), backendPersisted: true });
    });

    it("leaves the chat local after all overloaded retries are exhausted", async () => {
        vi.useFakeTimers();
        let requests = 0;
        server.use(
            http.post(IMPORT_URL, () => {
                requests++;
                return HttpResponse.json({ detail: "Migration capacity is busy" }, { status: 429, headers: { "Retry-After": "1" } });
            })
        );
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const migration = migrateLocalChatsToBackend();
        await vi.advanceTimersByTimeAsync(3_000);
        await migration;

        expect(requests).toBe(4);
        expect(put).not.toHaveBeenCalled();
    });
});
