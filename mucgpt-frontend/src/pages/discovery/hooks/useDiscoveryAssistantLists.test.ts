// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assistant, AssistantResponse, CommunityAssistant, CommunityAssistantSnapshot } from "../../../api/models";
import type { AssistantCardData } from "../../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import type { AssistantStorageService } from "../../../service/assistantstorage";
import type { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import { useDiscoveryAssistantLists } from "./useDiscoveryAssistantLists";

vi.mock("../../../api/assistant-client", async importOriginal => {
    const actual = await importOriginal<typeof import("../../../api/assistant-client")>();
    return { ...actual, getAllCommunityAssistantsApi: vi.fn(), getOwnedCommunityAssistants: vi.fn(), getUserSubscriptionsApi: vi.fn() };
});
vi.mock("../../../components/OwnerMetadataLink/OwnerMetadataLink", async importOriginal => {
    const actual = await importOriginal<typeof import("../../../components/OwnerMetadataLink/OwnerMetadataLink")>();
    return { ...actual, getPrimaryOwnerDetails: vi.fn() };
});

const { getAllCommunityAssistantsApi, getOwnedCommunityAssistants, getUserSubscriptionsApi } = await import("../../../api/assistant-client");

const assistantStorageService = {
    getAllAssistantConfigs: vi.fn().mockResolvedValue([]),
    getChatStorageService: undefined
} as unknown as AssistantStorageService;

const communityAssistantStorageService = {
    getAllAssistantConfigs: vi.fn().mockResolvedValue([])
} as unknown as CommunityAssistantStorageService;

const serverAssistant = (id: string, title: string, subscriptions = 5, updated = "2026-01-01T00:00:00Z"): AssistantResponse =>
    ({
        id,
        latest_version: { name: title, description: `Beschreibung ${id}`, tags: [] },
        subscriptions_count: subscriptions,
        updated_at: updated
    }) as unknown as AssistantResponse;

const localAssistant = (id: string, title: string): Assistant =>
    ({ id, title, description: `Lokal ${id}`, creativity: "low", is_visible: false, tags: [] }) as unknown as Assistant;

const snapshot = (id: string, title: string): CommunityAssistantSnapshot =>
    ({
        snapshot_version: 1,
        id,
        version: "1",
        title,
        description: "",
        system_message: "",
        creativity: "low",
        examples: [],
        quick_prompts: [],
        tags: [],
        hierarchical_access: [],
        tools: [],
        is_visible: true
    }) as CommunityAssistantSnapshot;

const subscription = (id: string, title: string): CommunityAssistant =>
    ({ id, title, description: "", subscriptions_count: 3, updated_at: "2026-02-01T00:00:00Z" }) as unknown as CommunityAssistant;

function setup() {
    return renderHook(() => useDiscoveryAssistantLists({ assistantStorageService, communityAssistantStorageService }));
}

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(assistantStorageService.getAllAssistantConfigs).mockResolvedValue([]);
    vi.mocked(communityAssistantStorageService.getAllAssistantConfigs).mockResolvedValue([]);
    vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([]);
    vi.mocked(getUserSubscriptionsApi).mockResolvedValue([]);
    vi.mocked(getAllCommunityAssistantsApi).mockResolvedValue([]);
    (assistantStorageService as { getChatStorageService: unknown }).getChatStorageService = () => ({
        getAll: vi.fn().mockResolvedValue([])
    });
});

describe("useDiscoveryAssistantLists initial load", () => {
    it("starts loading and fills the lists from the API and local storage", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Mein Assistent")]);
        vi.mocked(getAllCommunityAssistantsApi).mockResolvedValue([serverAssistant("a-2", "Community Assistent")]);
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-3", "Abonniert")]);
        vi.mocked(assistantStorageService.getAllAssistantConfigs).mockResolvedValue([localAssistant("a-4", "Lokal")]);

        const { result } = setup();

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.hasLoadedSuccessfully).toBe(true);
        expect(result.current.ownedAssistantIds).toEqual(new Set(["a-1"]));

        // mine: owned + local (not yet owned) + subscribed
        expect(result.current.filteredMyAssistants.map(a => a.id).sort()).toEqual(["a-1", "a-3", "a-4"]);
        // community list excludes owned and subscribed
        expect(result.current.communityAssistants.map(a => a.id)).toEqual(["a-2"]);
        expect(result.current.knownAssistantIds).toEqual(new Set(["a-1", "a-2", "a-3", "a-4"]));
    });

    it("marks local assistants as owned once they exist on the server", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Mein Assistent")]);
        vi.mocked(assistantStorageService.getAllAssistantConfigs).mockResolvedValue([localAssistant("a-1", "Mein Assistent")]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.filteredMyAssistants).toHaveLength(1);
        expect(result.current.filteredMyAssistants[0]).toMatchObject({ id: "a-1", isOwnedAssistant: true });
        // the server version replaced the local copy, so the card no longer carries the local flag
        expect("isLocalAssistant" in result.current.filteredMyAssistants[0]).toBe(false);
    });

    it("sorts my assistants by lastUsed (descending) using the chat store timestamps", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Erster"), serverAssistant("a-2", "Zweiter")]);
        const chatRecords = [
            { id: "CHAT_a-1_thread", _last_edited: 100, messages: [] },
            { id: "CHAT_a-2_thread", _last_edited: 900, messages: [] }
        ];
        (assistantStorageService as { getChatStorageService: unknown }).getChatStorageService = () => ({
            getAll: vi.fn().mockResolvedValue(chatRecords)
        });

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.filteredMyAssistants.map(a => a.id)).toEqual(["a-2", "a-1"]);
        expect(result.current.filteredMyAssistants[0].lastUsed).toBe(900);
    });

    it("ignores malformed chat records when computing last usage", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Erster")]);
        const chatRecords = [
            { id: "CHAT_a-1_thread", _last_edited: 100, messages: [] },
            { id: "BOTCONFIG_a-1", _last_edited: 999, messages: [] }, // config record
            { id: "CHAT_a-1", _last_edited: 500, messages: [] }, // no chat id
            { id: "CHAT_a-1_t2", _last_edited: 0, messages: [] }, // no timestamp
            { id: "CHAT_a-1_t3", _last_edited: 50, messages: "broken" } // malformed messages
        ];
        (assistantStorageService as { getChatStorageService: unknown }).getChatStorageService = () => ({
            getAll: vi.fn().mockResolvedValue(chatRecords)
        });

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.filteredMyAssistants[0].lastUsed).toBe(100);
    });

    it("uses the server metadata for subscriptions when the full assistant is available", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Auch abonniert")]);
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-1", "Alter Titel")]);
        vi.mocked(getAllCommunityAssistantsApi).mockResolvedValue([]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.filteredMyAssistants).toHaveLength(1);
        // the subscription is owned, so the merged card is no longer marked as subscribed;
        // the (newer) subscription metadata supplies title and description
        expect(result.current.filteredMyAssistants[0]).toMatchObject({
            id: "a-1",
            title: "Alter Titel",
            subscriptions: 5,
            isOwnedAssistant: true,
            isSubscribedAssistant: false
        });
    });

    it("falls back to a local snapshot for subscriptions the server cannot describe", async () => {
        const local = snapshot("a-9", "Nur lokal");
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-9", "Snapshot Titel")]);
        vi.mocked(communityAssistantStorageService.getAllAssistantConfigs).mockResolvedValue([local]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.filteredMyAssistants).toHaveLength(1);
        expect(result.current.filteredMyAssistants[0]).toMatchObject({
            id: "a-9",
            title: "Snapshot Titel",
            isSubscribedAssistant: true
        });
    });

    it("keeps loading state and empty lists when a request fails", async () => {
        vi.mocked(getAllCommunityAssistantsApi).mockRejectedValue(new Error("boom"));
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.hasLoadedSuccessfully).toBe(false);
        expect(result.current.communityAssistants).toEqual([]);
        expect(result.current.filteredMyAssistants).toEqual([]);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe("useDiscoveryAssistantLists filtering and sorting", () => {
    const setupWithTwo = async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Mein Assistent", 1)]);
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-2", "Abonniert")]);
        const utils = setup();
        await waitFor(() => expect(utils.result.current.isLoading).toBe(false));
        return utils;
    };

    it("filters my assistants by owned/subscribed", async () => {
        const { result } = await setupWithTwo();

        act(() => {
            result.current.setMyAssistantFilter("owned");
        });
        expect(result.current.filteredMyAssistants.map(a => a.id)).toEqual(["a-1"]);

        act(() => {
            result.current.setMyAssistantFilter("subscribed");
        });
        expect(result.current.filteredMyAssistants.map(a => a.id)).toEqual(["a-2"]);
    });

    it("persists filter and sort preferences in localStorage", async () => {
        const { result } = await setupWithTwo();

        act(() => {
            result.current.setMyAssistantFilter("owned");
            result.current.setMyAssistantsSortMethod("title");
            result.current.setCommunitySortMethod("title");
        });

        expect(localStorage.getItem("discovery_myAssistantFilter")).toBe("owned");
        expect(localStorage.getItem("discovery_myAssistantsSortMethod")).toBe("title");
        expect(localStorage.getItem("discovery_communitySortMethod")).toBe("title");
    });

    it("truncates the my-assistants preview to six entries until 'show all' is requested", async () => {
        const owned = Array.from({ length: 8 }, (_, i) => serverAssistant(`a-${i}`, `Assistent ${i}`));
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue(owned);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.displayedMyAssistants).toHaveLength(6);
        expect(result.current.hasHiddenMyAssistants).toBe(true);

        act(() => {
            result.current.setShowAllMyAssistants(true);
        });
        expect(result.current.displayedMyAssistants).toHaveLength(8);
        expect(result.current.hasHiddenMyAssistants).toBe(false);
    });

    it("resets 'show all' when the filter or the search text changes", async () => {
        const owned = Array.from({ length: 8 }, (_, i) => serverAssistant(`a-${i}`, `Assistent ${i}`));
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue(owned);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setShowAllMyAssistants(true);
        });
        expect(result.current.displayedMyAssistants).toHaveLength(8);

        act(() => {
            result.current.setMyAssistantFilter("owned");
        });
        expect(result.current.displayedMyAssistants).toHaveLength(6);
    });
});

describe("useDiscoveryAssistantLists removal", () => {
    it("removes an assistant from all lists at once", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Mein Assistent")]);
        vi.mocked(getAllCommunityAssistantsApi).mockResolvedValue([serverAssistant("a-2", "Community")]);
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-3", "Abonniert")]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.removeAssistantFromLists("a-2");
        });
        expect(result.current.communityAssistants).toEqual([]);
        expect(result.current.knownAssistantIds).toEqual(new Set(["a-1", "a-3"]));
    });

    it("removes assistants from the owned and subscribed lists individually", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-1", "Mein Assistent")]);
        vi.mocked(getUserSubscriptionsApi).mockResolvedValue([subscription("a-3", "Abonniert")]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.removeYoursAssistant("a-1");
        });
        expect(result.current.filteredMyAssistants.map(a => a.id)).toEqual(["a-3"]);

        act(() => {
            result.current.removeSubscribedAssistant("a-3");
        });
        expect(result.current.filteredMyAssistants).toEqual([]);
    });
});

describe("useDiscoveryAssistantLists searching", () => {
    it("refetches with the debounced search text and exposes isSearching", async () => {
        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setSearchText("excel");
        });
        expect(result.current.isSearching).toBe(true);

        // the debounce (400ms) batches the refetch until typing pauses
        await waitFor(
            () =>
                expect(getAllCommunityAssistantsApi).toHaveBeenCalledWith(
                    expect.objectContaining({ search: "excel", limit: 500, offset: 0 }),
                    expect.objectContaining({ signal: expect.anything() })
                ),
            { timeout: 2000 }
        );
    });
});

describe("useDiscoveryAssistantLists sorting", () => {
    it("delegates title sorting to the backend via query parameters", async () => {
        localStorage.setItem("discovery_myAssistantsSortMethod", "title");
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-b", "Banane"), serverAssistant("a-a", "Apfel")]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // the server is asked to sort by title ascending; the client keeps its order
        expect(getOwnedCommunityAssistants).toHaveBeenCalledWith(expect.objectContaining({ sort_by: "title", sort_order: "asc" }), expect.anything());
        expect(getAllCommunityAssistantsApi).toHaveBeenCalledWith(
            expect.objectContaining({ sort_by: "subscriptions", sort_order: "desc", exclude_owned: true, exclude_subscribed: true }),
            expect.anything()
        );
        expect(result.current.filteredMyAssistants.map(a => a.title)).toEqual(["Banane", "Apfel"]);
    });

    it("sorts by lastUsed on the client even with a filter applied", async () => {
        vi.mocked(getOwnedCommunityAssistants).mockResolvedValue([serverAssistant("a-b", "Alt"), serverAssistant("a-a", "Neu")]);
        const chatRecords = [
            { id: "CHAT_a-b_thread", _last_edited: 100, messages: [] },
            { id: "CHAT_a-a_thread", _last_edited: 900, messages: [] }
        ];
        (assistantStorageService as { getChatStorageService: unknown }).getChatStorageService = () => ({
            getAll: vi.fn().mockResolvedValue(chatRecords)
        });

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.setMyAssistantFilter("owned");
        });
        expect(result.current.filteredMyAssistants.map(a => a.id)).toEqual(["a-a", "a-b"]);
    });
});

describe("AssistantCardData mapping", () => {
    it("maps community assistant payloads to card data", async () => {
        vi.mocked(getAllCommunityAssistantsApi).mockResolvedValue([serverAssistant("a-2", "Community Assistent", 12, "2026-03-01T00:00:00Z")]);

        const { result } = setup();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const card: AssistantCardData = result.current.communityAssistants[0];
        expect(card).toMatchObject({
            id: "a-2",
            title: "Community Assistent",
            description: "Beschreibung a-2",
            subscriptions: 12,
            updated: "2026-03-01T00:00:00Z"
        });
        expect(card.rawData).toBeDefined();
    });
});
