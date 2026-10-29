import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorageService } from "../../service/storage";
import { UnifiedHistoryStorage, type UnifiedHistoryEntry } from "./unifiedHistoryStorage";
import { listConversationsApi } from "../../api/conversations-client";

vi.mock("../../api/core-client", () => ({ API_BASE: "/api/backend/" }));
vi.mock("../../api/conversations-client", async importOriginal => ({
    ...(await importOriginal<typeof import("../../api/conversations-client")>()),
    listConversationsApi: vi.fn()
}));

describe("unified history deletion", () => {
    const service = new UnifiedHistoryStorage();
    const fetchMock = vi.fn<typeof fetch>();
    const entries: UnifiedHistoryEntry[] = [
        { id: "thread", kind: "chat", lastEdited: 0 },
        { id: "CHAT_assistant_thread", kind: "assistant", assistantId: "assistant", lastEdited: 0 }
    ];

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "" });
        fetchMock.mockReset();
        vi.spyOn(StorageService.prototype, "delete").mockResolvedValue(true);
    });

    afterEach(() => vi.unstubAllGlobals());

    describe.each(entries)("$kind", entry => {
        it.each([204, 404])("removes local history after HTTP %s", async status => {
            fetchMock.mockResolvedValue(new Response(null, { status }));
            await service.deleteEntry(entry);
            expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/backend/v1/conversations/thread", expect.objectContaining({ method: "DELETE" }));
            expect(StorageService.prototype.delete).toHaveBeenCalledExactlyOnceWith(entry.id);
        });

        it.each([403, 500, "network"])("retains local history and propagates %s failure", async status => {
            if (status === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
            else fetchMock.mockResolvedValue(new Response(null, { status: Number(status) }));
            await expect(service.deleteEntry(entry)).rejects.toThrow();
            expect(StorageService.prototype.delete).not.toHaveBeenCalled();
        });

        it("does not remove local history before the server responds", async () => {
            let complete!: (response: Response) => void;
            fetchMock.mockReturnValue(new Promise(resolve => (complete = resolve)));
            const deletion = service.deleteEntry(entry);
            expect(StorageService.prototype.delete).not.toHaveBeenCalled();
            complete(new Response(null, { status: 204 }));
            await deletion;
            expect(StorageService.prototype.delete).toHaveBeenCalledWith(entry.id);
        });
    });

    it("does not restore successfully erased history on subsequent synchronization", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
        const chats = [{ id: "thread", config: {}, messages: [], backendPersisted: true }];
        vi.spyOn(StorageService.prototype, "getAll").mockResolvedValueOnce(chats).mockResolvedValue([]);
        vi.mocked(StorageService.prototype.delete).mockImplementation(async () => {
            chats.splice(0);
            return true;
        });
        vi.mocked(listConversationsApi).mockResolvedValue([]);

        await service.deleteEntry(entries[0]);
        expect(await service.getAllHistoryEntries()).toEqual([]);
        expect(listConversationsApi).toHaveBeenCalledOnce();
    });
});

describe("unified history renaming", () => {
    const service = new UnifiedHistoryStorage();
    const fetchMock = vi.fn<typeof fetch>();
    const entries: UnifiedHistoryEntry[] = [
        { id: "thread", kind: "chat", lastEdited: 0 },
        { id: "CHAT_assistant_with_underscores_thread", kind: "assistant", assistantId: "assistant_with_underscores", lastEdited: 0 }
    ];

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("document", { cookie: "" });
        fetchMock.mockReset();
        vi.spyOn(StorageService.prototype, "get").mockResolvedValue({ messages: [], config: {}, backendPersisted: true });
        vi.spyOn(StorageService.prototype, "renameChat").mockResolvedValue({ messages: [], config: {}, name: "New title" });
    });

    afterEach(() => vi.unstubAllGlobals());

    describe.each(entries)("$kind", entry => {
        it("persists the title on the server before updating the cache", async () => {
            let complete!: (response: Response) => void;
            fetchMock.mockReturnValue(new Promise(resolve => (complete = resolve)));
            const rename = service.renameEntry(entry, " New title ");
            await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
            expect(StorageService.prototype.renameChat).not.toHaveBeenCalled();
            expect(fetchMock).toHaveBeenCalledWith(
                "/api/backend/v1/conversations/thread",
                expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: " New title " }) })
            );
            complete(Response.json({ title: "New title" }));
            await rename;
            expect(StorageService.prototype.renameChat).toHaveBeenCalledExactlyOnceWith(entry.id, "New title");
        });

        it.each([403, 404, 500, "network"])("retains the cached title after %s failure", async status => {
            if (status === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
            else fetchMock.mockResolvedValue(new Response(null, { status: Number(status) }));
            await expect(service.renameEntry(entry, "New title")).rejects.toThrow();
            expect(StorageService.prototype.renameChat).not.toHaveBeenCalled();
        });

        it("allows local-only history to be renamed when there is no server row", async () => {
            vi.mocked(StorageService.prototype.get).mockResolvedValue({ messages: [], config: {} });
            fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
            await service.renameEntry(entry, "Local title");
            expect(StorageService.prototype.renameChat).toHaveBeenCalledExactlyOnceWith(entry.id, "Local title");
        });

        it("surfaces a cache write failure", async () => {
            fetchMock.mockResolvedValue(Response.json({ title: "New title" }));
            vi.mocked(StorageService.prototype.renameChat).mockResolvedValue(undefined);
            await expect(service.renameEntry(entry, "New title")).rejects.toThrow("Failed to rename");
        });
    });
});
