import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Title1,
    Body1,
    Spinner,
    Text,
    SearchBox,
    Dropdown,
    Option,
    Button,
    Tooltip
} from "@fluentui/react-components";
import {
    ArrowSort24Regular,
    ArrowImport24Filled
} from "@fluentui/react-icons";
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
import { AssistantDetailsSidebar } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";

interface AssistantCardData {
    id: string;
    title: string;
    description: string;
    subscriptions: number;
    updated: string;
    tags: string[];
    rawData: AssistantResponse;
}

const storageService = new AssistantStorageService(ASSISTANT_STORE);

const Discovery = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { setHeader } = useContext(HeaderContext);
    const { showError, showSuccess } = useGlobalToastContext();

    const [assistants, setAssistants] = useState<AssistantCardData[]>([]);
    const [filteredAssistants, setFilteredAssistants] = useState<AssistantCardData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [searchText, setSearchText] = useState<string>("");
    const [sortMethod, setSortMethod] = useState<string>(t("components.community_assistants.sort_subscriptions"));
    const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const [filterScope, setFilterScope] = useState<'all' | 'yours'>('yours');
    const [ownedAssistantIds, setOwnedAssistantIds] = useState<Set<string>>(new Set());

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
                    throw new Error(t("components.create_assistant_dialog.import_invalid_format"));
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
                        t("components.create_assistant_dialog.import_success"),
                        t("components.create_assistant_dialog.import_success_message", { title: assistant.title })
                    );

                    navigate(`/assistant/${created_id}`);
                } else {
                    throw new Error(t("components.create_assistant_dialog.import_save_failed"));
                }
            } catch (error) {
                console.error("Failed to import assistant", error);
                const errorMessage = error instanceof Error ? error.message : t("components.create_assistant_dialog.import_failed");
                showError(t("components.create_assistant_dialog.import_error"), errorMessage);
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

    const getSortFunction = useCallback((method: string) => {
        const titleLabel = t("components.community_assistants.sort_title");
        const updatedLabel = t("components.community_assistants.sort_updated");
        const subscriptionsLabel = t("components.community_assistants.sort_subscriptions");

        switch (method) {
            case titleLabel:
                return compareByTitle;
            case updatedLabel:
                return compareByUpdated;
            case subscriptionsLabel:
                return compareBySubscriptions;
            default:
                return compareByTitle;
        }
    }, [t]);

    const sortAssistants = useCallback((assistantsList: AssistantCardData[], method: string): AssistantCardData[] => {
        return [...assistantsList].sort(getSortFunction(method));
    }, [getSortFunction]);

    useEffect(() => {
        const fetchAssistants = async () => {
            setIsLoading(true);
            try {
                const [allAssistants, ownedAssistants] = await Promise.all([
                    getAllCommunityAssistantsApi(),
                    getOwnedCommunityAssistants(),
                    getUserSubscriptionsApi()
                ]);

                const ownedIds = new Set(ownedAssistants.map((a: AssistantResponse) => a.id));
                setOwnedAssistantIds(ownedIds);

                const cardData: AssistantCardData[] = allAssistants.map((response: AssistantResponse) => ({
                    id: response.id,
                    title: response.latest_version.name,
                    description: response.latest_version.description || "",
                    subscriptions: response.subscriptions_count || 0,
                    updated: response.updated_at,
                    tags: response.latest_version.tags || [],
                    rawData: response
                }));


                const sortedData = sortAssistants(cardData, sortMethod);
                setAssistants(sortedData);
                setFilteredAssistants(sortedData);
            } catch (error) {
                console.error("Failed to fetch assistants:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAssistants();
    }, []);

    useEffect(() => {
        if (assistants.length > 0) {
            handleSearch(null, { value: searchText });
        }
    }, [sortMethod, filterScope, assistants.length, ownedAssistantIds.size]);

    const handleSearch = (event: any, data: any) => {
        const newValue = data.value || "";
        setSearchText(newValue);
        const lowerCaseSearch = newValue.toLowerCase();

        const filtered = assistants.filter(assistant => {
            const matchesSearch = !newValue.trim() || (
                assistant.title.toLowerCase().includes(lowerCaseSearch) ||
                assistant.description.toLowerCase().includes(lowerCaseSearch) ||
                (assistant.tags && assistant.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearch)))
            );

            const matchesScope = filterScope === 'all' || (filterScope === 'yours' && ownedAssistantIds.has(assistant.id));

            return matchesSearch && matchesScope;
        });

        setFilteredAssistants(sortAssistants(filtered, sortMethod));
    };

    const handleFilterChange = (scope: 'all' | 'yours') => {
        setFilterScope(scope);
    };

    const handleSortChange = (event: any, data: any) => {
        const newSortMethod = data.optionValue;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    };

    const handleAssistantClick = (assistant: AssistantCardData) => {
        if (selectedAssistant?.id === assistant.id) {
            setIsDrawerOpen(false);
            setSelectedAssistant(null);
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

    const deleteAssistant = async () => {
        if (!selectedAssistant) return;
        try {
            await deleteCommunityAssistantApi(selectedAssistant.id);
            showSuccess(
                t("components.assistant_chat.delete_assistant_success"),
                t("components.assistant_chat.delete_assistant_success_message", { title: selectedAssistant.title })
            );
            setAssistants(prev => prev.filter(a => a.id !== selectedAssistant.id));
            setFilteredAssistants(prev => prev.filter(a => a.id !== selectedAssistant.id));
            setIsDrawerOpen(false);
            setSelectedAssistant(null);
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
                                    <Tooltip content={t("components.create_assistant_dialog.import")} relationship="description" positioning="below">
                                        <Button
                                            className={styles.importButton}
                                            appearance="outline"
                                            icon={<ArrowImport24Filled />}
                                            onClick={importAssistant}
                                            size="large"
                                            aria-label={t("components.create_assistant_dialog.import")}
                                        >
                                            {t("components.create_assistant_dialog.import")}
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
                                    <button
                                        className={`${styles.filterButton} ${filterScope === 'all' ? styles.filterButtonActive : ''}`}
                                        onClick={() => handleFilterChange('all')}
                                    >
                                        {t("components.community_assistants.filter_all", "All")}
                                    </button>
                                    <button
                                        className={`${styles.filterButton} ${filterScope === 'yours' ? styles.filterButtonActive : ''}`}
                                        onClick={() => handleFilterChange('yours')}
                                    >
                                        {t("components.community_assistants.filter_yours", "Yours")}
                                    </button>
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
                                        value={sortMethod}
                                        selectedOptions={[sortMethod]}
                                        appearance="outline"
                                        className={styles.sortDropdown}
                                        onOptionSelect={handleSortChange}
                                    >
                                        <Option value={t("components.community_assistants.sort_title", "Title")} text={t("components.community_assistants.sort_title", "Title")}>
                                            {t("components.community_assistants.sort_title", "Title")}
                                        </Option>
                                        <Option value={t("components.community_assistants.sort_updated", "Last updated")} text={t("components.community_assistants.sort_updated", "Last updated")}>
                                            {t("components.community_assistants.sort_updated", "Last updated")}
                                        </Option>
                                        <Option value={t("components.community_assistants.sort_subscriptions", "Subscriptions")} text={t("components.community_assistants.sort_subscriptions", "Subscriptions")}>
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
                    onClose={() => { setIsDrawerOpen(false); setTimeout(() => setSelectedAssistant(null), 300); }}
                    assistant={selectedAssistant}
                    ownedAssistantIds={ownedAssistantIds}
                    onStartChat={startConversation}
                    onEdit={editAssistant}
                    onDelete={deleteAssistant}
                />

            </div>
        </div>
    );
};

export default Discovery;
