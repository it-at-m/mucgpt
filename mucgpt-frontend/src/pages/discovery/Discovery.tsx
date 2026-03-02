import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Title1, Body1, Text, SearchBox, Dropdown, Option, Button, ToggleButton, Tooltip } from "@fluentui/react-components";
import type { SearchBoxChangeEvent, InputOnChangeData, SelectionEvents, OptionOnSelectData } from "@fluentui/react-components";
import { ArrowSort24Regular, ArrowImport24Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Discovery.module.css";
import { getAllCommunityAssistantsApi, getOwnedCommunityAssistants, getUserSubscriptionsApi, deleteCommunityAssistantApi } from "../../api/assistant-client";
import { Assistant, AssistantResponse } from "../../api/models";
import { HeaderContext, DEFAULTHEADER } from "../layout/HeaderContextProvider";
import { AddAssistantButton } from "../../components/AddAssistantButton/AddAssistantButton";
import { CreateAssistantDialog } from "../../components/AssistantDialogs/CreateAssistantDialog/CreateAssistantDialog";
import { AssistantStorageService } from "../../service/assistantstorage";
import { ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { DiscoveryCard } from "../../components/DiscoveryCard/DiscoveryCard";
import { DiscoveryCardSkeleton } from "../../components/DiscoveryCard/DiscoveryCardSkeleton";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { CloseConfirmationDialog } from "../../components/AssistantDialogs/shared/CloseConfirmationDialog";

type SortKey = "title" | "updated" | "subscriptions";

const storageService = new AssistantStorageService(ASSISTANT_STORE);

const Discovery = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setHeader } = useContext(HeaderContext);
    const { showError, showSuccess } = useGlobalToastContext();

    const [assistants, setAssistants] = useState<AssistantCardData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>("");
    const [sortMethod, setSortMethod] = useState<SortKey>("subscriptions");
    const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const [filterScope, setFilterScope] = useState<"all" | "yours">("yours");
    const [ownedAssistantIds, setOwnedAssistantIds] = useState<Set<string>>(new Set());
    const [userSubscriptionIds, setUserSubscriptionIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

                const assistant: Assistant = {
                    title: importedData.title,
                    description: importedData.description || "",
                    system_message: importedData.system_message,
                    publish: false,
                    creativity: importedData.creativity || CREATIVITY_LOW,
                    default_model: importedData.default_model,
                    quick_prompts: importedData.quick_prompts || [],
                    examples: importedData.examples || [],
                    version: "0",
                    owner_ids: [],
                    tags: importedData.tags || [],
                    hierarchical_access: [],
                    tools: importedData.tools || [],
                    is_visible: true
                };

                const created_id = await storageService.createAssistantConfig(assistant);

                if (created_id) {
                    showSuccess(
                        t("components.import_assistant.import_success"),
                        t("components.import_assistant.import_success_message", { title: assistant.title })
                    );

                    navigate(`/assistant/${created_id}`);
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
                const [allAssistants, ownedAssistants, userSubscriptions] = await Promise.all([
                    getAllCommunityAssistantsApi(),
                    getOwnedCommunityAssistants(),
                    getUserSubscriptionsApi()
                ]);

                const ownedIds = new Set(ownedAssistants.map((a: AssistantResponse) => a.id));
                const subscribedIds = new Set(userSubscriptions.map((s: { id: string }) => s.id));
                setOwnedAssistantIds(ownedIds);
                setUserSubscriptionIds(subscribedIds);

                const cardData: AssistantCardData[] = allAssistants.map((response: AssistantResponse) => ({
                    id: response.id,
                    title: response.latest_version.name,
                    description: response.latest_version.description || "",
                    subscriptions: response.subscriptions_count || 0,
                    updated: response.updated_at,
                    tags: response.latest_version.tags || [],
                    rawData: response
                }));

                setAssistants(cardData);
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
        const filtered = assistants.filter(assistant => {
            const matchesSearch =
                !searchText.trim() ||
                assistant.title.toLowerCase().includes(lc) ||
                assistant.description.toLowerCase().includes(lc) ||
                (assistant.tags && assistant.tags.some(tag => tag.toLowerCase().includes(lc)));

            const matchesScope = filterScope === "all" || ownedAssistantIds.has(assistant.id) || userSubscriptionIds.has(assistant.id);

            return matchesSearch && matchesScope;
        });
        return sortAssistants(filtered, sortMethod);
    }, [assistants, searchText, filterScope, ownedAssistantIds, userSubscriptionIds, sortMethod, sortAssistants]);

    const handleSearch = (_event: SearchBoxChangeEvent | null, data: InputOnChangeData) => {
        setSearchText(data.value || "");
    };

    const handleFilterChange = (scope: "all" | "yours") => {
        setFilterScope(scope);
    };

    const handleSortChange = (_event: SelectionEvents, data: OptionOnSelectData) => {
        const newSortMethod = data.optionValue as SortKey;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    };

    const handleAssistantClick = (assistant: AssistantCardData) => {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        if (selectedAssistant?.id === assistant.id) {
            setIsDrawerOpen(false);
            closeTimerRef.current = setTimeout(() => setSelectedAssistant(null), 300);
        } else {
            setSelectedAssistant(assistant);
            setIsDrawerOpen(true);
        }
    };

    const startConversation = () => {
        if (selectedAssistant) {
            navigate(`/communityassistant/${selectedAssistant.id}`);
        }
    };

    const editAssistant = () => {
        if (selectedAssistant) {
            navigate(`/owned/communityassistant/${selectedAssistant.id}?edit=true`);
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
            setAssistants(prev => prev.filter((a: AssistantCardData) => a.id !== selectedAssistant.id));

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
                        {/* ... Header and Toolbar sections remain same ... */}
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
                                    <AddAssistantButton onClick={() => setShowCreateDialog(true)} />
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
                                <div>
                                    <ToggleButton
                                        className={`${styles.filterButton} ${filterScope === "all" ? styles.filterButtonActive : ""}`}
                                        checked={filterScope === "all"}
                                        onClick={() => handleFilterChange("all")}
                                    >
                                        {t("components.community_assistants.filter_all", "All")}
                                    </ToggleButton>
                                    <ToggleButton
                                        className={`${styles.filterButton} ${filterScope === "yours" ? styles.filterButtonActive : ""}`}
                                        checked={filterScope === "yours"}
                                        onClick={() => handleFilterChange("yours")}
                                    >
                                        {t("components.community_assistants.filter_yours", "Yours")}
                                    </ToggleButton>
                                </div>

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

                        <CreateAssistantDialog showDialogInput={showCreateDialog} setShowDialogInput={setShowCreateDialog} />

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
                                        onClick={() => handleAssistantClick(assistant)}
                                        descriptionLines={2}
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
        </div>
    );
};

export default Discovery;
