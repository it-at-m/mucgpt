import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    InlineDrawer,
    DrawerHeader,
    Button,
    DrawerBody,
    Text,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    Tooltip
} from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Chat24Regular,
    Copy24Regular,
    Checkmark24Regular,
    Edit24Regular,
    Delete24Regular,
    Book24Regular,
    Sparkle24Regular,
    DocumentText24Regular,
    LockClosed20Regular,
    MoreVertical24Regular,
    ArrowExportUp24Regular,
    Settings24Regular,
    Lightbulb24Regular,
    ArrowRight24Regular
} from "@fluentui/react-icons";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./AssistantDetailsSidebar.module.css";
import { Assistant, AssistantResponse, CommunityAssistant, CommunityAssistantSnapshot, ToolBase } from "../../api/models";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { EdelweissSpinner } from "../EdelweissSpinner";
import { CREATIVITY_MEDIUM } from "../../constants";
import { getCreativityOption } from "../../utils/creativityOptions";
import { getPrimaryOwnerDetails, OwnerMetadataLink } from "../OwnerMetadataLink/OwnerMetadataLink";

export interface AssistantCardData {
    id: string;
    title: string;
    description: string;
    subscriptions: number;
    updated?: string | null;
    lastUsed?: number;
    tags: string[];
    rawData: AssistantResponse | CommunityAssistantSnapshot | CommunityAssistant | Assistant;
    isDeletedSnapshot?: boolean;
    isLocalAssistant?: boolean;
    isOwnedAssistant?: boolean;
    isSubscribedAssistant?: boolean;
}

const formatConfigurationDate = (value: string | undefined, locale: string): string | undefined => {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;

    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(date);
};

const getModelDisplayName = (model: string | undefined): string | undefined => {
    if (!model) return undefined;
    return model.split("/").pop() || model;
};

const formatSubscriberCount = (count: number): string => {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }

    return count.toString();
};

interface AssistantDetailsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: AssistantCardData | null;
    isLoading?: boolean;
    ownedAssistantIds: Set<string>;
    onStartChat?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onExport?: () => void;
    onDelete?: () => void;
    onUnsubscribe?: () => void;
    onMigrateLocal?: () => void;
    hideStartChat?: boolean;
}

export const AssistantDetailsSidebar = ({
    isOpen,
    onClose,
    assistant,
    isLoading = false,
    ownedAssistantIds,
    onStartChat,
    onEdit,
    onDuplicate,
    onExport,
    onDelete,
    onUnsubscribe,
    onMigrateLocal,
    hideStartChat
}: AssistantDetailsSidebarProps) => {
    const { t, i18n } = useTranslation();
    const [systemPromptCopied, setSystemPromptCopied] = useState<boolean>(false);
    const [isSystemPromptOpen, setIsSystemPromptOpen] = useState<boolean>(false);
    const responseData = assistant?.rawData && "latest_version" in assistant.rawData ? assistant.rawData : undefined;
    const latestVersion = responseData?.latest_version;
    const snapshot =
        assistant?.rawData && !("latest_version" in assistant.rawData) && "system_message" in assistant.rawData
            ? (assistant.rawData as CommunityAssistantSnapshot | Assistant)
            : undefined;

    const assistantCreativity = latestVersion?.creativity || snapshot?.creativity || CREATIVITY_MEDIUM;
    const creativityConfig = getCreativityOption(t, assistantCreativity);

    const enabledTools = (latestVersion?.tools || snapshot?.tools || []).filter((tool: ToolBase) => tool.config?.enabled);
    const systemPrompt = latestVersion?.system_prompt || snapshot?.system_message;
    const defaultModel = latestVersion?.default_model || snapshot?.default_model;
    const starterPrompts = latestVersion?.examples || snapshot?.examples || [];
    const followUpActions = latestVersion?.quick_prompts || snapshot?.quick_prompts || [];
    const rawData = assistant?.rawData;
    const isVisible = (rawData && "is_visible" in rawData ? rawData.is_visible : undefined) ?? latestVersion?.is_visible ?? snapshot?.is_visible ?? true;
    const version = latestVersion?.version ?? snapshot?.version;
    const configurationDate = formatConfigurationDate(latestVersion?.created_at, i18n.resolvedLanguage || i18n.language);
    const systemPromptCopyLabel = systemPromptCopied
        ? t("components.community_assistants.system_prompt_copied", "Copied")
        : t("components.community_assistants.system_prompt_copy", "Copy system prompt");

    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onCopySystemPrompt = useCallback(async () => {
        if (!systemPrompt) return;
        try {
            await navigator.clipboard.writeText(systemPrompt);
            setSystemPromptCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => {
                setSystemPromptCopied(false);
            }, 1000);
        } catch (err) {
            console.error("Failed to copy system prompt:", err);
        }
    }, [systemPrompt]);

    useEffect(() => {
        setSystemPromptCopied(false);
        setIsSystemPromptOpen(false);
    }, [assistant?.id]);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    const primaryOwner = getPrimaryOwnerDetails(rawData);
    const isOwned = assistant ? ownedAssistantIds.has(assistant.id) : false;
    const isDeletedSnapshot = Boolean(assistant?.isDeletedSnapshot);
    const isLocalAssistant = Boolean(assistant?.isLocalAssistant);
    const isLegacyAssistant = assistant ? /^\d+$/.test(assistant.id) : false;
    const canUnsubscribe = Boolean(assistant?.isSubscribedAssistant && !isOwned && !isDeletedSnapshot && !isLocalAssistant && !isLegacyAssistant);
    const creatorFallbackLabel = t("components.community_assistants.filter_all", "Community");
    const isPrivate = isLocalAssistant || !isVisible;

    return (
        <InlineDrawer open={isOpen} position="end" className={styles.inlineDrawer} aria-labelledby="sidebar-title">
            <DrawerHeader>
                <div className={styles.headerContainer}>
                    <Button className={styles.closeButton} appearance="subtle" aria-label={t("common.close")} icon={<Dismiss24Regular />} onClick={onClose} />
                    <div id="sidebar-title" className={styles.sidebarTitle}>
                        {assistant?.title || (isLoading ? t("common.loading") : "")}
                    </div>
                </div>
            </DrawerHeader>

            <DrawerBody className={styles.drawerBody}>
                {isLoading ? (
                    <div className={styles.loadingContainer}>
                        <EdelweissSpinner size="extra-large" />
                        <Text>{t("common.loading")}</Text>
                    </div>
                ) : (
                    <>
                        {assistant && (
                            <div className={styles.assistantMetadata}>
                                <span className={styles.creatorMetadata}>
                                    {isOwned || isLocalAssistant ? (
                                        t("components.community_assistants.created_by_you", "Von dir")
                                    ) : (
                                        <>
                                            {t("components.community_assistants.created_by", "Von")}{" "}
                                            <OwnerMetadataLink owner={primaryOwner} fallbackLabel={creatorFallbackLabel} />
                                        </>
                                    )}
                                </span>
                                <span className={styles.metadataSeparator} aria-hidden="true">
                                    ·
                                </span>
                                {isPrivate ? (
                                    <span className={styles.metadataItem}>
                                        <LockClosed20Regular aria-hidden="true" />
                                        <span>{t("components.community_assistants.private_label", "Privat")}</span>
                                    </span>
                                ) : (
                                    <span className={styles.metadataItem}>
                                        {t("components.community_assistants.subscriber_count", {
                                            count: formatSubscriberCount(assistant.subscriptions)
                                        })}
                                    </span>
                                )}
                            </div>
                        )}

                        {assistant && isDeletedSnapshot && !hideStartChat && (
                            <div className={styles.deletedCallout}>
                                <Text className={styles.calloutTitle}>{t("components.community_assistants.deleted_state_title")}</Text>
                                <Text>{t("components.community_assistants.discovery_deleted_hint")}</Text>
                                <div className={styles.deletedActionRow}>
                                    {onDuplicate && (
                                        <Button appearance="primary" icon={<Copy24Regular />} onClick={onDuplicate} size="medium">
                                            {t("components.community_assistants.deleted_state_save_action")}
                                        </Button>
                                    )}
                                    {onStartChat && (
                                        <Button appearance="secondary" icon={<Chat24Regular />} onClick={onStartChat}>
                                            {t("components.community_assistants.deleted_state_history_action")}
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button appearance="outline" icon={<Delete24Regular />} onClick={onDelete} className={styles.deleteButton}>
                                            {t("common.delete")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {assistant && isLocalAssistant && !isLegacyAssistant && !hideStartChat && (
                            <div className={styles.localCallout}>
                                <Text className={styles.calloutTitle}>{t("components.community_assistants.local_state_title")}</Text>
                                <Text>{t("components.community_assistants.discovery_local_hint")}</Text>
                                <div className={styles.deletedActionRow}>
                                    {onMigrateLocal && (
                                        <Button appearance="primary" icon={<ArrowExportUp24Regular />} onClick={onMigrateLocal} size="medium">
                                            {t("components.community_assistants.local_state_publish_action")}
                                        </Button>
                                    )}
                                    {onStartChat && (
                                        <Button appearance="secondary" icon={<Chat24Regular />} onClick={onStartChat}>
                                            {t("components.community_assistants.deleted_state_history_action")}
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button appearance="outline" icon={<Delete24Regular />} onClick={onDelete} className={styles.deleteButton}>
                                            {t("common.delete")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {assistant && isLegacyAssistant && !hideStartChat && (
                            <div className={styles.deletedCallout}>
                                <Text className={styles.calloutTitle}>{t("components.community_assistants.legacy_state_title")}</Text>
                                <Text>{t("components.community_assistants.legacy_state_hint")}</Text>
                                <div className={styles.deletedActionRow}>
                                    {onStartChat && (
                                        <Button appearance="secondary" icon={<Chat24Regular />} onClick={onStartChat}>
                                            {t("components.community_assistants.deleted_state_history_action")}
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button appearance="outline" icon={<Delete24Regular />} onClick={onDelete} className={styles.deleteButton}>
                                            {t("common.delete")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {assistant && !hideStartChat && !isDeletedSnapshot && !isLocalAssistant && !isLegacyAssistant && (
                            <div className={styles.startButtonRow}>
                                <Button
                                    appearance="primary"
                                    className={styles.startConversationButton}
                                    icon={<Chat24Regular />}
                                    onClick={onStartChat}
                                    size="large"
                                >
                                    {t("components.community_assistants.start_chat", "Start Conversation")}
                                </Button>
                                <Menu>
                                    <MenuTrigger disableButtonEnhancement>
                                        <Button
                                            appearance="primary"
                                            className={styles.moreOptionsButton}
                                            icon={<MoreVertical24Regular />}
                                            aria-label={t("components.community_assistants.more_options", "More options")}
                                            size="large"
                                        />
                                    </MenuTrigger>
                                    <MenuPopover>
                                        <MenuList>
                                            {isOwned && (
                                                <MenuItem icon={<Edit24Regular />} onClick={onEdit}>
                                                    {t("common.edit")}
                                                </MenuItem>
                                            )}
                                            {onDuplicate && (
                                                <MenuItem icon={<Copy24Regular />} onClick={onDuplicate}>
                                                    {t("components.community_assistants.duplicate")}
                                                </MenuItem>
                                            )}
                                            {onExport && (
                                                <MenuItem icon={<ArrowExportUp24Regular />} onClick={onExport}>
                                                    {t("components.assistantsettingsdrawer.export")}
                                                </MenuItem>
                                            )}
                                            {isOwned && (
                                                <MenuItem icon={<Delete24Regular />} onClick={onDelete} className={styles.menuDeleteItem}>
                                                    {t("common.delete")}
                                                </MenuItem>
                                            )}
                                            {canUnsubscribe && onUnsubscribe && (
                                                <MenuItem icon={<Delete24Regular />} onClick={onUnsubscribe} className={styles.menuDeleteItem}>
                                                    {t("components.community_assistants.unsubscribe")}
                                                </MenuItem>
                                            )}
                                        </MenuList>
                                    </MenuPopover>
                                </Menu>
                            </div>
                        )}

                        <div className={`${styles.sidebarSection} ${systemPrompt ? styles.promptAdjacentSection : ""}`}>
                            <div className={styles.sectionHeader}>
                                <Book24Regular className={styles.sectionIcon} />
                                <span>{t("components.assistant_editor.description")}</span>
                            </div>
                            <MarkdownRenderer className={styles.aboutText}>{assistant?.description ?? ""}</MarkdownRenderer>
                        </div>

                        {systemPrompt && (
                            <div className={`${styles.sidebarSection} ${styles.promptAdjacentSection}`}>
                                <Accordion
                                    key={assistant?.id}
                                    collapsible
                                    className={styles.promptAccordion}
                                    openItems={isSystemPromptOpen ? ["system-prompt"] : []}
                                    onToggle={(_, data) => setIsSystemPromptOpen(data.openItems.some(item => item === "system-prompt"))}
                                >
                                    <AccordionItem value="system-prompt" className={styles.promptAccordionItem}>
                                        <div className={`${styles.promptHeaderRow} ${isSystemPromptOpen ? styles.promptHeaderRowOpen : ""}`}>
                                            <AccordionHeader expandIconPosition="end" className={styles.promptAccordionHeader}>
                                                <span className={styles.accordionHeaderContent}>
                                                    <DocumentText24Regular className={styles.sectionIcon} />
                                                    <span>{t("components.assistant_editor.system_prompt")}</span>
                                                </span>
                                            </AccordionHeader>
                                            {isSystemPromptOpen && (
                                                <Tooltip content={systemPromptCopyLabel} relationship="description" positioning="below">
                                                    <Button
                                                        className={styles.promptCopyButton}
                                                        appearance="subtle"
                                                        aria-label={systemPromptCopyLabel}
                                                        icon={!systemPromptCopied ? <Copy24Regular /> : <Checkmark24Regular />}
                                                        onClick={onCopySystemPrompt}
                                                        size="small"
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                        <AccordionPanel className={styles.promptAccordionPanel}>
                                            <MarkdownRenderer className={styles.promptMarkdown}>{systemPrompt}</MarkdownRenderer>
                                        </AccordionPanel>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        )}

                        <div className={styles.sidebarSection}>
                            <div className={styles.sectionHeader}>
                                <Settings24Regular className={styles.sectionIcon} />
                                <span>{t("components.assistant_editor.section_behaviour")}</span>
                            </div>
                            <dl className={styles.configurationList}>
                                <div className={styles.configurationRow}>
                                    <dt>{t("components.assistant_editor.creativity")}</dt>
                                    <dd>{creativityConfig.label}</dd>
                                </div>
                                <div className={styles.configurationRow}>
                                    <dt>{t("components.assistant_editor.default_model")}</dt>
                                    <dd>{getModelDisplayName(defaultModel) || t("components.assistant_editor.no_default_model")}</dd>
                                </div>
                            </dl>
                        </div>

                        {starterPrompts.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <Lightbulb24Regular className={styles.sectionIcon} />
                                    <span>{t("components.assistant_editor.starter_prompts")}</span>
                                </div>
                                <ul className={styles.previewList}>
                                    {starterPrompts.map((prompt, index) => (
                                        <li key={`${prompt.text}-${index}`} className={styles.previewItem}>
                                            {prompt.text}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {followUpActions.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <ArrowRight24Regular className={styles.sectionIcon} />
                                    <span>{t("components.assistant_editor.follow_up_actions")}</span>
                                </div>
                                <ul className={styles.previewList}>
                                    {followUpActions.map((action, index) => (
                                        <li key={action.id ?? `${action.label}-${index}`} className={styles.previewItem}>
                                            {action.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {enabledTools.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <Sparkle24Regular className={styles.sectionIcon} />
                                    <span>{t("components.assistant_editor.section_tools")}</span>
                                </div>
                                <ul className={styles.toolList}>
                                    {enabledTools.map((tool: ToolBase) => (
                                        <li key={tool.id} className={styles.toolItem}>
                                            {tool.id}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {version !== undefined && version !== "" && (
                            <div className={styles.metadataFooter}>
                                <span>{t("components.community_assistants.version", { version })}</span>
                                {configurationDate && (
                                    <>
                                        <span aria-hidden="true">·</span>
                                        <span>{t("components.community_assistants.configuration_updated", { date: configurationDate })}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </DrawerBody>
        </InlineDrawer>
    );
};
