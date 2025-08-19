import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Tooltip,
    SearchBox,
    Card,
    CardHeader,
    CardFooter,
    Text,
    Badge,
    Divider,
    Spinner,
    Body1,
    Dropdown,
    Option
} from "@fluentui/react-components";

import styles from "./CommunityAssistantDialog.module.css";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AssistantResponse, Assistant } from "../../api";
import { Dismiss24Regular, Save24Filled, ArrowSort24Regular } from "@fluentui/react-icons";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ASSISTANT_STORE } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { getAllCommunityAssistantsApi, getCommunityAssistantApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
    takeCommunityAssistants: boolean;
    setTakeCommunityAssistants: (takeCommunityAssistants: boolean) => void;
    ownedAssistants: string[];
    subscribedAssistants: string[];
}

export const CommunityAssistantsDialog = ({
    showSearchDialogInput,
    setShowSearchDialogInput,
    takeCommunityAssistants,
    setTakeCommunityAssistants,
    ownedAssistants,
    subscribedAssistants
}: Props) => {
    const { showSuccess, showError } = useGlobalToastContext();
    const mockAssistant: Assistant = {
        title: "",
        description: "",
        system_message: "",
        publish: false,
        id: "0",
        temperature: 0.0,
        max_output_tokens: 0,
        version: "0",
        owner_ids: ["owner"],
        tags: [],
        tools: [],
        hierarchical_access: [],
        is_visible: true
    };
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [assistants, setAssistant] = useState<any[]>([]);
    const [filteredAssistants, setFilteredAssistants] = useState<any[]>([]);
    const [choosenAssistant, setChoosenAssistant] = useState<Assistant>(mockAssistant);
    const [, setChoosenAssistantAll] = useState<Assistant[]>([mockAssistant]);
    const [showAssistantDialog, setShowAssistantDialog] = useState<boolean>(false);
    const [, setAllTags] = useState<string[]>([]);
    const [choosenTag] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [sortMethod, setSortMethod] = useState<string>(t("components.community_assistants.sort_subscriptions"));
    const communityassistantStorageService: AssistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
    const [assistantAlreadySaved, setAssistantAlreadySaved] = useState<boolean>(false);

    function compareAssistantsByTitle(
        a: { assistant: Assistant; updated: string; subscriptions: number },
        b: { assistant: Assistant; updated: string; subscriptions: number }
    ) {
        const titleA = a.assistant.title.toLowerCase();
        const titleB = b.assistant.title.toLowerCase();

        if (titleA < titleB) {
            return -1;
        }
        if (titleA > titleB) {
            return 1;
        }
        return 0;
    }

    function compareAssistantsByUpdated(
        a: { assistant: Assistant; updated: string; subscriptions: number },
        b: { assistant: Assistant; updated: string; subscriptions: number }
    ) {
        const updatedA = new Date(a.updated).getTime();
        const updatedB = new Date(b.updated).getTime();
        return updatedB - updatedA; // Descending order (newest first)
    }

    function compareAssistantsBySubscriptions(
        a: { assistant: Assistant; updated: string; subscriptions: number },
        b: { assistant: Assistant; updated: string; subscriptions: number }
    ) {
        return b.subscriptions - a.subscriptions; // Descending order (most subscriptions first)
    }

    function getSortFunction() {
        switch (sortMethod) {
            case t("components.community_assistants.sort_title"):
                return compareAssistantsByTitle;
            case t("components.community_assistants.sort_updated"):
                return compareAssistantsByUpdated;
            case t("components.community_assistants.sort_subscriptions"):
                return compareAssistantsBySubscriptions;
            default:
                return compareAssistantsByTitle;
        }
    }

    useEffect(() => {
        if (takeCommunityAssistants && showSearchDialogInput) {
            setIsLoading(true);
            getAllCommunityAssistantsApi()
                .then((assistants: AssistantResponse[]) => {
                    const latestAssistants: { assistant: Assistant; updated: string; subscriptions: number }[] = [];
                    for (const assistant of assistants) {
                        const latest = assistant.latest_version;
                        const latest_assistant: Assistant = {
                            title: latest.name,
                            description: latest.description || "",
                            system_message: latest.system_prompt,
                            publish: true,
                            id: assistant.id,
                            temperature: latest.temperature,
                            max_output_tokens: latest.max_output_tokens,
                            version: latest.version.toString(),
                            owner_ids: latest.owner_ids,
                            tags: latest.tags || [],
                            tools: latest.tools || [],
                            hierarchical_access: latest.hierarchical_access || [],
                            is_visible: latest.is_visible ? latest.is_visible : true // Default to true if not specified
                        };
                        latestAssistants.push({ assistant: latest_assistant, updated: assistant.updated_at, subscriptions: assistant.subscriptions_count });
                    }
                    setAssistant(latestAssistants.sort(getSortFunction()));
                    setFilteredAssistants(latestAssistants.sort(getSortFunction()));
                    let tags: string[] = [];
                    for (const assistant of latestAssistants) {
                        if (assistant.assistant.tags) {
                            const newTags = assistant.assistant.tags.filter((tag: string) => !tags.includes(tag));
                            tags = tags.concat(newTags);
                        }
                    }
                    setAllTags(tags);
                    setIsLoading(false);
                })
                .catch(error => {
                    setIsLoading(false);
                    const errorMessage = error instanceof Error ? error.message : "Failed to load community assistants";
                    showError("Failed to load assistants", errorMessage);
                });
            setTakeCommunityAssistants(false);
        }
    }, [takeCommunityAssistants, showSearchDialogInput, showError]);

    const onSaveAssistant = async () => {
        if (choosenAssistant.id == undefined) return;

        try {
            await subscribeToAssistantApi(choosenAssistant.id);
            showSuccess(
                t("components.community_assistants.subscribe_success_title", { title: choosenAssistant.title }),
                t("components.community_assistants.subscribe_success_message")
            );
            setShowAssistantDialog(false);
            setShowSearchDialogInput(false);
            window.location.href = "/#/communityassistant/" + choosenAssistant.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("components.community_assistants.subscribe_failed_default");
            showError(t("components.community_assistants.subscribe_failed_title", { title: choosenAssistant.title }), errorMessage);
        }
    };

    const inputHandler = (event: any, data: any) => {
        const newValue = data.value;
        if (newValue !== undefined && newValue !== "") {
            const lowerCase = newValue.toLowerCase();
            setInputText(lowerCase);

            const filter = assistants
                .filter(assistant => {
                    // Return the item which contains the user input
                    return (
                        assistant.title.toLowerCase().includes(lowerCase) ||
                        assistant.description.toLowerCase().includes(lowerCase) ||
                        (assistant.tags && assistant.tags.some((tag: string) => tag.toLowerCase().includes(lowerCase)))
                    );
                })
                .sort(getSortFunction());

            setFilteredAssistants(filter);
        } else {
            // Handle case when newValue is empty or undefined
            setFilteredAssistants(assistants);
            setInputText("");
        }
    };

    const onSortMethodChange = (event: any, data: any) => {
        const newSortMethod = data.optionValue;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    };

    // Effect to re-sort assistants when sort method changes
    useEffect(() => {
        if (assistants.length > 0) {
            const sortedAssistants = [...assistants].sort(getSortFunction());
            const sortedFilteredAssistants = [...filteredAssistants].sort(getSortFunction());
            setAssistant(sortedAssistants);
            setFilteredAssistants(sortedFilteredAssistants);
        }
    }, [sortMethod]);

    /**
    const onTagSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        const tag = selection.optionValue;
        if (tag == undefined) {
            return;
        }
        if (tag == choosenTag) {
            setChoosenTag("");
        } else {
            setChoosenTag(tag);
        }
    };

    const onVersionSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        const version = selection.optionValue;
        if (version == undefined || version == String(choosenAssistant.version) || choosenAssistant.id == undefined) {
            return;
        }
        getCommunityAssistantVersionApi(choosenAssistant.id, version).then((assistant: Assistant) => {
            setChoosenAssistant(assistant);
        });
    };

    const versionPicker = (
        <Dropdown
            id="version"
            aria-label={"version"}
            defaultValue={choosenAssistant.version.toString()}
            value={choosenAssistant.version.toString()}
            selectedOptions={[choosenAssistant.version.toString()]}
            appearance="underline"
            size="small"
            positioning="below-start"
            onOptionSelect={onVersionSelected}
        >
            {choosenAssistantAll.map((assistant: Assistant) => (
                <Option key={assistant.version} value={String(assistant.version)} text={"v" + assistant.version.toString()} className={styles.option}>
                    v{assistant.version.toString()}
                </Option>
            ))}
        </Dropdown>
    );
    */

    const onChooseAssistant = (assistant: Assistant) => {
        if (assistant.id == undefined) {
            return;
        }
        setChoosenAssistant(assistant);
        setShowAssistantDialog(true);
        setShowSearchDialogInput(false);
        setAssistantAlreadySaved(assistant.id in ownedAssistants.concat(subscribedAssistants));
        getCommunityAssistantApi(assistant.id)
            .then(assistants => {
                const latest = assistants.latest_version;
                const latest_version: Assistant = {
                    title: latest.name,
                    description: latest.description || "",
                    system_message: latest.system_prompt,
                    publish: true,
                    id: assistants.id,
                    temperature: latest.temperature,
                    max_output_tokens: latest.max_output_tokens,
                    version: latest.version.toString(),
                    owner_ids: latest.owner_ids,
                    tags: latest.tags || [],
                    tools: latest.tools || [],
                    hierarchical_access: latest.hierarchical_access || [],
                    is_visible: latest.is_visible ? latest.is_visible : true
                };
                setChoosenAssistantAll([latest_version]); //TODO all Versions
            })
            .catch(error => {
                const errorMessage = error instanceof Error ? error.message : "Failed to load assistant details";
                showError("Failed to load assistant details", errorMessage);
            });
        communityassistantStorageService
            .getAssistantConfig(assistant.id)
            .then((assistant: Assistant | undefined) => {
                setAssistantAlreadySaved(assistant !== undefined);
            })
            .catch(error => {
                console.warn("Could not check if assistant is already saved:", error);
                // This is not critical, so we don't show an error toast
            });
    };

    return (
        <div>
            <Dialog
                modalType="modal"
                open={showSearchDialogInput}
                onOpenChange={(_event, data) => {
                    if (!data.open) {
                        setInputText("");
                        setFilteredAssistants(assistants);
                        setShowSearchDialogInput(false);
                    }
                }}
            >
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle
                            action={
                                <DialogTrigger action="close">
                                    <Button
                                        appearance="subtle"
                                        aria-label="close"
                                        icon={<Dismiss24Regular />}
                                        onClick={() => {
                                            setInputText("");
                                            setFilteredAssistants(assistants);
                                            setShowSearchDialogInput(false);
                                        }}
                                    />
                                </DialogTrigger>
                            }
                        >
                            {t("components.community_assistants.title")}
                        </DialogTitle>
                        <DialogContent>
                            {/* Search and Filter Section */}
                            <div className={styles.searchSection}>
                                <SearchBox
                                    placeholder={t("components.community_assistants.search")}
                                    value={inputText}
                                    onChange={inputHandler}
                                    className={styles.searchBox}
                                />

                                <div className={styles.sortSection}>
                                    <ArrowSort24Regular className={styles.sortIcon} />
                                    <Text size={300} className={styles.sortLabel}>
                                        {t("components.community_assistants.sort_by")}:
                                    </Text>
                                    <Dropdown
                                        id="sort"
                                        value={sortMethod}
                                        selectedOptions={[sortMethod]}
                                        appearance="outline"
                                        size="small"
                                        className={styles.sortDropdown}
                                        onOptionSelect={onSortMethodChange}
                                    >
                                        <Option value={t("components.community_assistants.sort_title")} text={t("components.community_assistants.sort_title")}>
                                            {t("components.community_assistants.sort_title")}
                                        </Option>
                                        <Option
                                            value={t("components.community_assistants.sort_updated")}
                                            text={t("components.community_assistants.sort_updated")}
                                        >
                                            {t("components.community_assistants.sort_updated")}
                                        </Option>
                                        <Option
                                            value={t("components.community_assistants.sort_subscriptions")}
                                            text={t("components.community_assistants.sort_subscriptions")}
                                        >
                                            {t("components.community_assistants.sort_subscriptions")}
                                        </Option>
                                    </Dropdown>
                                </div>

                                {/* <div className={styles.filterSection}>
                                    <Filter24Regular className={styles.filterIcon} />
                                    <Text size={300} className={styles.filterLabel}>
                                        {t("components.community_assistants.filter_by_tag")}:
                                    </Text>
                                    <Dropdown
                                        id="filter"
                                        placeholder="Select tag..."
                                        value={choosenTag}
                                        selectedOptions={choosenTag ? [choosenTag] : []}
                                        appearance="outline"
                                        size="small"
                                        className={styles.tagDropdown}
                                        onOptionSelect={onTagSelected}
                                    >
                                        <Option value="" text="All tags">All tags</Option>
                                        {allTags.sort().map((tag: string) => (
                                            <Option key={tag} value={tag} text={tag}>
                                                {tag}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </div> */}
                            </div>

                            <Divider className={styles.divider} />

                            {/* Loading State */}
                            {isLoading && (
                                <div className={styles.loadingContainer}>
                                    <Spinner size="medium" />
                                    <Text>{t("components.community_assistants.loading_assistants")}</Text>
                                </div>
                            )}

                            {/* Assistant Cards Grid */}
                            {!isLoading && (
                                <div className={styles.assistantsGrid}>
                                    {filteredAssistants
                                        .filter(assistantObj => (choosenTag === "" ? true : assistantObj.assistant.tags.includes(choosenTag)))
                                        .map(assistantObj => assistantObj.assistant)
                                        .map((assistant: Assistant) => (
                                            <Card key={assistant.id} className={styles.assistantCard} onClick={() => onChooseAssistant(assistant)}>
                                                <CardHeader
                                                    header={<Body1 className={styles.assistantTitle}>{assistant.title}</Body1>}
                                                    description={
                                                        <Text size={200} className={styles.assistantDescription}>
                                                            {assistant.description.length > 100
                                                                ? `${assistant.description.substring(0, 100)}...`
                                                                : assistant.description}
                                                        </Text>
                                                    }
                                                />
                                                <CardFooter>
                                                    <div className={styles.assistantCardFooter}>
                                                        <div className={styles.assistantCardLeft}>
                                                            <div className={styles.assistantTags}>
                                                                {assistant.tags?.slice(0, 2).map((tag: string) => (
                                                                    <Badge key={tag} size="small" color="brand">
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {assistant.tags && assistant.tags.length > 2 && (
                                                                    <Badge size="small" color="subtle">
                                                                        +{assistant.tags.length - 2}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {assistant.tools && assistant.tools.length > 0 && (
                                                                <div className={styles.toolsIndicator}>
                                                                    <Badge size="small" color="informative" appearance="outline">
                                                                        🔧 {assistant.tools.length}{" "}
                                                                        {assistant.tools.length === 1
                                                                            ? t("components.community_assistants.tool_single")
                                                                            : t("components.community_assistants.tools_plural")}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            {assistant.hierarchical_access && assistant.hierarchical_access.length > 0 && (
                                                                <div className={styles.departmentsIndicator}>
                                                                    <Badge size="small" color="warning" appearance="outline">
                                                                        🏢 {assistant.hierarchical_access.length}{" "}
                                                                        {assistant.hierarchical_access.length === 1
                                                                            ? t("components.community_assistants.department_single")
                                                                            : t("components.community_assistants.departments_plural")}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Badge size="small" appearance="outline">
                                                            v{assistant.version}
                                                        </Badge>
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                </div>
                            )}

                            {/* No Results State */}
                            {!isLoading &&
                                filteredAssistants.filter(assistant => (choosenTag === "" ? true : assistant.tags.includes(choosenTag))).length === 0 && (
                                    <div className={styles.noResults}>
                                        <Text size={400}>{t("components.community_assistants.no_assistants_found")}</Text>
                                    </div>
                                )}
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <Dialog
                modalType="modal"
                open={showAssistantDialog}
                onOpenChange={(_event, data) => {
                    if (!data.open) {
                        setChoosenAssistant(mockAssistant);
                        setShowAssistantDialog(false);
                        setShowSearchDialogInput(true);
                    }
                }}
            >
                <DialogSurface className={styles.detailDialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle
                            action={
                                <DialogTrigger action="close">
                                    <Button
                                        appearance="subtle"
                                        aria-label="close"
                                        icon={<Dismiss24Regular />}
                                        onClick={() => {
                                            setChoosenAssistant(mockAssistant);
                                            setShowAssistantDialog(false);
                                            setShowSearchDialogInput(true);
                                        }}
                                    />
                                </DialogTrigger>
                            }
                        >
                            <div className={styles.titleSection}>
                                <Body1 className={styles.assistantDetailTitle}>{choosenAssistant.title}</Body1>
                                {/* <div className={styles.versionSection}>
                                    <Text size={200}>Version:</Text>
                                    {versionPicker}
                                </div> */}
                                {choosenAssistant.hierarchical_access && choosenAssistant.hierarchical_access.length > 0 ? (
                                    <>
                                        <Text size={200} className={styles.sectionDescription}>
                                            {t("components.community_assistants.departments_description")}
                                        </Text>
                                        <div className={styles.departmentsList}>
                                            {choosenAssistant.hierarchical_access.map((department, index) => (
                                                <Badge key={index} size="medium" color="warning" className={styles.departmentBadge}>
                                                    {department}
                                                </Badge>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.publicAccess}>
                                        <Badge size="medium" color="success" className={styles.publicAccessBadge}>
                                            🌐 {t("components.community_assistants.public_access")}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </DialogTitle>
                        <DialogContent className={styles.detailContent}>
                            {/* Tags Section */}
                            {choosenAssistant.tags && choosenAssistant.tags.length > 0 && (
                                <div className={styles.detailTags}>
                                    {choosenAssistant.tags.map((tag: string) => (
                                        <Badge key={tag} size="medium" color="brand">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            <Divider />

                            {/* Description Section */}
                            <div className={styles.descriptionSection}>
                                <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                    {t("components.community_assistants.description")}
                                </Text>
                                <div className={styles.markdownContent}>
                                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ code: CodeBlockRenderer }}>
                                        {choosenAssistant.description}
                                    </Markdown>
                                </div>
                            </div>

                            <Divider />

                            {/* Tools Section */}
                            {choosenAssistant.tools && choosenAssistant.tools.length > 0 && (
                                <div className={styles.toolsSection}>
                                    <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                        {t("components.community_assistants.tools")}
                                    </Text>
                                    <div className={styles.toolsList}>
                                        {choosenAssistant.tools.map(tool => (
                                            <Badge key={tool.id} size="medium" color="informative" className={styles.toolBadge}>
                                                {tool.id}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {choosenAssistant.tools && choosenAssistant.tools.length > 0 && <Divider />}

                            {/* System Message Section */}
                            <div className={styles.systemMessageSection}>
                                <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                    {t("components.community_assistants.system_message")}
                                </Text>
                                <div className={styles.systemMessageContent}>
                                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {choosenAssistant.system_message}
                                    </Markdown>
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions className={styles.detailActions}>
                            <Button
                                appearance="subtle"
                                onClick={() => {
                                    setChoosenAssistant(mockAssistant);
                                    setShowAssistantDialog(false);
                                    setShowSearchDialogInput(true);
                                }}
                            >
                                {t("components.community_assistants.back_to_search")}
                            </Button>
                            <DialogTrigger disableButtonEnhancement>
                                <Tooltip
                                    content={
                                        assistantAlreadySaved
                                            ? t("components.community_assistants.assistant_already_saved")
                                            : t("components.community_assistants.save")
                                    }
                                    relationship="description"
                                    positioning="above"
                                >
                                    <Button appearance="primary" onClick={onSaveAssistant} disabled={assistantAlreadySaved} icon={<Save24Filled />}>
                                        {assistantAlreadySaved ? t("components.community_assistants.already_saved") : t("components.community_assistants.save")}
                                    </Button>
                                </Tooltip>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
