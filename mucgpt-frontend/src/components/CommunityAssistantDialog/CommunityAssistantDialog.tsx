import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Divider } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useState } from "react";
import { Assistant, AssistantResponse, CommunityAssistant } from "../../api";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { COMMUNITY_ASSISTANT_STORE } from "../../constants";

// Components
import { AssistantSearchSection } from "./components/AssistantSearchSection";
import { AssistantGrid } from "./components/AssistantGrid";
import { AssistantDetailDialog } from "./components/AssistantDetailDialog";

// Styles
import styles from "./CommunityAssistantDialog.module.css";
import { getAllCommunityAssistantsApi, getCommunityAssistantApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

// Interfaces
export type SortMethod = "title" | "updated" | "subscriptions";

export interface AssistantWithMetadata {
    assistant: Assistant;
    updated: string;
    subscriptions: number;
}

interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
    takeCommunityAssistants: boolean;
    setTakeCommunityAssistants: (takeCommunityAssistants: boolean) => void;
    ownedAssistants: string[];
    subscribedAssistants: string[];
}

const createMockAssistant = (): Assistant => ({
    title: "",
    description: "",
    system_message: "",
    publish: false,
    id: "0",
    temperature: 0.0,
    version: "0",
    owner_ids: [],
    tags: [],
    tools: [],
    hierarchical_access: [],
    is_visible: true
});

export const CommunityAssistantsDialog = ({
    showSearchDialogInput,
    setShowSearchDialogInput,
    takeCommunityAssistants,
    setTakeCommunityAssistants,
    ownedAssistants,
    subscribedAssistants
}: Props) => {
    const { t } = useTranslation();

    const { showSuccess, showError } = useGlobalToastContext();

    const [assistants, setAssistants] = useState<AssistantWithMetadata[]>([]);
    const [filteredAssistants, setFilteredAssistants] = useState<AssistantWithMetadata[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchText, setSearchText] = useState<string>("");
    const [sortMethod, setSortMethod] = useState<string>(t("components.community_assistants.sort_subscriptions"));

    // Local state for dialog management
    const [selectedAssistant, setSelectedAssistant] = useState<Assistant>(createMockAssistant());
    const [showAssistantDialog, setShowAssistantDialog] = useState<boolean>(false);

    const communityAssistantStorageService = new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE);

    // sort Functions
    const compareByTitle = (a: AssistantWithMetadata, b: AssistantWithMetadata): number => {
        const titleA = a.assistant.title.toLowerCase();
        const titleB = b.assistant.title.toLowerCase();
        if (titleA < titleB) return -1;
        if (titleA > titleB) return 1;
        return 0;
    };

    const compareByUpdated = (a: AssistantWithMetadata, b: AssistantWithMetadata): number => {
        const updatedA = new Date(a.updated).getTime();
        const updatedB = new Date(b.updated).getTime();
        return updatedB - updatedA; // Descending order (newest first)
    };

    const compareBySubscriptions = (a: AssistantWithMetadata, b: AssistantWithMetadata): number => {
        return b.subscriptions - a.subscriptions; // Descending order (most subscriptions first)
    };

    const getSortFunction = (method: string) => {
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
    };

    const sortAssistants = useCallback((assistants: AssistantWithMetadata[], method: string): AssistantWithMetadata[] => {
        return [...assistants].sort(getSortFunction(method));
    }, []);

    // Load community assistants
    const loadAssistants = useCallback(async () => {
        setIsLoading(true);
        try {
            const assistantsData: AssistantResponse[] = await getAllCommunityAssistantsApi();
            const processedAssistants: AssistantWithMetadata[] = assistantsData.map(assistant => {
                const latest = assistant.latest_version;
                const latestAssistant: Assistant = {
                    title: latest.name,
                    description: latest.description || "",
                    system_message: latest.system_prompt,
                    publish: true,
                    id: assistant.id,
                    temperature: latest.temperature,
                    version: latest.version.toString(),
                    owner_ids: latest.owner_ids,
                    tags: latest.tags || [],
                    tools: latest.tools || [],
                    hierarchical_access: latest.hierarchical_access || [],
                    is_visible: latest.is_visible ?? true
                };
                return {
                    assistant: latestAssistant,
                    updated: assistant.updated_at,
                    subscriptions: assistant.subscriptions_count
                };
            });

            const sortedAssistants = sortAssistants(processedAssistants, sortMethod);
            setAssistants(sortedAssistants);
            setFilteredAssistants(sortedAssistants);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load community assistants";
            showError("Failed to load assistants", errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [showError, sortAssistants, sortMethod]);

    // Re-sort when sort method changes
    useEffect(() => {
        if (assistants.length > 0) {
            const sortedAssistants = sortAssistants(assistants, sortMethod);
            const sortedFilteredAssistants = sortAssistants(filteredAssistants, sortMethod);
            setAssistants(sortedAssistants);
            setFilteredAssistants(sortedFilteredAssistants);
        }
    }, [sortMethod]); // Removed sortAssistants from dependencies

    // Filter community assistants
    const filterAssistants = useCallback(
        (searchValue: string) => {
            if (!searchValue.trim()) {
                setFilteredAssistants(assistants);
                return;
            }

            const lowerCaseSearch = searchValue.toLowerCase();
            const filtered = assistants.filter(assistantObj => {
                const assistant = assistantObj.assistant;
                return (
                    assistant.title.toLowerCase().includes(lowerCaseSearch) ||
                    assistant.description.toLowerCase().includes(lowerCaseSearch) ||
                    (assistant.tags && assistant.tags.some((tag: string) => tag.toLowerCase().includes(lowerCaseSearch)))
                );
            });

            setFilteredAssistants(sortAssistants(filtered, sortMethod));
        },
        [assistants, sortMethod] // Removed sortAssistants from dependencies
    );

    const handleSearch = useCallback(
        (event: any, data: any) => {
            const newValue = data.value || "";
            setSearchText(newValue);
            filterAssistants(newValue);
        },
        [filterAssistants]
    );

    const handleSortChange = useCallback((event: any, data: any) => {
        const newSortMethod = data.optionValue;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    }, []);

    // Load details for a specific assistant
    const loadAssistantDetails = useCallback(
        async (assistantId: string): Promise<Assistant> => {
            try {
                const assistantData = await getCommunityAssistantApi(assistantId);
                const latest = assistantData.latest_version;
                return {
                    title: latest.name,
                    description: latest.description || "",
                    system_message: latest.system_prompt,
                    publish: true,
                    id: assistantData.id,
                    temperature: latest.temperature,
                    version: latest.version.toString(),
                    owner_ids: latest.owner_ids,
                    tags: latest.tags || [],
                    tools: latest.tools || [],
                    hierarchical_access: latest.hierarchical_access || [],
                    is_visible: latest.is_visible ?? true
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to load assistant details";
                showError("Failed to load assistant details", errorMessage);
                throw error;
            }
        },
        [showError]
    );

    // Subscribe to a community assistant
    const subscribeToAssistant = useCallback(
        async (assistant: Assistant) => {
            if (!assistant.id) return;

            try {
                await subscribeToAssistantApi(assistant.id);
                const community_config: CommunityAssistant = {
                    id: assistant.id,
                    title: assistant.title,
                    description: assistant.description
                };
                await communityAssistantStorageService.createAssistantConfig(community_config);
                showSuccess(
                    t("components.community_assistants.subscribe_success_title", { title: assistant.title }),
                    t("components.community_assistants.subscribe_success_message")
                );
                // Navigate to the subscribed assistant
                window.location.href = "/#/communityassistant/" + assistant.id;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t("components.community_assistants.subscribe_failed_default");
                showError(t("components.community_assistants.subscribe_failed_title", { title: assistant.title }), errorMessage);
                throw error;
            }
        },
        [showSuccess, showError, t]
    );

    // Load assistants when dialog opens
    useEffect(() => {
        if (takeCommunityAssistants && showSearchDialogInput) {
            loadAssistants();
            setTakeCommunityAssistants(false);
        }
    }, [takeCommunityAssistants, showSearchDialogInput, loadAssistants, setTakeCommunityAssistants]);

    const handleAssistantClick = async (assistant: Assistant) => {
        if (!assistant.id) return;

        setSelectedAssistant(assistant);
        setShowAssistantDialog(true);
        setShowSearchDialogInput(false);

        try {
            // Load full assistant details
            const fullAssistant = await loadAssistantDetails(assistant.id);
            setSelectedAssistant(fullAssistant);
        } catch (error) {
            // Error is handled in the hook
            console.error("Failed to load assistant details:", error);
        }
    };

    const handleCloseDialog = () => {
        setShowSearchDialogInput(false);
    };

    const handleCloseDetailDialog = () => {
        setSelectedAssistant(createMockAssistant());
        setShowAssistantDialog(false);
        setShowSearchDialogInput(true);
    };

    const handleBackToSearch = () => {
        setSelectedAssistant(createMockAssistant());
        setShowAssistantDialog(false);
        setShowSearchDialogInput(true);
    };

    const handleSaveAssistant = async (assistant: Assistant) => {
        await subscribeToAssistant(assistant);
        setShowAssistantDialog(false);
        setShowSearchDialogInput(false);
    };

    return (
        <div>
            {/* Main Search Dialog */}
            <Dialog
                modalType="modal"
                open={showSearchDialogInput}
                onOpenChange={(_event, data) => {
                    if (!data.open) {
                        handleCloseDialog();
                    }
                }}
            >
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle
                            action={
                                <DialogTrigger action="close">
                                    <Button appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} onClick={handleCloseDialog} />
                                </DialogTrigger>
                            }
                        >
                            {t("components.community_assistants.title")}
                        </DialogTitle>

                        <DialogContent>
                            {/* Search and Filter Section */}
                            <AssistantSearchSection
                                searchValue={searchText}
                                onSearchChange={handleSearch}
                                sortMethod={sortMethod}
                                onSortMethodChange={handleSortChange}
                            />

                            <Divider className={styles.divider} />

                            {/* Assistant Grid */}
                            <AssistantGrid
                                assistants={filteredAssistants}
                                ownedAssistants={ownedAssistants}
                                subscribedAssistants={subscribedAssistants}
                                isLoading={isLoading}
                                onAssistantClick={handleAssistantClick}
                            />
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* Assistant Detail Dialog */}
            <AssistantDetailDialog
                isOpen={showAssistantDialog}
                assistant={selectedAssistant}
                ownedAssistants={ownedAssistants}
                subscribedAssistants={subscribedAssistants}
                onClose={handleCloseDetailDialog}
                onBack={handleBackToSearch}
                onSave={handleSaveAssistant}
            />
        </div>
    );
};
