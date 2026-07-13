import { InlineDrawer, DrawerHeader, Button, DrawerBody, Text, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Tooltip } from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Chat24Regular,
    Copy20Regular,
    Checkmark20Regular,
    Edit20Regular,
    Delete20Regular,
    Book24Regular,
    Sparkle24Regular,
    DocumentText24Regular,
    TargetArrow24Regular,
    Color24Regular,
    Person24Regular,
    Scales24Regular,
    MoreVertical20Regular,
    ArrowExportUp20Regular
} from "@fluentui/react-icons";
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./AssistantDetailsSidebar.module.css";
import { Assistant, AssistantResponse, CommunityAssistant, CommunityAssistantSnapshot, OwnerDetailsResponse, ToolBase } from "../../api/models";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { EdelweissSpinner } from "../EdelweissSpinner";
import { getCreativityOption } from "../../utils/creativityOptions";

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
    const { t } = useTranslation();
    const [systemPromptCopied, setSystemPromptCopied] = useState<boolean>(false);
    const responseData = assistant?.rawData && "latest_version" in assistant.rawData ? assistant.rawData : undefined;
    const latestVersion = responseData?.latest_version;
    const snapshot =
        assistant?.rawData && !("latest_version" in assistant.rawData) && "system_message" in assistant.rawData
            ? (assistant.rawData as CommunityAssistantSnapshot | Assistant)
            : undefined;

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
    const creativityConfig = getCreativityOption(t, assistantCreativity);

    const enabledTools = (latestVersion?.tools || snapshot?.tools || []).filter((tool: ToolBase) => tool.config?.enabled);
    const systemPrompt = latestVersion?.system_prompt || snapshot?.system_message;

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
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    const ownersDetailed: OwnerDetailsResponse[] = responseData?.owners_detailed || latestVersion?.owners_detailed || [];
    const isOwned = assistant ? ownedAssistantIds.has(assistant.id) : false;
    const isDeletedSnapshot = Boolean(assistant?.isDeletedSnapshot);
    const isLocalAssistant = Boolean(assistant?.isLocalAssistant);
    const isLegacyAssistant = assistant ? /^\d+$/.test(assistant.id) : false;
    const canUnsubscribe = Boolean(assistant?.isSubscribedAssistant && !isOwned && !isDeletedSnapshot && !isLocalAssistant && !isLegacyAssistant);

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
                        <EdelweissSpinner size="extra-large" />
                        <Text>{t("common.loading")}</Text>
                    </div>
                ) : (
                    <>
                        <div className={styles.creativitySection}>
                            <div className={styles.creativityBadge}>
                                <span className={styles.creativityIcon}>{creativityConfig.icon}</span>
                                <span>{creativityConfig.label}</span>
                            </div>
                            <Text className={styles.creativityDescription}>{creativityConfig.description}</Text>
                        </div>

                        {assistant && isDeletedSnapshot && !hideStartChat && (
                            <div className={styles.deletedCallout}>
                                <Text className={styles.calloutTitle}>{t("components.community_assistants.deleted_state_title")}</Text>
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
                                    {onDelete && (
                                        <Button appearance="outline" icon={<Delete20Regular />} onClick={onDelete} className={styles.deleteButton}>
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
                                        <Button appearance="primary" icon={<ArrowExportUp20Regular />} onClick={onMigrateLocal} size="medium">
                                            {t("components.community_assistants.local_state_publish_action")}
                                        </Button>
                                    )}
                                    {onStartChat && (
                                        <Button appearance="secondary" icon={<Chat24Regular />} onClick={onStartChat}>
                                            {t("components.community_assistants.deleted_state_history_action")}
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button appearance="outline" icon={<Delete20Regular />} onClick={onDelete} className={styles.deleteButton}>
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
                                        <Button appearance="outline" icon={<Delete20Regular />} onClick={onDelete} className={styles.deleteButton}>
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
                                            {canUnsubscribe && onUnsubscribe && (
                                                <MenuItem icon={<Delete20Regular />} onClick={onUnsubscribe} className={styles.menuDeleteItem}>
                                                    {t("components.community_assistants.unsubscribe")}
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

                        {ownersDetailed.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <Person24Regular className={styles.sectionIcon} />
                                    <span>{t("components.community_assistants.owner_details", "OWNERS")}</span>
                                </div>
                                <div className={styles.ownerList}>
                                    {ownersDetailed.map(owner => (
                                        <div key={owner.user_id} className={styles.ownerRow}>
                                            <Text weight="semibold">{owner.username || owner.user_id}</Text>
                                            {owner.contact_address && <Text className={styles.ownerContact}>{owner.contact_address}</Text>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {enabledTools.length > 0 && (
                            <div className={styles.sidebarSection}>
                                <div className={styles.sectionHeader}>
                                    <Sparkle24Regular className={styles.sectionIcon} />
                                    <span>{t("components.community_assistants.enabled_tools", "ENABLED TOOLS")}</span>
                                </div>
                                <div className={styles.toolList}>
                                    {enabledTools.map((tool: ToolBase) => (
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
                                    <Tooltip
                                        content={
                                            systemPromptCopied
                                                ? t("components.community_assistants.system_prompt_copied", "Copied")
                                                : t("components.community_assistants.system_prompt_copy", "Copy system prompt")
                                        }
                                        relationship="description"
                                        positioning="below"
                                    >
                                        <Button
                                            style={{ marginLeft: "auto" }}
                                            appearance="subtle"
                                            aria-label={
                                                systemPromptCopied
                                                    ? t("components.community_assistants.system_prompt_copied", "Copied")
                                                    : t("components.community_assistants.system_prompt_copy", "Copy system prompt")
                                            }
                                            icon={!systemPromptCopied ? <Copy20Regular /> : <Checkmark20Regular />}
                                            onClick={onCopySystemPrompt}
                                            size="small"
                                        />
                                    </Tooltip>
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
