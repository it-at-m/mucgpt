import { InlineDrawer, DrawerHeader, Button, DrawerBody, Text, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Spinner } from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Chat24Regular,
    Copy20Regular,
    Edit20Regular,
    Delete20Regular,
    Book24Regular,
    Sparkle24Regular,
    DocumentText24Regular,
    TargetArrow24Regular,
    Color24Regular,
    Scales24Regular,
    MoreVertical20Regular,
    ArrowExportUp20Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./AssistantDetailsSidebar.module.css";
import { AssistantResponse, CommunityAssistantSnapshot, ToolBase } from "../../api/models";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

export interface AssistantCardData {
    id: string;
    title: string;
    description: string;
    subscriptions: number;
    updated: string;
    tags: string[];
    rawData: AssistantResponse | CommunityAssistantSnapshot;
    isDeletedSnapshot?: boolean;
}

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
    hideStartChat
}: AssistantDetailsSidebarProps) => {
    const { t } = useTranslation();
    const latestVersion = assistant?.rawData && "latest_version" in assistant.rawData ? assistant.rawData.latest_version : undefined;
    const snapshot = assistant?.rawData && !("latest_version" in assistant.rawData) ? assistant.rawData : undefined;

    const getCreativityConfig = (creativity: string) => {
        switch (creativity.toLowerCase()) {
            case "low":
                return {
                    text: t("components.chattsettingsdrawer.creativity_low"),
                    icon: <TargetArrow24Regular />,
                    description: t("components.chattsettingsdrawer.creativity_low_description")
                };
            case "high":
                return {
                    text: t("components.chattsettingsdrawer.creativity_high"),
                    icon: <Color24Regular />,
                    description: t("components.chattsettingsdrawer.creativity_high_description")
                };
            default:
                return {
                    text: t("components.chattsettingsdrawer.creativity_medium"),
                    icon: <Scales24Regular />,
                    description: t("components.chattsettingsdrawer.creativity_medium_description")
                };
        }
    };

    const assistantCreativity = latestVersion?.creativity || snapshot?.creativity || "balanced";
    const creativityConfig = getCreativityConfig(assistantCreativity);

    const enabledTools = (latestVersion?.tools || snapshot?.tools || []).filter((tool: ToolBase) => tool.config?.enabled);
    const systemPrompt = latestVersion?.system_prompt || snapshot?.system_message;
    const isOwned = assistant ? ownedAssistantIds.has(assistant.id) : false;
    const isDeletedSnapshot = Boolean(assistant?.isDeletedSnapshot);

    return (
        <InlineDrawer open={isOpen} position="end" className={styles.inlineDrawer} aria-labelledby="sidebar-title">
            <DrawerHeader>
                <div className={styles.headerContainer}>
                    <div className={styles.closeButtonContainer}>
                        <Button appearance="subtle" aria-label={t("common.close")} icon={<Dismiss24Regular />} onClick={onClose} />
                    </div>
                    <div id="sidebar-title" className={styles.sidebarTitle}>
                        {assistant?.title || (isLoading ? t("common.loading") : "")}
                    </div>
                </div>
            </DrawerHeader>

            <DrawerBody className={styles.drawerBody}>
                {isLoading ? (
                    <div className={styles.loadingContainer}>
                        <Spinner size="extra-large" />
                        <Text>{t("common.loading")}</Text>
                    </div>
                ) : (
                    <>
                        <div className={styles.creativitySection}>
                            <div className={styles.creativityBadge}>
                                <span className={styles.creativityIcon}>{creativityConfig.icon}</span>
                                <span>{creativityConfig.text}</span>
                            </div>
                            <Text className={styles.creativityDescription}>{creativityConfig.description}</Text>
                        </div>

                        {assistant && isDeletedSnapshot && !hideStartChat && (
                            <div className={styles.deletedCallout}>
                                <Text className={styles.deletedCalloutTitle}>{t("components.community_assistants.deleted_state_title")}</Text>
                                <Text>{t("components.community_assistants.discovery_deleted_hint")}</Text>
                                <div className={styles.deletedActionRow}>
                                    {onDuplicate && (
                                        <Button appearance="primary" icon={<Copy20Regular />} onClick={onDuplicate} size="medium">
                                            {t("components.community_assistants.deleted_state_save_action")}
                                        </Button>
                                    )}
                                    {onStartChat && (
                                        <Button appearance="secondary" icon={<Chat24Regular />} onClick={onStartChat}>
                                            {t("components.community_assistants.deleted_state_history_action")}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {assistant && !hideStartChat && !isDeletedSnapshot && (
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
                                            icon={<MoreVertical20Regular />}
                                            aria-label={t("components.community_assistants.more_options", "More options")}
                                            size="large"
                                        />
                                    </MenuTrigger>
                                    <MenuPopover>
                                        <MenuList>
                                            {isOwned && (
                                                <MenuItem icon={<Edit20Regular />} onClick={onEdit}>
                                                    {t("common.edit")}
                                                </MenuItem>
                                            )}
                                            {onDuplicate && (
                                                <MenuItem icon={<Copy20Regular />} onClick={onDuplicate}>
                                                    {t("components.community_assistants.duplicate")}
                                                </MenuItem>
                                            )}
                                            {onExport && (
                                                <MenuItem icon={<ArrowExportUp20Regular />} onClick={onExport}>
                                                    {t("components.assistantsettingsdrawer.export")}
                                                </MenuItem>
                                            )}
                                            {isOwned && (
                                                <MenuItem icon={<Delete20Regular />} onClick={onDelete} className={styles.menuDeleteItem}>
                                                    {t("common.delete")}
                                                </MenuItem>
                                            )}
                                        </MenuList>
                                    </MenuPopover>
                                </Menu>
                            </div>
                        )}

                        <div className={styles.sidebarSection}>
                            <div className={styles.sectionHeader}>
                                <Book24Regular className={styles.sectionIcon} />
                                <span>{t("components.community_assistants.about", "ABOUT")}</span>
                            </div>
                            <div className={styles.descriptionContainer}>
                                <MarkdownRenderer className={styles.aboutText}>{assistant?.description ?? ""}</MarkdownRenderer>
                            </div>
                        </div>

                        {enabledTools.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <Sparkle24Regular className={styles.sectionIcon} />
                                    <span>{t("components.community_assistants.enabled_tools", "ENABLED TOOLS")}</span>
                                </div>
                                <div className={styles.toolList}>
                                    {enabledTools.map(tool => (
                                        <div key={tool.id} className={styles.toolPill}>
                                            {tool.id}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {systemPrompt && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <DocumentText24Regular className={styles.sectionIcon} />
                                    <span>{t("components.community_assistants.system_prompt", "SYSTEM PROMPT")}</span>
                                </div>
                                <div className={styles.systemPromptContainer}>
                                    <MarkdownRenderer className={styles.promptMarkdown}>{systemPrompt}</MarkdownRenderer>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DrawerBody>
        </InlineDrawer>
    );
};
