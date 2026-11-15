// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantStorageService } from "../service/assistantstorage";
import type { CommunityAssistantStorageService } from "../service/communityassistantstorage";
import type { OrphanedAssistant } from "../utils/orphanedAssistantChats";
import { useOrphanedAssistantChats } from "./useOrphanedAssistantChats";

vi.mock("../utils/orphanedAssistantChats", async importOriginal => {
    const actual = await importOriginal<typeof import("../utils/orphanedAssistantChats")>();
    return { ...actual, resolveOrphanedAssistantChats: vi.fn() };
});

const chatRecord = (assistantId: string, chatId: string, lastEdited: number) => ({
    id: `CHAT_${assistantId}_${chatId}`,
    _last_edited: lastEdited,
    messages: []
});

const makeAssistantStorage = (records: unknown[]) =>
    ({
        CHAT_ID: "CHAT_",
        getChatStorageService: () => ({ getAll: vi.fn().mockResolvedValue(records) })
    }) as unknown as AssistantStorageService;

const { resolveOrphanedAssistantChats } = await import("../utils/orphanedAssistantChats");

const resolvedOrphan = (id: string, lastUsed: number): OrphanedAssistant => ({ id, lastUsed, title: id }) as OrphanedAssistant;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useOrphanedAssistantChats", () => {
    it("resolves orphaned assistant chats from the chat store, newest usage wins", async () => {
        const records = [chatRecord("assistant-a", "t1", 100), chatRecord("assistant-a", "t2", 200), chatRecord("assistant-b", "t3", 50)];
        vi.mocked(resolveOrphanedAssistantChats).mockResolvedValue([resolvedOrphan("assistant-a", 200)]);

        const { result } = renderHook(() =>
            useOrphanedAssistantChats({
                assistantStorageService: makeAssistantStorage(records),
                excludeIds: new Set<string>()
            })
        );

        await waitFor(() => expect(result.current).toHaveLength(1));
        expect(resolveOrphanedAssistantChats).toHaveBeenCalledWith(["assistant-a", "assistant-b"], expect.any(Map), undefined);
        const lastUsedById = vi.mocked(resolveOrphanedAssistantChats).mock.calls[0][1] as Map<string, number>;
        expect(lastUsedById.get("assistant-a")).toBe(200);
        expect(lastUsedById.get("assistant-b")).toBe(50);
    });

    it("skips excluded, non-chat and malformed records", async () => {
        const records = [
            chatRecord("assistant-a", "t1", 100),
            { id: "BOTCONFIG_assistant-a", _last_edited: 300, messages: [] }, // config, not a chat
            { id: "CHAT_notimestamp", messages: [] }, // no timestamp
            { id: "CHAT_nounderscore", _last_edited: 100, messages: [] }, // no chat id part
            { id: "CHAT__emptyassistant", _last_edited: 100, messages: [] }, // empty assistant id
            { id: "CHAT_assistant-b_t2", _last_edited: 100, messages: "not-an-array" } // malformed messages
        ];
        vi.mocked(resolveOrphanedAssistantChats).mockResolvedValue([]);

        renderHook(() =>
            useOrphanedAssistantChats({
                assistantStorageService: makeAssistantStorage(records),
                excludeIds: new Set(["assistant-a"])
            })
        );

        await waitFor(() => expect(resolveOrphanedAssistantChats).toHaveBeenCalled());
        expect(resolveOrphanedAssistantChats).toHaveBeenCalledWith([], expect.any(Map), undefined);
    });

    it("does not resolve while the assistant lists are still loading", () => {
        renderHook(() =>
            useOrphanedAssistantChats({
                assistantStorageService: makeAssistantStorage([chatRecord("assistant-a", "t1", 100)]),
                excludeIds: new Set<string>(),
                enabled: false
            })
        );

        expect(resolveOrphanedAssistantChats).not.toHaveBeenCalled();
    });

    it("starts over and resolves nothing when the chat store fails", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const failingService = {
            getChatStorageService: () => ({ getAll: vi.fn().mockRejectedValue(new Error("idb closed")) })
        } as unknown as AssistantStorageService;

        const { result } = renderHook(() => useOrphanedAssistantChats({ assistantStorageService: failingService, excludeIds: new Set<string>() }));

        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(result.current).toEqual([]);
        errorSpy.mockRestore();
    });

    it("ignores a resolved result after unmount (no cancelled-state update)", async () => {
        let resolvePromise!: (orphans: OrphanedAssistant[]) => void;
        vi.mocked(resolveOrphanedAssistantChats).mockReturnValue(new Promise(resolve => (resolvePromise = resolve)));

        const { result, unmount } = renderHook(() =>
            useOrphanedAssistantChats({
                assistantStorageService: makeAssistantStorage([chatRecord("assistant-a", "t1", 100)]),
                excludeIds: new Set<string>()
            })
        );
        unmount();
        resolvePromise([resolvedOrphan("assistant-a", 100)]);

        // give the rejected/ignored update a tick; must not throw or update state
        await Promise.resolve();
        await Promise.resolve();
        expect(result.current).toEqual([]);
    });

    it("passes the community storage service through for snapshot lookups", async () => {
        const communityService = {} as CommunityAssistantStorageService;
        vi.mocked(resolveOrphanedAssistantChats).mockResolvedValue([]);

        renderHook(() =>
            useOrphanedAssistantChats({
                assistantStorageService: makeAssistantStorage([chatRecord("assistant-a", "t1", 100)]),
                excludeIds: new Set<string>(),
                communityAssistantStorageService: communityService
            })
        );

        await waitFor(() => expect(resolveOrphanedAssistantChats).toHaveBeenCalled());
        expect(resolveOrphanedAssistantChats).toHaveBeenCalledWith(["assistant-a"], expect.any(Map), communityService);
    });
});
