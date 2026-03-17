import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Title1, Body1, Text, SearchBox, Dropdown, Option, Button, Tooltip, TabList, Tab } from "@fluentui/react-components";
import type { SearchBoxChangeEvent, InputOnChangeData, SelectionEvents, OptionOnSelectData, SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import { ArrowSort24Regular, ArrowImport24Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Discovery.module.css";
import {
    getAllCommunityAssistantsApi,
    getOwnedCommunityAssistants,
    getUserSubscriptionsApi,
    deleteCommunityAssistantApi,
    createCommunityAssistantApi
} from "../../api/assistant-client";
import { AssistantResponse, CommunityAssistantSnapshot } from "../../api/models";
import { HeaderContext, DEFAULTHEADER } from "../layout/HeaderContextProvider";
import { AddAssistantButton } from "../../components/AddAssistantButton/AddAssistantButton";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { COMMUNITY_ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { DiscoveryCard } from "../../components/DiscoveryCard/DiscoveryCard";
import { DiscoveryCardSkeleton } from "../../components/DiscoveryCard/DiscoveryCardSkeleton";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { CloseConfirmationDialog } from "../../components/AssistantDialogs/shared/CloseConfirmationDialog";
import { downloadAssistantExport, mapVersionToExportData } from "../../utils/assistant-export";
import { useDuplicateAssistant } from "../../features/community-assistant-ownership/useDuplicateAssistant";
import { isCompleteCommunityAssistantSnapshot } from "../../utils/community-assistant-snapshots";

type SortKey = "title" | "updated" | "subscriptions";

const communityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

const Discovery = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setHeader } = useContext(HeaderContext);
    const { showError, showSuccess } = useGlobalToastContext();

    const [allAssistants, setAllAssistants] = useState<AssistantCardData[]>([]);
    const [yoursAssistants, setYoursAssistants] = useState<AssistantCardData[]>([]);
    const [subscribedAssistants, setSubscribedAssistants] = useState<AssistantCardData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>("");
    const [sortMethod, setSortMethod] = useState<SortKey>("subscriptions");

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const [filterScope, setFilterScope] = useState<"community" | "yours" | "subscribed">("community");
    const [ownedAssistantIds, setOwnedAssistantIds] = useState<Set<string>>(new Set());
    const [userSubscriptionIds, setUserSubscriptionIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { assistantToDuplicate, showDuplicateConfirm, setShowDuplicateConfirm, requestDuplicateAssistant, confirmDuplicateAssistant, resolveAssistantData } =
        useDuplicateAssistant();

    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        },
        []
    );

    useEffect(() => {
        setHeader(DEFAULTHEADER);
    }, [setHeader]);

    const exportAssistant = useCallback(async () => {
        if (!selectedAssistant) return;

        try {
            const assistantData = await resolveAssistantData(selectedAssistant.id, selectedAssistant.rawData);
            if (!("latest_version" in assistantData)) {
                throw new Error(t("components.import_assistant.import_invalid_format"));
            }

            const lv = assistantData.latest_version;
            if (!lv) {
                showError(t("components.assistantsettingsdrawer.export"), t("components.import_assistant.import_invalid_format"));
                return;
            }
            downloadAssistantExport(mapVersionToExportData(lv), lv.name);
            showSuccess(t("components.assistantsettingsdrawer.export"), `${lv.name}.json`);
        } catch (error) {
            console.error("Failed to export assistant", error);
            const errorMessage = error instanceof Error ? error.message : "Export failed";
            showError(t("components.assistantsettingsdrawer.export"), errorMessage);
        }
    }, [resolveAssistantData, selectedAssistant, showError, showSuccess, t]);

    const importAssistant = useCallback(() => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";

        fileInput.onchange = async (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const content = await file.text();
                const importedData = JSON.parse(content);

                if (!importedData.title || !importedData.system_message) {
                    throw new Error(t("components.import_assistant.import_invalid_format"));
                }

                const createdAssistant = await createCommunityAssistantApi({
                    name: importedData.title,
                    description: importedData.description || "",
                    system_prompt: importedData.system_message,
                    creativity: importedData.creativity || CREATIVITY_LOW,
                    default_model: importedData.default_model,
                    quick_prompts: importedData.quick_prompts || [],
                    examples: importedData.examples || [],
                    owner_ids: [],
                    tags: importedData.tags || [],
                    hierarchical_access: importedData.hierarchical_access || [],
                    tools: importedData.tools || [],
                    is_visible: importedData.is_visible || false
                });

                if (createdAssistant?.id) {
                    showSuccess(
                        t("components.import_assistant.import_success"),
                        t("components.import_assistant.import_success_message", { title: importedData.title })
                    );

                    navigate(`/owned/communityassistant/${createdAssistant.id}`);
                } else {
                    throw new Error(t("components.import_assistant.import_save_failed"));
                }
            } catch (error) {
                console.error("Failed to import assistant", error);
                const errorMessage = error instanceof Error ? error.message : t("components.import_assistant.import_failed");
                showError(t("components.import_assistant.import_error"), errorMessage);
            }
        };

        fileInput.click();
    }, [t, showSuccess, showError, navigate]);

    const compareByTitle = (a: AssistantCardData, b: AssistantCardData): number => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        return 0;
    };

    const compareByUpdated = (a: AssistantCardData, b: AssistantCardData): number => {
        const updatedA = new Date(a.updated).getTime();
        const updatedB = new Date(b.updated).getTime();
        return updatedB - updatedA;
    };

    const compareBySubscriptions = (a: AssistantCardData, b: AssistantCardData): number => {
        return b.subscriptions - a.subscriptions;
    };

    const getSortFunction = useCallback((method: SortKey) => {
        switch (method) {
            case "title":
                return compareByTitle;
            case "updated":
                return compareByUpdated;
            case "subscriptions":
                return compareBySubscriptions;
            default:
                return compareByTitle;
        }
    }, []);

    const sortAssistants = useCallback(
        (assistantsList: AssistantCardData[], method: SortKey): AssistantCardData[] => {
            return [...assistantsList].sort(getSortFunction(method));
        },
        [getSortFunction]
    );

    useEffect(() => {
        const fetchAssistants = async () => {
            setIsLoading(true);
            try {
                const [allAssistantsResponse, ownedAssistants, userSubscriptions, localCommunityAssistants] = await Promise.all([
                    getAllCommunityAssistantsApi(),
                    getOwnedCommunityAssistants(),
                    getUserSubscriptionsApi(),
                    communityAssistantStorageService.getAllAssistantConfigs()
                ]);

                const ownedIds = new Set(ownedAssistants.map((a: AssistantResponse) => a.id));
                const subscribedIds = new Set(userSubscriptions.map((s: { id: string }) => s.id));
                setOwnedAssistantIds(ownedIds);
                setUserSubscriptionIds(subscribedIds);

                const toCardData = (a: AssistantResponse | CommunityAssistantSnapshot, extra?: Partial<AssistantCardData>): AssistantCardData => ({
                    id: a.id,
                    title: "latest_version" in a ? a.latest_version.name : a.title,
                    description: "latest_version" in a ? a.latest_version.description || "" : a.description || "",
                    subscriptions: "subscriptions_count" in a ? a.subscriptions_count || 0 : 0,
                    updated: "updated_at" in a ? a.updated_at : new Date().toISOString(),
                    tags: "latest_version" in a ? a.latest_version.tags || [] : a.tags || [],
                    rawData: a,
                    ...extra
                });

                // 1. All published assistants
                setAllAssistants(allAssistantsResponse.map(a => toCardData(a)));

                // 2. Yours no matter if published or private
                setYoursAssistants(ownedAssistants.map(a => toCardData(a)));

                const fullAssistantById = new Map<string, AssistantResponse>();
                allAssistantsResponse.forEach(a => fullAssistantById.set(a.id, a));
                ownedAssistants.forEach(a => fullAssistantById.set(a.id, a));

                // 3. Every assistant subscribed to, merged with deleted ones
                const validLocalCommunityAssistants = localCommunityAssistants.filter(isCompleteCommunityAssistantSnapshot);

                const deletedCommunityAssistants = validLocalCommunityAssistants
                    .filter(local => !userSubscriptions.some((sub: any) => sub.id === local.id))
                    .filter(deleted => !ownedAssistants.some((own: any) => own.id === deleted.id));

                const subscribedData = [
                    ...userSubscriptions.map((sub: any) => {
                        const fullData = fullAssistantById.get(sub.id);
                        const localData = validLocalCommunityAssistants.find(local => local.id === sub.id);
                        return toCardData(fullData || localData || sub, { subscriptions: fullData?.subscriptions_count || 0 });
                    }),
                    ...deletedCommunityAssistants.map(deleted => toCardData(deleted, { subscriptions: 0, isDeletedSnapshot: true }))
                ];
                setSubscribedAssistants(subscribedData);
            } catch (error) {
                console.error("Failed to fetch assistants:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssistants();
    }, []);

    const filteredAssistants = useMemo(() => {
        const lc = searchText.toLowerCase();

        let sourceList = allAssistants.filter(assistant => !ownedAssistantIds.has(assistant.id) && !userSubscriptionIds.has(assistant.id));
        if (filterScope === "yours") {
            sourceList = yoursAssistants;
        } else if (filterScope === "subscribed") {
            sourceList = subscribedAssistants;
        }

        const filtered = sourceList.filter(assistant => {
            const matchesSearch =
                !searchText.trim() ||
                assistant.title.toLowerCase().includes(lc) ||
                assistant.description.toLowerCase().includes(lc) ||
                (assistant.tags && assistant.tags.some(tag => tag.toLowerCase().includes(lc)));

            return matchesSearch;
        });
        return sortAssistants(filtered, sortMethod);
    }, [allAssistants, yoursAssistants, subscribedAssistants, searchText, filterScope, sortMethod, sortAssistants, ownedAssistantIds, userSubscriptionIds]);

    const handleSearch = (_event: SearchBoxChangeEvent | null, data: InputOnChangeData) => {
        setSearchText(data.value || "");
    };

    const handleFilterChange = (scope: "community" | "yours" | "subscribed") => {
        setFilterScope(scope);
    };

    const handleSortChange = (_event: SelectionEvents, data: OptionOnSelectData) => {
        const newSortMethod = data.optionValue as SortKey;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    };

    const handleAssistantClick = async (assistant: AssistantCardData) => {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        if (selectedAssistant?.id === assistant.id) {
            setIsDrawerOpen(false);
            closeTimerRef.current = setTimeout(() => setSelectedAssistant(null), 300);
        } else {
            try {
                const resolvedData = await resolveAssistantData(assistant.id, assistant.rawData);
                setSelectedAssistant({
                    ...assistant,
                    title: "latest_version" in resolvedData ? resolvedData.latest_version.name : resolvedData.title,
                    description: "latest_version" in resolvedData ? resolvedData.latest_version.description || "" : resolvedData.description || "",
                    tags: "latest_version" in resolvedData ? resolvedData.latest_version.tags || [] : resolvedData.tags || [],
                    rawData: resolvedData
                });
                setIsDrawerOpen(true);
            } catch (error) {
                console.error("Failed to load assistant details:", error);
                const errorMessage = error instanceof Error ? error.message : t("components.assistant_chat.load_assistant_failed_message");
                showError(t("components.assistant_chat.load_assistant_failed"), errorMessage);
            }
        }
    };

    const startConversation = () => {
        if (selectedAssistant) {
            navigate(`/${selectedAssistant.isDeletedSnapshot ? "deleted/communityassistant" : "communityassistant"}/${selectedAssistant.id}`);
        }
    };

    const editAssistant = () => {
        if (selectedAssistant) {
            navigate(`/owned/communityassistant/${selectedAssistant.id}/edit`);
        }
    };

    const deleteAssistant = () => {
        if (selectedAssistant) {
            setShowDeleteConfirm(true);
        }
    };

    const performDelete = async () => {
        if (!selectedAssistant) return;
        try {
            await deleteCommunityAssistantApi(selectedAssistant.id);
            showSuccess(
                t("components.assistant_chat.delete_assistant_success"),
                t("components.assistant_chat.delete_assistant_success_message", { title: selectedAssistant.title })
            );
            setAllAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== selectedAssistant.id));
            setYoursAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== selectedAssistant.id));
            setSubscribedAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== selectedAssistant.id));

            if (closeTimerRef.current !== null) {
                clearTimeout(closeTimerRef.current);
            }
            setIsDrawerOpen(false);
            closeTimerRef.current = setTimeout(() => setSelectedAssistant(null), 300);
        } catch (err) {
            showError(
                t("components.assistant_chat.delete_assistant_failed"),
                err instanceof Error ? err.message : t("components.assistant_chat.delete_assistant_failed_message")
            );
        }
    };

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.flexContainer} data-drawer-open={isDrawerOpen}>
                <div className={styles.mainContent}>
                    <div className={styles.contentWrapper}>
                        <div className={styles.headerSection}>
                            <div className={styles.titleBlock}>
                                <Title1 className={styles.header}>{t("discovery.title", "Discover Assistants")}</Title1>
                                <Body1 className={styles.subtitle}>{t("discovery.subtitle", "Supercharge your workflow with specialized AI agents.")}</Body1>
                            </div>
                            <div className={styles.actionBlock}>
                                <div className={styles.actionButtonsContainer}>
                                    <Tooltip content={t("components.import_assistant.import")} relationship="description" positioning="below">
                                        <Button
                                            className={styles.importButton}
                                            appearance="outline"
                                            icon={<ArrowImport24Filled />}
                                            onClick={importAssistant}
                                            size="large"
                                            aria-label={t("components.import_assistant.import")}
                                        >
                                            {t("components.import_assistant.import")}
                                        </Button>
                                    </Tooltip>
                                    <AddAssistantButton onClick={() => navigate("/assistant/create")} />
                                </div>
                            </div>
                        </div>

                        <div className={styles.toolbarSection}>
                            <SearchBox
                                placeholder={t("components.community_assistants.search", "Search assistants")}
                                value={searchText}
                                onChange={handleSearch}
                                className={styles.searchBox}
                                size="large"
                            />

                            <div className={styles.controlsSection}>
                                <TabList
                                    selectedValue={filterScope}
                                    onTabSelect={(_event: SelectTabEvent, data: SelectTabData) => {
                                        if (data.value === "community" || data.value === "yours" || data.value === "subscribed") {
                                            handleFilterChange(data.value as "community" | "yours" | "subscribed");
                                        }
                                    }}
                                >
                                    <Tab value="community">{t("components.community_assistants.filter_all", "Community")}</Tab>
                                    <Tab value="yours">{t("components.community_assistants.filter_yours", "Yours")}</Tab>
                                    <Tab value="subscribed">{t("components.community_assistants.filter_subscribed", "Abonniert")}</Tab>
                                </TabList>

                                <div className={styles.sortSection}>
                                    <Tooltip content={t("components.community_assistants.sort_by_tooltip", "Change sorting")} relationship="label">
                                        <ArrowSort24Regular />
                                    </Tooltip>
                                    <span className={styles.sortLabel}>
                                        <Text>{t("components.community_assistants.sort_by", "Sort by")}</Text>
                                    </span>
                                    <Dropdown
                                        id="sort"
                                        value={
                                            sortMethod === "title"
                                                ? t("components.community_assistants.sort_title", "Title")
                                                : sortMethod === "updated"
                                                  ? t("components.community_assistants.sort_updated", "Last updated")
                                                  : t("components.community_assistants.sort_subscriptions", "Subscriptions")
                                        }
                                        selectedOptions={[sortMethod]}
                                        appearance="outline"
                                        className={styles.sortDropdown}
                                        onOptionSelect={handleSortChange}
                                    >
                                        <Option value="title" text={t("components.community_assistants.sort_title", "Title")}>
                                            {t("components.community_assistants.sort_title", "Title")}
                                        </Option>
                                        <Option value="updated" text={t("components.community_assistants.sort_updated", "Last updated")}>
                                            {t("components.community_assistants.sort_updated", "Last updated")}
                                        </Option>
                                        <Option value="subscriptions" text={t("components.community_assistants.sort_subscriptions", "Subscriptions")}>
                                            {t("components.community_assistants.sort_subscriptions", "Subscriptions")}
                                        </Option>
                                    </Dropdown>
                                </div>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className={styles.assistantsGrid}>
                                {Array.from({ length: 12 }).map((_, index) => (
                                    <DiscoveryCardSkeleton key={index} />
                                ))}
                            </div>
                        ) : filteredAssistants.length === 0 ? (
                            <div className={styles.noResults}>
                                <Text size={400}>{t("components.community_assistants.no_assistants_found", "No assistants found")}</Text>
                            </div>
                        ) : (
                            <div className={styles.assistantsGrid}>
                                {filteredAssistants.map(assistant => (
                                    <DiscoveryCard
                                        key={assistant.id}
                                        id={assistant.id}
                                        title={assistant.title}
                                        description={assistant.description}
                                        badge={assistant.isDeletedSnapshot ? t("components.community_assistants.deleted_badge") : undefined}
                                        onClick={() => handleAssistantClick(assistant)}
                                        isSelected={selectedAssistant?.id === assistant.id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <AssistantDetailsSidebar
                    isOpen={isDrawerOpen}
                    onClose={() => {
                        setIsDrawerOpen(false);
                        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
                        closeTimerRef.current = setTimeout(() => setSelectedAssistant(null), 300);
                    }}
                    assistant={selectedAssistant}
                    ownedAssistantIds={ownedAssistantIds}
                    onStartChat={startConversation}
                    onEdit={editAssistant}
                    onDuplicate={() => requestDuplicateAssistant(selectedAssistant)}
                    onExport={exportAssistant}
                    onDelete={deleteAssistant}
                />
            </div>

            <CloseConfirmationDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirmClose={performDelete}
                title={t("components.assistantsettingsdrawer.deleteDialog.title")}
                message={t("components.assistantsettingsdrawer.deleteDialog.content")}
                confirmLabel={t("components.assistantsettingsdrawer.deleteDialog.confirm")}
            />
            <CloseConfirmationDialog
                open={showDuplicateConfirm}
                onOpenChange={setShowDuplicateConfirm}
                onConfirmClose={confirmDuplicateAssistant}
                title={t("components.community_assistants.duplicate_confirm_title")}
                message={t(
                    assistantToDuplicate?.isDeletedSnapshot
                        ? "components.community_assistants.duplicate_confirm_message_deleted"
                        : "components.community_assistants.duplicate_confirm_message",
                    { title: assistantToDuplicate?.title ?? "" }
                )}
                confirmLabel={t("components.community_assistants.duplicate_confirm_action")}
            />
        </div>
    );
};

export default Discovery;
