import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Title1, Body1, Text, SearchBox, Dropdown, Option, Button, Tooltip } from "@fluentui/react-components";
import type { SearchBoxChangeEvent, InputOnChangeData, SelectionEvents, OptionOnSelectData } from "@fluentui/react-components";
import { Add24Regular, DocumentArrowUpRegular, LibraryRegular, PeopleCommunityRegular, SearchRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./Discovery.module.css";
import { getCommunityAssistantApi, deleteCommunityAssistantApi, createCommunityAssistantApi } from "../../api/assistant-client";
import { Assistant, AssistantResponse, CommunityAssistantSnapshot } from "../../api/models";
import { AddAssistantButton } from "../../components/AddAssistantButton/AddAssistantButton";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { DiscoveryCard } from "../../components/DiscoveryCard/DiscoveryCard";
import type { DiscoveryCardBadge } from "../../components/DiscoveryCard/DiscoveryCard";
import { DiscoveryCardSkeleton } from "../../components/DiscoveryCard/DiscoveryCardSkeleton";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { CloseConfirmationDialog } from "../../components/AssistantDialogs/shared/CloseConfirmationDialog";
import { useDuplicateAssistant } from "./hooks/useDuplicateAssistant";
import { useDiscoveryAssistantLists } from "./hooks/useDiscoveryAssistantLists";
import { useMigrateLocalAssistant } from "../../hooks/useMigrateLocalAssistant";
import { downloadAssistantExport, mapAssistantToExportData, mapVersionToExportData } from "../../utils/assistant-export";
import { isCompleteCommunityAssistantSnapshot, mapCommunitySnapshotToAssistant } from "../../utils/community-assistant-snapshots";
import { ApiError } from "../../api/fetch-utils";

const communityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);
const assistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
const isAssistantResponse = (data: AssistantResponse | CommunityAssistantSnapshot): data is AssistantResponse =>
    "latest_version" in data && data.latest_version != null && typeof data.latest_version.name === "string";

type EmptyStateAction = {
    label: string;
    onClick: () => void;
    appearance?: "primary" | "secondary" | "outline" | "subtle" | "transparent";
    icon?: ReactElement;
};

type SectionEmptyStateProps = {
    icon: ReactElement;
    title: string;
    description: string;
    actions?: EmptyStateAction[];
};

const Discovery = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showError, showSuccess } = useGlobalToastContext();

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedAssistant, setSelectedAssistant] = useState<AssistantCardData | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const {
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
        removeAssistantFromLists
    } = useDiscoveryAssistantLists({ assistantStorageService, communityAssistantStorageService });
    const {
        assistantToDuplicate,
        showDuplicateConfirm,
        isDuplicating,
        setShowDuplicateConfirm,
        requestDuplicateAssistant,
        confirmDuplicateAssistant,
        resolveAssistantData
    } = useDuplicateAssistant();

    const {
        showMigrateConfirm: showLocalMigrateConfirm,
        setShowMigrateConfirm: setShowLocalMigrateConfirm,
        performMigration
    } = useMigrateLocalAssistant(assistantStorageService);

    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestRequestRef = useRef(0);
    useEffect(
        () => () => {
            if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        },
        []
    );

    const closeDrawerAndClearSelection = useCallback(() => {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
        }
        setIsDrawerOpen(false);
        closeTimerRef.current = setTimeout(() => setSelectedAssistant(null), 300);
    }, []);

    const exportAssistant = useCallback(async () => {
        if (!selectedAssistant || selectedAssistant.isLocalAssistant) return;

        try {
            try {
                const assistantData = await getCommunityAssistantApi(selectedAssistant.id);
                const lv = assistantData?.latest_version;

                if (!lv) {
                    throw new Error(t("components.import_assistant.import_invalid_format"));
                }

                downloadAssistantExport(mapVersionToExportData(lv), lv.name);
                showSuccess(t("components.assistantsettingsdrawer.export"), `${lv.name}.json`);
                return;
            } catch (error) {
                if (!(error instanceof ApiError) || error.status !== 404) {
                    throw error;
                }
            }

            const snapshotData = selectedAssistant.rawData;
            if (isCompleteCommunityAssistantSnapshot(snapshotData)) {
                const snapshotAssistant: Assistant = mapCommunitySnapshotToAssistant(snapshotData);
                downloadAssistantExport(mapAssistantToExportData(snapshotAssistant), snapshotAssistant.title);
                showSuccess(t("components.assistantsettingsdrawer.export"), `${snapshotAssistant.title}.json`);
                return;
            }

            const assistantData = await resolveAssistantData(selectedAssistant.id, selectedAssistant.rawData as AssistantResponse | CommunityAssistantSnapshot);
            if ("latest_version" in assistantData && assistantData.latest_version) {
                const lv = assistantData.latest_version;
                downloadAssistantExport(mapVersionToExportData(lv), lv.name);
                showSuccess(t("components.assistantsettingsdrawer.export"), `${lv.name}.json`);
                return;
            }

            if (isCompleteCommunityAssistantSnapshot(assistantData)) {
                const snapshotAssistant: Assistant = mapCommunitySnapshotToAssistant(assistantData);
                downloadAssistantExport(mapAssistantToExportData(snapshotAssistant), snapshotAssistant.title);
                showSuccess(t("components.assistantsettingsdrawer.export"), `${snapshotAssistant.title}.json`);
                return;
            }

            throw new Error(t("components.import_assistant.import_invalid_format"));
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

    const handleSearch = (_event: SearchBoxChangeEvent | null, data: InputOnChangeData) => {
        setSearchText(data.value || "");
    };

    const handleCommunitySortChange = (_event: SelectionEvents, data: OptionOnSelectData) => {
        if (data.optionValue === "subscriptions" || data.optionValue === "updated" || data.optionValue === "title") {
            setCommunitySortMethod(data.optionValue);
        }
    };

    const selectedCommunitySortLabel =
        communitySortMethod === "subscriptions"
            ? t("components.community_assistants.sort_popular", "Beliebteste")
            : communitySortMethod === "updated"
              ? t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")
              : t("components.community_assistants.sort_title", "Name");

    const handleMyAssistantsSortChange = (_event: SelectionEvents, data: OptionOnSelectData) => {
        if (data.optionValue === "subscriptions" || data.optionValue === "updated" || data.optionValue === "title" || data.optionValue === "lastUsed") {
            setMyAssistantsSortMethod(data.optionValue as "subscriptions" | "updated" | "title" | "lastUsed");
        }
    };

    const selectedMyAssistantsSortLabel =
        myAssistantsSortMethod === "lastUsed"
            ? t("components.community_assistants.sort_last_used", "Zuletzt benutzt")
            : myAssistantsSortMethod === "subscriptions"
              ? t("components.community_assistants.sort_popular", "Beliebteste")
              : myAssistantsSortMethod === "updated"
                ? t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")
                : t("components.community_assistants.sort_title", "Name");

    const getAssistantBadges = (assistant: AssistantCardData): DiscoveryCardBadge[] => {
        const badges: DiscoveryCardBadge[] = [];

        if (assistant.isLocalAssistant) {
            badges.push({
                label: t("components.community_assistants.local_badge", "Lokal"),
                color: "warning",
                tone: "warning"
            });
        }

        if (assistant.isDeletedSnapshot) {
            badges.push({
                label: t("components.community_assistants.deleted_badge", "Gelöscht"),
                color: "danger",
                tone: "danger"
            });
        }

        return badges;
    };

    const isAssistantPrivate = (assistant: AssistantCardData): boolean => {
        if (assistant.isLocalAssistant) {
            return true;
        }

        if ("is_visible" in assistant.rawData) {
            return assistant.rawData.is_visible === false;
        }

        return false;
    };

    const getMetadataStartLabel = (assistant: AssistantCardData): string | undefined => {
        return assistant.isOwnedAssistant
            ? t("components.community_assistants.metadata_you", "Du")
            : t("components.community_assistants.filter_all", "Community");
    };

    const handleAssistantClick = async (assistant: AssistantCardData) => {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        if (selectedAssistant?.id === assistant.id) {
            closeDrawerAndClearSelection();
        } else {
            const requestId = ++latestRequestRef.current;
            try {
                if (assistant.isLocalAssistant) {
                    setSelectedAssistant(assistant);
                    setIsDrawerOpen(true);
                    return;
                }

                const resolvedData = await resolveAssistantData(assistant.id, assistant.rawData as AssistantResponse | CommunityAssistantSnapshot);
                if (requestId !== latestRequestRef.current) return;
                const resolvedTitle = isAssistantResponse(resolvedData) ? resolvedData.latest_version.name : resolvedData.title;
                const resolvedDescription = isAssistantResponse(resolvedData) ? resolvedData.latest_version.description || "" : resolvedData.description || "";
                const resolvedTags = isAssistantResponse(resolvedData) ? resolvedData.latest_version.tags || [] : resolvedData.tags || [];
                setSelectedAssistant({
                    ...assistant,
                    title: resolvedTitle,
                    description: resolvedDescription,
                    tags: resolvedTags,
                    rawData: resolvedData
                });
                setIsDrawerOpen(true);
            } catch (error) {
                if (requestId !== latestRequestRef.current) return;
                console.error("Failed to load assistant details:", error);
                const errorMessage = error instanceof Error ? error.message : t("components.assistant_chat.load_assistant_failed_message");
                showError(t("components.assistant_chat.load_assistant_failed"), errorMessage);
            }
        }
    };

    const startConversation = () => {
        if (selectedAssistant) {
            if (selectedAssistant.isLocalAssistant) {
                navigate(`/assistant/${selectedAssistant.id}`);
                return;
            }
            navigate(`/${selectedAssistant.isDeletedSnapshot ? "deleted/communityassistant" : "communityassistant"}/${selectedAssistant.id}`);
        }
    };

    const editAssistant = () => {
        if (selectedAssistant) {
            if (selectedAssistant.isLocalAssistant) {
                navigate(`/assistant/${selectedAssistant.id}/edit#visibility-settings`);
                return;
            }
            navigate(`/owned/communityassistant/${selectedAssistant.id}/edit`);
        }
    };

    const deleteAssistant = () => {
        if (selectedAssistant) {
            setShowDeleteConfirm(true);
        }
    };

    const performLocalMigration = async () => {
        if (!selectedAssistant?.isLocalAssistant) return;
        await performMigration(selectedAssistant.rawData as Assistant, selectedAssistant.id, selectedAssistant.title, () => {
            removeYoursAssistant(selectedAssistant.id);
            closeDrawerAndClearSelection();
        });
    };

    const performDelete = async () => {
        if (!selectedAssistant) return;
        try {
            if (selectedAssistant.isLocalAssistant) {
                await assistantStorageService.deleteConfigAndChatsForAssistant(selectedAssistant.id);
            } else if (selectedAssistant.isDeletedSnapshot) {
                await communityAssistantStorageService.deleteConfigForAssistant(selectedAssistant.id);
                await assistantStorageService.deleteChatsForAssistant(selectedAssistant.id);
            } else {
                await deleteCommunityAssistantApi(selectedAssistant.id);
            }
            showSuccess(
                t("components.assistant_chat.delete_assistant_success"),
                t("components.assistant_chat.delete_assistant_success_message", { title: selectedAssistant.title })
            );
            removeAssistantFromLists(selectedAssistant.id);
            closeDrawerAndClearSelection();
        } catch (err) {
            showError(
                t("components.assistant_chat.delete_assistant_failed"),
                err instanceof Error ? err.message : t("components.assistant_chat.delete_assistant_failed_message")
            );
        }
    };

    const renderAssistantCard = (assistant: AssistantCardData) => (
        <DiscoveryCard
            key={assistant.id}
            id={assistant.id}
            title={assistant.title}
            description={assistant.description}
            badges={getAssistantBadges(assistant)}
            metadataStartLabel={getMetadataStartLabel(assistant)}
            subscriberCount={assistant.subscriptions}
            isPrivate={isAssistantPrivate(assistant)}
            privateLabel={t("components.community_assistants.private_label", "Privat")}
            onClick={() => handleAssistantClick(assistant)}
            isSelected={selectedAssistant?.id === assistant.id}
            role="listitem"
            aria-label={assistant.title}
        />
    );

    const renderAssistantGrid = (assistants: AssistantCardData[], ariaLabel: string) => (
        <div className={styles.assistantsGrid} role="list" aria-label={ariaLabel}>
            {assistants.map(renderAssistantCard)}
        </div>
    );

    const renderSectionEmptyState = ({ icon, title, description, actions }: SectionEmptyStateProps) => (
        <div className={styles.sectionEmptyState} aria-live="polite">
            <div className={styles.emptyIcon} aria-hidden="true">
                {icon}
            </div>
            <div className={styles.emptyCopy}>
                <Text as="p" weight="semibold" className={styles.emptyTitle}>
                    {title}
                </Text>
                <Text as="p" size={300} className={styles.emptyDescription}>
                    {description}
                </Text>
            </div>
            {actions && actions.length > 0 && (
                <div className={styles.emptyActions}>
                    {actions.map(action => (
                        <Button key={action.label} appearance={action.appearance ?? "secondary"} icon={action.icon} onClick={action.onClick}>
                            {action.label}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderSearchEmptyState = () =>
        renderSectionEmptyState({
            icon: <SearchRegular />,
            title: t("components.community_assistants.empty_search_title"),
            description: t("components.community_assistants.empty_search_description"),
            actions: [
                {
                    label: t("components.community_assistants.empty_search_reset"),
                    appearance: "subtle",
                    icon: <SearchRegular />,
                    onClick: () => setSearchText("")
                }
            ]
        });

    const renderMyAssistantsEmptyState = () =>
        renderSectionEmptyState({
            icon: <LibraryRegular />,
            title: t("components.community_assistants.empty_my_title"),
            description: t("components.community_assistants.empty_my_description"),
            actions: [
                {
                    label: t("components.add_assistant_button.add_assistant"),
                    appearance: "primary",
                    icon: <Add24Regular />,
                    onClick: () => navigate("/assistant/create")
                },
                {
                    label: t("components.import_assistant.import"),
                    icon: <DocumentArrowUpRegular />,
                    onClick: importAssistant
                }
            ]
        });

    const renderCommunityEmptyState = () =>
        renderSectionEmptyState({
            icon: <PeopleCommunityRegular />,
            title: t("components.community_assistants.empty_community_title"),
            description: t("components.community_assistants.empty_community_description"),
            actions: [
                {
                    label: t("components.community_assistants.empty_create_own"),
                    icon: <Add24Regular />,
                    onClick: () => navigate("/assistant/create")
                }
            ]
        });

    const renderSkeletonGrid = (keyPrefix: string) => (
        <div className={styles.assistantsGrid} role="list">
            {Array.from({ length: 4 }).map((_, index) => (
                <DiscoveryCardSkeleton key={`${keyPrefix}-skeleton-${index}`} />
            ))}
        </div>
    );

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.flexContainer} data-drawer-open={isDrawerOpen}>
                <div className={styles.mainContent}>
                    <div className={styles.contentWrapper}>
                        <div className={styles.headerSection}>
                            <div className={styles.titleBlock}>
                                <Title1 className={styles.header}>{t("discovery.title", "Assistenten")}</Title1>
                                <div className={styles.subtitleRow}>
                                    <Body1 className={styles.subtitle}>
                                        {t("discovery.subtitle", "Nutze deine Assistenten oder entdecke neue für wiederkehrende Aufgaben.")}
                                    </Body1>
                                    <div className={styles.headerActions}>
                                        <Button
                                            appearance="transparent"
                                            icon={<DocumentArrowUpRegular />}
                                            onClick={importAssistant}
                                            aria-label={t("components.import_assistant.import")}
                                        >
                                            {t("components.import_assistant.import")}
                                        </Button>
                                        <AddAssistantButton onClick={() => navigate("/assistant/create")} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <SearchBox
                            placeholder={t("components.community_assistants.search", "Search assistants by title or description.")}
                            value={searchText}
                            onChange={handleSearch}
                            className={styles.searchBox}
                            size="medium"
                            aria-label={t("components.community_assistants.search", "Search assistants by title or description.")}
                        />

                        {isLoading ? (
                            <div className={styles.librarySections} aria-label={t("components.community_assistants.loading_assistants")}>
                                <section className={styles.assistantSection}>
                                    <h2 className={styles.sectionTitle}>{t("components.community_assistants.my_assistants", "Meine Assistenten")}</h2>
                                    {renderSkeletonGrid("my")}
                                </section>
                                <section className={styles.assistantSection}>
                                    <h2 className={styles.sectionTitle}>{t("components.community_assistants.discover_community", "Community entdecken")}</h2>
                                    {renderSkeletonGrid("community")}
                                </section>
                            </div>
                        ) : (
                            <div className={styles.librarySections}>
                                <section className={styles.assistantSection} aria-labelledby="my-assistants-heading">
                                    <div className={styles.sectionHeadingBlock}>
                                        <h2 id="my-assistants-heading" className={styles.sectionTitle}>
                                            {t("components.community_assistants.my_assistants", "Meine Assistenten")}
                                        </h2>
                                        <div className={styles.sectionHeaderRow}>
                                            <div className={styles.myFilterGroup} role="group" aria-labelledby="my-assistants-heading">
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    aria-pressed={myAssistantFilter === "all"}
                                                    onClick={() => setMyAssistantFilter("all")}
                                                >
                                                    {t("components.community_assistants.filter_my_all", "Alle")}
                                                </Button>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    aria-pressed={myAssistantFilter === "owned"}
                                                    onClick={() => setMyAssistantFilter("owned")}
                                                >
                                                    {t("components.community_assistants.filter_created_short", "Erstellt")}
                                                </Button>
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    aria-pressed={myAssistantFilter === "subscribed"}
                                                    onClick={() => setMyAssistantFilter("subscribed")}
                                                >
                                                    {t("components.community_assistants.filter_subscribed", "Abonniert")}
                                                </Button>
                                            </div>
                                            <Dropdown
                                                id="my-assistant-sort"
                                                value={selectedMyAssistantsSortLabel}
                                                selectedOptions={[myAssistantsSortMethod]}
                                                appearance="outline"
                                                className={styles.sortDropdown}
                                                listbox={{ className: styles.sortDropdownListbox }}
                                                onOptionSelect={handleMyAssistantsSortChange}
                                                aria-label={t("components.community_assistants.sort_by", "Sortieren nach")}
                                            >
                                                <Option value="lastUsed" text={t("components.community_assistants.sort_last_used", "Zuletzt benutzt")}>
                                                    {t("components.community_assistants.sort_last_used", "Zuletzt benutzt")}
                                                </Option>
                                                <Option value="subscriptions" text={t("components.community_assistants.sort_popular", "Beliebteste")}>
                                                    {t("components.community_assistants.sort_popular", "Beliebteste")}
                                                </Option>
                                                <Option value="updated" text={t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")}>
                                                    {t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")}
                                                </Option>
                                                <Option value="title" text={t("components.community_assistants.sort_title", "Name")}>
                                                    {t("components.community_assistants.sort_title", "Name")}
                                                </Option>
                                            </Dropdown>
                                        </div>
                                    </div>

                                    {filteredMyAssistants.length === 0 ? (
                                        isSearching ? (
                                            renderSearchEmptyState()
                                        ) : (
                                            renderMyAssistantsEmptyState()
                                        )
                                    ) : (
                                        <>
                                            {renderAssistantGrid(displayedMyAssistants, t("components.community_assistants.my_assistants"))}
                                            {hasHiddenMyAssistants && (
                                                <div className={styles.showMoreRow}>
                                                    <Button appearance="secondary" onClick={() => setShowAllMyAssistants(true)}>
                                                        {t(
                                                            "components.community_assistants.show_more_personal_assistants",
                                                            "Mehr persönliche Assistenten anzeigen"
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </section>

                                <div className={styles.sectionDivider} aria-hidden="true" />

                                <section className={styles.assistantSection} aria-labelledby="community-assistants-heading">
                                    <div className={styles.sectionHeaderRow}>
                                        <h2 id="community-assistants-heading" className={styles.sectionTitle}>
                                            {t("components.community_assistants.discover_community", "Community entdecken")}
                                        </h2>
                                        <Dropdown
                                            id="community-assistant-sort"
                                            value={selectedCommunitySortLabel}
                                            selectedOptions={[communitySortMethod]}
                                            appearance="outline"
                                            className={styles.sortDropdown}
                                            listbox={{ className: styles.sortDropdownListbox }}
                                            onOptionSelect={handleCommunitySortChange}
                                            aria-label={t("components.community_assistants.sort_by", "Sortieren nach")}
                                        >
                                            <Option value="subscriptions" text={t("components.community_assistants.sort_popular", "Beliebteste")}>
                                                {t("components.community_assistants.sort_popular", "Beliebteste")}
                                            </Option>
                                            <Option value="updated" text={t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")}>
                                                {t("components.community_assistants.sort_updated", "Zuletzt aktualisiert")}
                                            </Option>
                                            <Option value="title" text={t("components.community_assistants.sort_title", "Name")}>
                                                {t("components.community_assistants.sort_title", "Name")}
                                            </Option>
                                        </Dropdown>
                                    </div>

                                    {communityAssistants.length === 0
                                        ? isSearching
                                            ? renderSearchEmptyState()
                                            : renderCommunityEmptyState()
                                        : renderAssistantGrid(communityAssistants, t("components.community_assistants.discover_community"))}
                                </section>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.detailsSidebarSlot} data-open={isDrawerOpen}>
                    <AssistantDetailsSidebar
                        isOpen={Boolean(selectedAssistant)}
                        onClose={closeDrawerAndClearSelection}
                        assistant={selectedAssistant}
                        ownedAssistantIds={ownedAssistantIds}
                        onStartChat={startConversation}
                        onEdit={editAssistant}
                        onDuplicate={() => {
                            if (!selectedAssistant || selectedAssistant.isLocalAssistant) {
                                return;
                            }
                            requestDuplicateAssistant({
                                id: selectedAssistant.id,
                                title: selectedAssistant.title,
                                rawData: selectedAssistant.rawData as AssistantResponse | CommunityAssistantSnapshot,
                                isDeletedSnapshot: selectedAssistant.isDeletedSnapshot
                            });
                        }}
                        onExport={exportAssistant}
                        onDelete={deleteAssistant}
                        onMigrateLocal={selectedAssistant?.isLocalAssistant ? () => setShowLocalMigrateConfirm(true) : undefined}
                    />
                </div>
            </div>

            <CloseConfirmationDialog
                open={showLocalMigrateConfirm}
                onOpenChange={setShowLocalMigrateConfirm}
                onConfirmClose={performLocalMigration}
                title={t("components.community_assistants.local_migration_confirm_title")}
                message={t("components.community_assistants.local_migration_confirm_message")}
                confirmLabel={t("components.community_assistants.local_migration_confirm_action")}
            />
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
                confirmDisabled={isDuplicating}
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
