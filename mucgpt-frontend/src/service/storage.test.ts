import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBPDatabase } from "idb";
import { CHAT_STORE } from "../constants";
import { DBMessage, DBObject, StorageService } from "./storage";

vi.mock("idb", () => ({ openDB: vi.fn() }));

/**
 * Minimal in-memory IDB database double: enough of the idb surface that
 * StorageService uses (put/get/getAll/transaction.objectStore.delete).
 */
function makeDb() {
    const records = new Map<string, DBObject<unknown, unknown>>();
    const db = {
        put: vi.fn(async (store: string, value: DBObject<unknown, unknown>) => {
            if (!value.id) throw new Error("DataError: id required");
            records.set(value.id, structuredClone(value));
        }),
        get: vi.fn(async (_store: string, id: string) => structuredClone(records.get(id))),
        getAll: vi.fn(async () => Array.from(records.values(), value => structuredClone(value))),
        transaction: vi.fn(() => ({
            objectStore: () => ({
                delete: vi.fn(async (id: string) => {
                    records.delete(id);
                })
            })
        }))
    };
    return { db, records };
}

let db: ReturnType<typeof makeDb>;

const service = () => new StorageService<ChatResponseLike, ConfigLike>(CHAT_STORE);
type ChatResponseLike = { answer: string };
type ConfigLike = { system?: string };

const message = (user: string, answer: string): DBMessage<ChatResponseLike> => ({ user, response: { answer } });

beforeEach(async () => {
    vi.clearAllMocks();
    const { openDB } = await import("idb");
    db = makeDb();
    vi.mocked(openDB).mockResolvedValue(db.db as unknown as IDBPDatabase<unknown>);
});

describe("StorageService CRUD", () => {
    it("creates a record with defaults and a generated id", async () => {
        const id = await service().create();

        expect(id).toEqual(expect.any(String));
        expect(db.records.get(id!)).toEqual(expect.objectContaining({ id, messages: [], config: {}, favorite: false, _last_edited: expect.any(Number) }));
    });

    it("creates a record with explicit id, messages, config, name and favorite flag", async () => {
        const stored = await service().create([message("hi", "ho")], { system: "Du bist MUCGPT" }, "fixed-id", "Chatname", true);

        expect(stored).toBe("fixed-id");
        expect(db.records.get("fixed-id")).toEqual(
            expect.objectContaining({
                id: "fixed-id",
                name: "Chatname",
                favorite: true,
                messages: [message("hi", "ho")],
                config: { system: "Du bist MUCGPT" }
            })
        );
    });

    it("reads single records and the full list", async () => {
        const s = service();
        const id = await s.create([message("q", "a")], { system: "s" }, "chat-1");

        expect(await s.get("chat-1")).toEqual(db.records.get("chat-1"));
        expect(id).toBe("chat-1");
        expect(await s.get("missing")).toBeUndefined();
        expect(await s.getAll()).toHaveLength(1);
    });

    it("updates only the provided fields and bumps _last_edited", async () => {
        const s = service();
        await s.create([message("q1", "a1")], { system: "old" }, "chat-1", "Old name", false);
        const before = db.records.get("chat-1")!._last_edited!;

        const updated = await s.update("chat-1", [message("q2", "a2")]);
        expect(updated?.messages).toEqual([message("q2", "a2")]);
        expect(updated?.config).toEqual({ system: "old" });
        expect(updated?.name).toBe("Old name");
        expect(updated?.favorite).toBe(false);
        expect(updated?._last_edited).toBeGreaterThanOrEqual(before);
    });

    it("updates favorite and name when provided", async () => {
        const s = service();
        await s.create([], {}, "chat-1");

        const updated = await s.update("chat-1", undefined, undefined, true, "Neuer Name");
        expect(updated?.favorite).toBe(true);
        expect(updated?.name).toBe("Neuer Name");
    });

    it("logs and resolves undefined when updating an unknown id", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const s = service();

        await expect(s.update("missing", [message("q", "a")])).resolves.toBeUndefined();
        // onError logs the serialized error object (plain Errors serialize to {})
        expect(errorSpy).toHaveBeenCalledWith("Error", expect.any(String));
    });

    it("deletes a record and reports success", async () => {
        const s = service();
        await s.create([], {}, "chat-1");

        await expect(s.delete("chat-1")).resolves.toBe(true);
        expect(db.records.has("chat-1")).toBe(false);
        expect(db.db.transaction).toHaveBeenCalledWith(CHAT_STORE.objectStore_name, "readwrite");
    });
});

describe("StorageService chat helpers", () => {
    it("returns the newest chat by _last_edited", async () => {
        const s = service();
        await s.create([], {}, "old-chat", "Old", false);
        db.records.get("old-chat")!._last_edited = 100;
        await s.create([], {}, "new-chat", "New", false);
        db.records.get("new-chat")!._last_edited = 200;

        await expect(s.getNewestChat()).resolves.toMatchObject({ id: "new-chat" });
    });

    it("returns undefined as newest chat when the store is empty", async () => {
        await expect(service().getNewestChat()).resolves.toBeUndefined();
    });

    it("appends a message to an existing chat", async () => {
        const s = service();
        await s.create([message("q1", "a1")], { system: "sys" }, "chat-1");

        const updated = await s.appendMessage(message("q2", "a2"), "chat-1");
        expect(updated?.messages).toEqual([message("q1", "a1"), message("q2", "a2")]);
        expect(await s.get("chat-1")).toMatchObject({ messages: [message("q1", "a1"), message("q2", "a2")] });
    });

    it("pops the last message off a chat", async () => {
        const s = service();
        await s.create([message("q1", "a1"), message("q2", "a2")], {}, "chat-1");

        await expect(s.popMessage("chat-1")).resolves.toEqual(message("q2", "a2"));
        expect(await s.get("chat-1")).toMatchObject({ messages: [message("q1", "a1")] });
    });

    it("rolls messages back to an index and reports the removed user text", async () => {
        const s = service();
        await s.create([message("q1", "a1"), message("q2", "a2"), message("q3", "a3")], {}, "chat-1");
        const setQuestion = vi.fn();

        await s.rollbackMessage(0, "chat-1", setQuestion);

        expect(await s.get("chat-1")).toMatchObject({ messages: [message("q1", "a1")] });
        // the last message removed by the loop is reported
        expect(setQuestion).toHaveBeenCalledWith("q2");
    });

    it("renames a chat and toggles favourites", async () => {
        const s = service();
        await s.create([], {}, "chat-1", "Alt");

        await expect(s.renameChat("chat-1", "Neu")).resolves.toMatchObject({ name: "Neu" });
        await expect(s.changeFavouritesInDb("chat-1", true)).resolves.toMatchObject({ favorite: true });
        expect(await s.get("chat-1")).toMatchObject({ name: "Neu", favorite: true });
    });
});

describe("StorageService error handling", () => {
    it("swallows database failures, logs them and resolves undefined", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const { openDB } = await import("idb");
        vi.mocked(openDB).mockRejectedValue(new Error("db unavailable"));
        const s = service();

        await expect(s.create()).resolves.toBeUndefined();
        await expect(s.get("x")).resolves.toBeUndefined();
        await expect(s.getAll()).resolves.toBeUndefined();
        await expect(s.delete("x")).resolves.toBeUndefined();
        await expect(s.getNewestChat()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalled();
    });
});
