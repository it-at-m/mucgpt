import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBPDatabase, IDBPTransaction } from "idb";
import { ChatResponse } from "../api";
import { CHAT_STORE, CREATIVITY_HIGH, CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../constants";
import { ChatOptions } from "../pages/chat/Chat";
import { DBObject } from "./storage";
import { convertTemperatureToCreativity, migrateChats } from "./migration";

function makeDb(storeExists: boolean) {
    return {
        objectStoreNames: { contains: vi.fn(() => storeExists) },
        createObjectStore: vi.fn(),
        getAll: vi.fn(async () => [] as unknown[]),
        put: vi.fn(async () => undefined)
    };
}

function makeTransaction() {
    const clear = vi.fn();
    return {
        clear,
        transaction: { objectStore: vi.fn(() => ({ clear })) } as unknown as IDBPTransaction<unknown, string[], "versionchange">
    };
}

const legacyChat = (temperature: number, lastEdited = 42) => ({
    id: "legacy-1",
    Data: {
        Answers: [["Question?", { answer: "Answer!", tokens: 12 }, 7]] as [string, { answer: string; tokens: number }, number][],
        LastEdited: lastEdited,
        Name: "Alter Chat"
    },
    Options: { favorite: true, system: "Legacy prompt", temperature }
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("convertTemperatureToCreativity", () => {
    it.each([
        [0, CREATIVITY_LOW],
        [0.39, CREATIVITY_LOW],
        [0.4, CREATIVITY_MEDIUM],
        [0.79, CREATIVITY_MEDIUM],
        [0.8, CREATIVITY_HIGH],
        [1, CREATIVITY_HIGH]
    ])("maps %s to %s", (temperature, expected) => {
        expect(convertTemperatureToCreativity(temperature)).toBe(expected);
    });
});

describe("migrateChats", () => {
    it("creates the object store when it does not exist yet", async () => {
        const db = makeDb(false) as unknown as IDBPDatabase<unknown>;
        const { transaction } = makeTransaction();

        await migrateChats(db, 0, 1, transaction, {} as IDBVersionChangeEvent, CHAT_STORE.objectStore_name);

        expect(db.objectStoreNames.contains).toHaveBeenCalledWith(CHAT_STORE.objectStore_name);
        expect(db.createObjectStore).toHaveBeenCalledWith(CHAT_STORE.objectStore_name, { keyPath: "id" });
    });

    it("converts legacy v2 chat records to the current schema", async () => {
        const db = makeDb(true) as unknown as IDBPDatabase<unknown>;
        vi.mocked(db.getAll).mockResolvedValue([legacyChat(0.2), legacyChat(0.5), legacyChat(0.9)] as never);
        const { transaction } = makeTransaction();

        await migrateChats(db, 2, 3, transaction, {} as IDBVersionChangeEvent, CHAT_STORE.objectStore_name);

        expect(typeof transaction.oncomplete).toBe("function");
        await (transaction.oncomplete as unknown as (event: unknown) => Promise<void>)(undefined);

        expect(db.getAll).toHaveBeenCalledWith(CHAT_STORE.objectStore_name);
        expect(db.put).toHaveBeenCalledTimes(3);
        expect(db.put).toHaveBeenNthCalledWith(
            1,
            CHAT_STORE.objectStore_name,
            expect.objectContaining({
                id: "legacy-1",
                name: "Alter Chat",
                favorite: true,
                _last_edited: 42,
                messages: [{ user: "Question?", response: { answer: "Answer!", tokens: 12, user_tokens: 7 } }],
                config: { system: "Legacy prompt", creativity: CREATIVITY_LOW }
            } satisfies Partial<DBObject<ChatResponse, ChatOptions>>)
        );
        expect(db.put).toHaveBeenNthCalledWith(
            2,
            CHAT_STORE.objectStore_name,
            expect.objectContaining({ config: { system: "Legacy prompt", creativity: CREATIVITY_MEDIUM } })
        );
        expect(db.put).toHaveBeenNthCalledWith(
            3,
            CHAT_STORE.objectStore_name,
            expect.objectContaining({ config: { system: "Legacy prompt", creativity: CREATIVITY_HIGH } })
        );
    });

    it("clears foreign or non-legacy stores instead of converting them", async () => {
        const db = makeDb(true) as unknown as IDBPDatabase<unknown>;
        const { clear, transaction } = makeTransaction();

        await migrateChats(db, 1, 3, transaction, {} as IDBVersionChangeEvent, CHAT_STORE.objectStore_name);
        expect(transaction.oncomplete).toBeUndefined();
        expect(clear).toHaveBeenCalledOnce();

        await migrateChats(db, 2, 3, transaction, {} as IDBVersionChangeEvent, "bots");
        expect(clear).toHaveBeenCalledTimes(2);
    });
});
