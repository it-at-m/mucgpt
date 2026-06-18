import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";

import { getAllCommunityAssistantsApi, getOwnedCommunityAssistants, getUserSubscriptionsApi } from "../../../api/assistant-client";
import { Assistant, AssistantResponse, CommunityAssistantSnapshot } from "../../../api/models";
import type { AssistantCardData } from "../../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { AssistantStorageService } from "../../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import { isCompleteCommunityAssistantSnapshot } from "../../../utils/community-assistant-snapshots";

export type SortKey = "title" | "updated" | "subscriptions" | "lastUsed";
export type CommunitySortKey = "subscriptions" | "updated" | "title";
export type MyAssistantFilter = "all" | "owned" | "subscribed";

interface UseDiscoveryAssistantListsParams {
    assistantStorageService: AssistantStorageService;
    communityAssistantStorageService: CommunityAssistantStorageService;
}

interface UseDiscoveryAssistantListsResult {
    isLoading: boolean;
    searchText: string;
    setSearchText: Dispatch<SetStateAction<string>>;
    communitySortMethod: CommunitySortKey;
    setCommunitySortMethod: Dispatch<SetStateAction<CommunitySortKey>>;
    myAssistantsSortMethod: SortKey;
    setMyAssistantsSortMethod: Dispatch<SetStateAction<SortKey>>;
    myAssistantFilter: MyAssistantFilter;
    setMyAssistantFilter: Dispatch<SetStateAction<MyAssistantFilter>>;
    setShowAllMyAssistants: Dispatch<SetStateAction<boolean>>;
    ownedAssistantIds: Set<string>;
    isSearching: boolean;
    filteredMyAssistants: AssistantCardData[];
    displayedMyAssistants: AssistantCardData[];
    hasHiddenMyAssistants: boolean;
    communityAssistants: AssistantCardData[];
    removeYoursAssistant: (assistantId: string) => void;
    removeSubscribedAssistant: (assistantId: string) => void;
    removeAssistantFromLists: (assistantId: string) => void;
}

const MY_ASSISTANTS_PREVIEW_LIMIT = 6;

const getSnapshotUpdatedAt = (snapshot: CommunityAssistantSnapshot): string | undefined => {
    const snapshotWithTimestamp = snapshot as CommunityAssistantSnapshot & {
        snapshotUpdatedAt?: string | null;
        updated_at?: string | null;
    };

    return snapshotWithTimestamp.snapshotUpdatedAt ?? snapshotWithTimestamp.updated_at ?? undefined;
};

const compareByTitle = (a: AssistantCardData, b: AssistantCardData): number => {
    const titleA = a.title.toLowerCase();
    const titleB = b.title.toLowerCase();
    if (titleA < titleB) return -1;
    if (titleA > titleB) return 1;
    return 0;
};

const compareByUpdated = (a: AssistantCardData, b: AssistantCardData): number => {
    const updatedA = a.updated ? new Date(a.updated).getTime() : Number.NEGATIVE_INFINITY;
    const updatedB = b.updated ? new Date(b.updated).getTime() : Number.NEGATIVE_INFINITY;
    return updatedB - updatedA;
};

const compareBySubscriptions = (a: AssistantCardData, b: AssistantCardData): number => {
    return b.subscriptions - a.subscriptions || compareByUpdated(a, b) || compareByTitle(a, b);
};

const compareByLastUsed = (a: AssistantCardData, b: AssistantCardData): number => {
    const lastUsedA = a.lastUsed ?? Number.NEGATIVE_INFINITY;
    const lastUsedB = b.lastUsed ?? Number.NEGATIVE_INFINITY;
    return lastUsedB - lastUsedA || compareByUpdated(a, b) || compareByTitle(a, b);
};

const sortFunctions: Record<SortKey, (a: AssistantCardData, b: AssistantCardData) => number> = {
    title: compareByTitle,
    updated: compareByUpdated,
    subscriptions: compareBySubscriptions,
    lastUsed: compareByLastUsed
};

const sortAssistants = (assistantsList: AssistantCardData[], method: SortKey): AssistantCardData[] => {
    return [...assistantsList].sort(sortFunctions[method] ?? compareByTitle);
};

export const useDiscoveryAssistantLists = ({
    assistantStorageService,
    communityAssistantStorageService
}: UseDiscoveryAssistantListsParams): UseDiscoveryAssistantListsResult => {
    const [allAssistants, setAllAssistants] = useState<AssistantCardData[]>([]);
    const [yoursAssistants, setYoursAssistants] = useState<AssistantCardData[]>([]);
    const [subscribedAssistants, setSubscribedAssistants] = useState<AssistantCardData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>("");
    const [communitySortMethod, setCommunitySortMethod] = useState<CommunitySortKey>(
        () => (localStorage.getItem("discovery_communitySortMethod") as CommunitySortKey) || "subscriptions"
    );
    const [myAssistantsSortMethod, setMyAssistantsSortMethod] = useState<SortKey>(
        () => (localStorage.getItem("discovery_myAssistantsSortMethod") as SortKey) || "lastUsed"
    );
    const [myAssistantFilter, setMyAssistantFilter] = useState<MyAssistantFilter>(
        () => (localStorage.getItem("discovery_myAssistantFilter") as MyAssistantFilter) || "all"
    );
    const [showAllMyAssistants, setShowAllMyAssistants] = useState(false);
    const [ownedAssistantIds, setOwnedAssistantIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        localStorage.setItem("discovery_communitySortMethod", communitySortMethod);
    }, [communitySortMethod]);

    useEffect(() => {
        localStorage.setItem("discovery_myAssistantsSortMethod", myAssistantsSortMethod);
    }, [myAssistantsSortMethod]);

    useEffect(() => {
        localStorage.setItem("discovery_myAssistantFilter", myAssistantFilter);
    }, [myAssistantFilter]);

    useEffect(() => {
        const fetchAssistants = async () => {
            setIsLoading(true);
            try {
                const [localAssistantsResponse, allAssistantsResponse, ownedAssistants, userSubscriptions, localCommunityAssistants, assistantChatRecords] =
                    await Promise.all([
                        assistantStorageService.getAllAssistantConfigs(),
                        getAllCommunityAssistantsApi(),
                        getOwnedCommunityAssistants(),
                        getUserSubscriptionsApi(),
                        communityAssistantStorageService.getAllAssistantConfigs(),
                        assistantStorageService.getChatStorageService().getAll()
                    ]);

                const ownedIds = new Set(ownedAssistants.map((a: AssistantResponse) => a.id));
                setOwnedAssistantIds(ownedIds);

                const assistantLastUsedById = new Map<string, number>();
                for (const chat of assistantChatRecords ?? []) {
                    if (!chat.id || !chat.id.startsWith(AssistantStorageService.CHAT_ID) || !chat._last_edited) continue;

                    const withoutPrefix = chat.id.substring(AssistantStorageService.CHAT_ID.length);
                    const lastUnderscore = withoutPrefix.lastIndexOf("_");
                    if (lastUnderscore === -1) continue;

                    const assistantId = withoutPrefix.substring(0, lastUnderscore);
                    const existingLastUsed = assistantLastUsedById.get(assistantId) ?? 0;
                    if (chat._last_edited > existingLastUsed) {
                        assistantLastUsedById.set(assistantId, chat._last_edited);
                    }
                }

                const toCardData = (a: AssistantResponse | CommunityAssistantSnapshot | Assistant, extra?: Partial<AssistantCardData>): AssistantCardData => {
                    const assistantId = a.id || "";
                    if ("latest_version" in a) {
                        return {
                            id: assistantId,
                            title: a.latest_version?.name || "Unknown Assistant",
                            description: a.latest_version?.description || "",
                            subscriptions: a.subscriptions_count || 0,
                            updated: a.updated_at || undefined,
                            lastUsed: assistantLastUsedById.get(assistantId),
                            tags: a.latest_version?.tags || [],
                            rawData: a,
                            ...extra
                        };
                    }

                    return {
                        id: assistantId,
                        title: a.title || "Unknown Assistant",
                        description: a.description || "",
                        subscriptions: 0,
                        updated: "snapshot_version" in a ? getSnapshotUpdatedAt(a as CommunityAssistantSnapshot) : undefined,
                        lastUsed: assistantLastUsedById.get(assistantId),
                        tags: a.tags || [],
                        rawData: a,
                        ...extra
                    };
                };

                setAllAssistants(allAssistantsResponse.map(a => toCardData(a)));

                const unpublishedLocalAssistants = localAssistantsResponse
                    .filter((assistant): assistant is Assistant & { id: string } => Boolean(assistant.id))
                    .filter(assistant => !ownedIds.has(assistant.id));

                setYoursAssistants([
                    ...ownedAssistants.map(a => toCardData(a, { isOwnedAssistant: true })),
                    ...unpublishedLocalAssistants.map(assistant => toCardData(assistant, { isLocalAssistant: true, isOwnedAssistant: true }))
                ]);

                const fullAssistantById = new Map<string, AssistantResponse>();
                allAssistantsResponse.forEach(a => fullAssistantById.set(a.id, a));
                ownedAssistants.forEach(a => fullAssistantById.set(a.id, a));

                const validLocalCommunityAssistants = localCommunityAssistants.filter(isCompleteCommunityAssistantSnapshot);
                const deletedCommunityAssistants = validLocalCommunityAssistants.filter(local => !fullAssistantById.has(local.id));

                const subscribedData = [
                    ...userSubscriptions
                        .map(sub => {
                            const fullData = fullAssistantById.get(sub.id);
                            const localData = validLocalCommunityAssistants.find(local => local.id === sub.id);
                            const assistantData = fullData || localData;

                            if (!assistantData) {
                                return null;
                            }

                            return toCardData(assistantData, {
                                subscriptions: fullData?.subscriptions_count ?? 0,
                                updated: fullData ? fullData.updated_at : localData ? getSnapshotUpdatedAt(localData) : undefined,
                                isDeletedSnapshot: !fullData,
                                isSubscribedAssistant: true
                            });
                        })
                        .filter((assistant): assistant is AssistantCardData => assistant !== null),
                    ...deletedCommunityAssistants.map(deleted =>
                        toCardData(deleted, {
                            subscriptions: 0,
                            updated: getSnapshotUpdatedAt(deleted),
                            isDeletedSnapshot: !fullAssistantById.has(deleted.id),
                            isSubscribedAssistant: true
                        })
                    )
                ];
                setSubscribedAssistants(subscribedData);
            } catch (error) {
                console.error("Failed to fetch assistants:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssistants();
    }, [assistantStorageService, communityAssistantStorageService]);

    const normalizedSearchText = searchText.trim().toLowerCase();
    const isSearching = normalizedSearchText.length > 0;
    const subscribedAssistantIds = useMemo(() => new Set(subscribedAssistants.map(assistant => assistant.id)), [subscribedAssistants]);

    const matchesSearch = useCallback(
        (assistant: AssistantCardData): boolean => {
            if (!normalizedSearchText) return true;

            return (
                assistant.title.toLowerCase().includes(normalizedSearchText) ||
                assistant.description.toLowerCase().includes(normalizedSearchText) ||
                assistant.tags.some(tag => tag.toLowerCase().includes(normalizedSearchText))
            );
        },
        [normalizedSearchText]
    );

    const myAssistants = useMemo(() => {
        const byId = new Map<string, AssistantCardData>();

        const addAssistant = (assistant: AssistantCardData) => {
            const existing = byId.get(assistant.id);
            const isOwned = assistant.isOwnedAssistant || ownedAssistantIds.has(assistant.id);
            if (!existing || isOwned) {
                byId.set(assistant.id, {
                    ...assistant,
                    isOwnedAssistant: isOwned,
                    isSubscribedAssistant: isOwned ? false : assistant.isSubscribedAssistant || subscribedAssistantIds.has(assistant.id)
                });
                return;
            }

            byId.set(assistant.id, {
                ...existing,
                isSubscribedAssistant: existing.isOwnedAssistant
                    ? false
                    : existing.isSubscribedAssistant || assistant.isSubscribedAssistant || subscribedAssistantIds.has(assistant.id)
            });
        };

        yoursAssistants.forEach(addAssistant);
        subscribedAssistants.forEach(addAssistant);

        return Array.from(byId.values());
    }, [ownedAssistantIds, subscribedAssistantIds, subscribedAssistants, yoursAssistants]);

    const filteredMyAssistants = useMemo(() => {
        const filtered = myAssistants.filter(assistant => {
            if (myAssistantFilter === "owned" && !assistant.isOwnedAssistant) return false;
            if (myAssistantFilter === "subscribed" && !assistant.isSubscribedAssistant) return false;
            return matchesSearch(assistant);
        });

        return sortAssistants(filtered, myAssistantsSortMethod);
    }, [matchesSearch, myAssistantFilter, myAssistants, myAssistantsSortMethod]);

    const communityAssistants = useMemo(() => {
        const filtered = allAssistants.filter(
            assistant => !ownedAssistantIds.has(assistant.id) && !subscribedAssistantIds.has(assistant.id) && matchesSearch(assistant)
        );

        return sortAssistants(filtered, communitySortMethod);
    }, [allAssistants, communitySortMethod, matchesSearch, ownedAssistantIds, subscribedAssistantIds]);

    const displayedMyAssistants = useMemo(() => {
        if (isSearching || showAllMyAssistants) return filteredMyAssistants;
        return filteredMyAssistants.slice(0, MY_ASSISTANTS_PREVIEW_LIMIT);
    }, [filteredMyAssistants, isSearching, showAllMyAssistants]);

    const hasHiddenMyAssistants = !isSearching && filteredMyAssistants.length > displayedMyAssistants.length;

    useEffect(() => {
        setShowAllMyAssistants(false);
    }, [myAssistantFilter, searchText]);

    const removeYoursAssistant = useCallback((assistantId: string) => {
        setYoursAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== assistantId));
    }, []);

    const removeSubscribedAssistant = useCallback((assistantId: string) => {
        setSubscribedAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== assistantId));
    }, []);

    const removeAssistantFromLists = useCallback((assistantId: string) => {
        setAllAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== assistantId));
        setYoursAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== assistantId));
        setSubscribedAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== assistantId));
    }, []);

    return {
        isLoading,
        searchText,
        setSearchText,
        communitySortMethod,
        setCommunitySortMethod,
        myAssistantsSortMethod,
        setMyAssistantsSortMethod,
        myAssistantFilter,
        setMyAssistantFilter,
        setShowAllMyAssistants,
        ownedAssistantIds,
        isSearching,
        filteredMyAssistants,
        displayedMyAssistants,
        hasHiddenMyAssistants,
        communityAssistants,
        removeYoursAssistant,
        removeSubscribedAssistant,
        removeAssistantFromLists
    };
};
