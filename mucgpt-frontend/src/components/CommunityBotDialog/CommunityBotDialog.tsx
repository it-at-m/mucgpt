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

import styles from "./CommunityBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AssistantResponse, Bot } from "../../api";
import { Dismiss24Regular, Save24Filled, ArrowSort24Regular } from "@fluentui/react-icons";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { getAllCommunityAssistantsApi, getCommunityAssistantApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";

interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
    takeCommunityBots: boolean;
    setTakeCommunityBots: (takeCommunityBots: boolean) => void;
}

export const CommunityBotsDialog = ({ showSearchDialogInput, setShowSearchDialogInput, takeCommunityBots, setTakeCommunityBots }: Props) => {
    const { showSuccess, showError } = useGlobalToastContext();
    const mockBot: Bot = {
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
    const [bots, setBot] = useState<any[]>([]);
    const [filteredBots, setFilteredBots] = useState<any[]>([]);
    const [choosenBot, setChoosenBot] = useState<Bot>(mockBot);
    const [, setChoosenBotAll] = useState<Bot[]>([mockBot]);
    const [showBotDialog, setShowBotDialog] = useState<boolean>(false);
    const [, setAllTags] = useState<string[]>([]);
    const [choosenTag] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [sortMethod, setSortMethod] = useState<string>(t("components.community_bots.sort_subscriptions"));
    const communitybotStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const [botAlreadySaved, setBotAlreadySaved] = useState<boolean>(false);

    function compareBotsByTitle(a: { bot: Bot; updated: string; subscriptions: number }, b: { bot: Bot; updated: string; subscriptions: number }) {
        const titleA = a.bot.title.toLowerCase();
        const titleB = b.bot.title.toLowerCase();

        if (titleA < titleB) {
            return -1;
        }
        if (titleA > titleB) {
            return 1;
        }
        return 0;
    }

    function compareBotsByUpdated(a: { bot: Bot; updated: string; subscriptions: number }, b: { bot: Bot; updated: string; subscriptions: number }) {
        const updatedA = new Date(a.updated).getTime();
        const updatedB = new Date(b.updated).getTime();
        return updatedB - updatedA; // Descending order (newest first)
    }

    function compareBotsBySubscriptions(a: { bot: Bot; updated: string; subscriptions: number }, b: { bot: Bot; updated: string; subscriptions: number }) {
        return b.subscriptions - a.subscriptions; // Descending order (most subscriptions first)
    }

    function getSortFunction() {
        switch (sortMethod) {
            case t("components.community_bots.sort_title"):
                return compareBotsByTitle;
            case t("components.community_bots.sort_updated"):
                return compareBotsByUpdated;
            case t("components.community_bots.sort_subscriptions"):
                return compareBotsBySubscriptions;
            default:
                return compareBotsByTitle;
        }
    }

    useEffect(() => {
        if (takeCommunityBots && showSearchDialogInput) {
            setIsLoading(true);
            getAllCommunityAssistantsApi()
                .then((bots: AssistantResponse[]) => {
                    const latestBots: { bot: Bot; updated: string; subscriptions: number }[] = [];
                    for (const bot of bots) {
                        const latest = bot.latest_version;
                        const latest_bot: Bot = {
                            title: latest.name,
                            description: latest.description || "",
                            system_message: latest.system_prompt,
                            publish: true,
                            id: bot.id,
                            temperature: latest.temperature,
                            max_output_tokens: latest.max_output_tokens,
                            version: latest.version.toString(),
                            owner_ids: latest.owner_ids,
                            tags: latest.tags || [],
                            tools: latest.tools || [],
                            hierarchical_access: latest.hierarchical_access || [],
                            is_visible: latest.is_visible ? latest.is_visible : true // Default to true if not specified
                        };
                        latestBots.push({ bot: latest_bot, updated: bot.updated_at, subscriptions: bot.subscriptions_count });
                    }
                    setBot(latestBots.sort(getSortFunction()));
                    setFilteredBots(latestBots.sort(getSortFunction()));
                    let tags: string[] = [];
                    for (const bot of latestBots) {
                        if (bot.bot.tags) {
                            const newTags = bot.bot.tags.filter((tag: string) => !tags.includes(tag));
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
            setTakeCommunityBots(false);
        }
    }, [takeCommunityBots, showSearchDialogInput, showError]);

    const onSaveBot = async () => {
        if (choosenBot.id == undefined) return;

        try {
            await subscribeToAssistantApi(choosenBot.id);
            showSuccess(
                t("components.community_bots.subscribe_success_title", { title: choosenBot.title }),
                t("components.community_bots.subscribe_success_message")
            );
            setShowBotDialog(false);
            setShowSearchDialogInput(false);
            window.location.href = "/#/communitybot/" + choosenBot.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t("components.community_bots.subscribe_failed_default");
            showError(t("components.community_bots.subscribe_failed_title", { title: choosenBot.title }), errorMessage);
        }
    };

    const inputHandler = (event: any, data: any) => {
        const newValue = data.value;
        if (newValue !== undefined && newValue !== "") {
            const lowerCase = newValue.toLowerCase();
            setInputText(lowerCase);

            const filter = bots
                .filter(bot => {
                    // Return the item which contains the user input
                    return (
                        bot.title.toLowerCase().includes(lowerCase) ||
                        bot.description.toLowerCase().includes(lowerCase) ||
                        (bot.tags && bot.tags.some((tag: string) => tag.toLowerCase().includes(lowerCase)))
                    );
                })
                .sort(getSortFunction());

            setFilteredBots(filter);
        } else {
            // Handle case when newValue is empty or undefined
            setFilteredBots(bots);
            setInputText("");
        }
    };

    const onSortMethodChange = (event: any, data: any) => {
        const newSortMethod = data.optionValue;
        if (newSortMethod !== undefined) {
            setSortMethod(newSortMethod);
        }
    };

    // Effect to re-sort bots when sort method changes
    useEffect(() => {
        if (bots.length > 0) {
            const sortedBots = [...bots].sort(getSortFunction());
            const sortedFilteredBots = [...filteredBots].sort(getSortFunction());
            setBot(sortedBots);
            setFilteredBots(sortedFilteredBots);
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
        if (version == undefined || version == String(choosenBot.version) || choosenBot.id == undefined) {
            return;
        }
        getCommunityAssistantVersionApi(choosenBot.id, version).then((bot: Bot) => {
            setChoosenBot(bot);
        });
    };

    const versionPicker = (
        <Dropdown
            id="version"
            aria-label={"version"}
            defaultValue={choosenBot.version.toString()}
            value={choosenBot.version.toString()}
            selectedOptions={[choosenBot.version.toString()]}
            appearance="underline"
            size="small"
            positioning="below-start"
            onOptionSelect={onVersionSelected}
        >
            {choosenBotAll.map((bot: Bot) => (
                <Option key={bot.version} value={String(bot.version)} text={"v" + bot.version.toString()} className={styles.option}>
                    v{bot.version.toString()}
                </Option>
            ))}
        </Dropdown>
    );
    */

    const onChooseBot = (bot: Bot) => {
        if (bot.id == undefined) {
            return;
        }
        setChoosenBot(bot);
        setShowBotDialog(true);
        setShowSearchDialogInput(false);
        getCommunityAssistantApi(bot.id)
            .then(bots => {
                const latest = bots.latest_version;
                const latest_version: Bot = {
                    title: latest.name,
                    description: latest.description || "",
                    system_message: latest.system_prompt,
                    publish: true,
                    id: bots.id,
                    temperature: latest.temperature,
                    max_output_tokens: latest.max_output_tokens,
                    version: latest.version.toString(),
                    owner_ids: latest.owner_ids,
                    tags: latest.tags || [],
                    tools: latest.tools || [],
                    hierarchical_access: latest.hierarchical_access || [],
                    is_visible: latest.is_visible ? latest.is_visible : true
                };
                setChoosenBotAll([latest_version]); //TODO all Versions
            })
            .catch(error => {
                const errorMessage = error instanceof Error ? error.message : "Failed to load assistant details";
                showError("Failed to load assistant details", errorMessage);
            });
        communitybotStorageService
            .getBotConfig(bot.id)
            .then((bot: Bot | undefined) => {
                setBotAlreadySaved(bot !== undefined);
            })
            .catch(error => {
                console.warn("Could not check if bot is already saved:", error);
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
                        setFilteredBots(bots);
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
                                            setFilteredBots(bots);
                                            setShowSearchDialogInput(false);
                                        }}
                                    />
                                </DialogTrigger>
                            }
                        >
                            {t("components.community_bots.title")}
                        </DialogTitle>
                        <DialogContent>
                            {/* Search and Filter Section */}
                            <div className={styles.searchSection}>
                                <SearchBox
                                    placeholder={t("components.community_bots.search")}
                                    value={inputText}
                                    onChange={inputHandler}
                                    className={styles.searchBox}
                                />

                                <div className={styles.sortSection}>
                                    <ArrowSort24Regular className={styles.sortIcon} />
                                    <Text size={300} className={styles.sortLabel}>
                                        {t("components.community_bots.sort_by")}:
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
                                        <Option value={t("components.community_bots.sort_title")} text={t("components.community_bots.sort_title")}>
                                            {t("components.community_bots.sort_title")}
                                        </Option>
                                        <Option value={t("components.community_bots.sort_updated")} text={t("components.community_bots.sort_updated")}>
                                            {t("components.community_bots.sort_updated")}
                                        </Option>
                                        <Option
                                            value={t("components.community_bots.sort_subscriptions")}
                                            text={t("components.community_bots.sort_subscriptions")}
                                        >
                                            {t("components.community_bots.sort_subscriptions")}
                                        </Option>
                                    </Dropdown>
                                </div>

                                {/* <div className={styles.filterSection}>
                                    <Filter24Regular className={styles.filterIcon} />
                                    <Text size={300} className={styles.filterLabel}>
                                        {t("components.community_bots.filter_by_tag")}:
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
                                    <Text>{t("components.community_bots.loading_assistants")}</Text>
                                </div>
                            )}

                            {/* Bot Cards Grid */}
                            {!isLoading && (
                                <div className={styles.botsGrid}>
                                    {filteredBots
                                        .filter(botObj => (choosenTag === "" ? true : botObj.bot.tags.includes(choosenTag)))
                                        .map(botObj => botObj.bot)
                                        .map((bot: Bot) => (
                                            <Card key={bot.id} className={styles.botCard} onClick={() => onChooseBot(bot)}>
                                                <CardHeader
                                                    header={<Body1 className={styles.botTitle}>{bot.title}</Body1>}
                                                    description={
                                                        <Text size={200} className={styles.botDescription}>
                                                            {bot.description.length > 100 ? `${bot.description.substring(0, 100)}...` : bot.description}
                                                        </Text>
                                                    }
                                                />
                                                <CardFooter>
                                                    <div className={styles.botCardFooter}>
                                                        <div className={styles.botCardLeft}>
                                                            <div className={styles.botTags}>
                                                                {bot.tags?.slice(0, 2).map((tag: string) => (
                                                                    <Badge key={tag} size="small" color="brand">
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {bot.tags && bot.tags.length > 2 && (
                                                                    <Badge size="small" color="subtle">
                                                                        +{bot.tags.length - 2}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {bot.tools && bot.tools.length > 0 && (
                                                                <div className={styles.toolsIndicator}>
                                                                    <Badge size="small" color="informative" appearance="outline">
                                                                        🔧 {bot.tools.length}{" "}
                                                                        {bot.tools.length === 1
                                                                            ? t("components.community_bots.tool_single")
                                                                            : t("components.community_bots.tools_plural")}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                            {bot.hierarchical_access && bot.hierarchical_access.length > 0 && (
                                                                <div className={styles.departmentsIndicator}>
                                                                    <Badge size="small" color="warning" appearance="outline">
                                                                        🏢 {bot.hierarchical_access.length}{" "}
                                                                        {bot.hierarchical_access.length === 1
                                                                            ? t("components.community_bots.department_single")
                                                                            : t("components.community_bots.departments_plural")}
                                                                    </Badge>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <Badge size="small" appearance="outline">
                                                            v{bot.version}
                                                        </Badge>
                                                    </div>
                                                </CardFooter>
                                            </Card>
                                        ))}
                                </div>
                            )}

                            {/* No Results State */}
                            {!isLoading && filteredBots.filter(bot => (choosenTag === "" ? true : bot.tags.includes(choosenTag))).length === 0 && (
                                <div className={styles.noResults}>
                                    <Text size={400}>{t("components.community_bots.no_assistants_found")}</Text>
                                </div>
                            )}
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <Dialog
                modalType="modal"
                open={showBotDialog}
                onOpenChange={(_event, data) => {
                    if (!data.open) {
                        setChoosenBot(mockBot);
                        setShowBotDialog(false);
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
                                            setChoosenBot(mockBot);
                                            setShowBotDialog(false);
                                            setShowSearchDialogInput(true);
                                        }}
                                    />
                                </DialogTrigger>
                            }
                        >
                            <div className={styles.titleSection}>
                                <Body1 className={styles.botDetailTitle}>{choosenBot.title}</Body1>
                                {/* <div className={styles.versionSection}>
                                    <Text size={200}>Version:</Text>
                                    {versionPicker}
                                </div> */}
                                {choosenBot.hierarchical_access && choosenBot.hierarchical_access.length > 0 ? (
                                    <>
                                        <Text size={200} className={styles.sectionDescription}>
                                            {t("components.community_bots.departments_description")}
                                        </Text>
                                        <div className={styles.departmentsList}>
                                            {choosenBot.hierarchical_access.map((department, index) => (
                                                <Badge key={index} size="medium" color="warning" className={styles.departmentBadge}>
                                                    {department}
                                                </Badge>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.publicAccess}>
                                        <Badge size="medium" color="success" className={styles.publicAccessBadge}>
                                            🌐 {t("components.community_bots.public_access")}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </DialogTitle>
                        <DialogContent className={styles.detailContent}>
                            {/* Tags Section */}
                            {choosenBot.tags && choosenBot.tags.length > 0 && (
                                <div className={styles.detailTags}>
                                    {choosenBot.tags.map((tag: string) => (
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
                                    {t("components.community_bots.description")}
                                </Text>
                                <div className={styles.markdownContent}>
                                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ code: CodeBlockRenderer }}>
                                        {choosenBot.description}
                                    </Markdown>
                                </div>
                            </div>

                            <Divider />

                            {/* Tools Section */}
                            {choosenBot.tools && choosenBot.tools.length > 0 && (
                                <div className={styles.toolsSection}>
                                    <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                        {t("components.community_bots.tools")}
                                    </Text>
                                    <div className={styles.toolsList}>
                                        {choosenBot.tools.map(tool => (
                                            <Badge key={tool.id} size="medium" color="informative" className={styles.toolBadge}>
                                                {tool.id}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {choosenBot.tools && choosenBot.tools.length > 0 && <Divider />}

                            {/* System Message Section */}
                            <div className={styles.systemMessageSection}>
                                <Text size={300} weight="semibold" className={styles.sectionTitle}>
                                    {t("components.community_bots.system_message")}
                                </Text>
                                <div className={styles.systemMessageContent}>
                                    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {choosenBot.system_message}
                                    </Markdown>
                                </div>
                            </div>
                        </DialogContent>
                        <DialogActions className={styles.detailActions}>
                            <Button
                                appearance="subtle"
                                onClick={() => {
                                    setChoosenBot(mockBot);
                                    setShowBotDialog(false);
                                    setShowSearchDialogInput(true);
                                }}
                            >
                                {t("components.community_bots.back_to_search")}
                            </Button>
                            <DialogTrigger disableButtonEnhancement>
                                <Tooltip
                                    content={botAlreadySaved ? t("components.community_bots.assistant_already_saved") : t("components.community_bots.save")}
                                    relationship="description"
                                    positioning="above"
                                >
                                    <Button appearance="primary" onClick={onSaveBot} disabled={botAlreadySaved} icon={<Save24Filled />}>
                                        {botAlreadySaved ? t("components.community_bots.already_saved") : t("components.community_bots.save")}
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
