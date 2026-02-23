import { InlineDrawer, DrawerHeader, Button, DrawerBody, Text } from "@fluentui/react-components";
import {
    Dismiss24Regular,
    Chat24Regular,
    Edit20Regular,
    Delete20Regular,
    Info24Regular,
    Sparkle24Regular,
    DocumentText24Regular,
    TargetArrow24Regular,
    Color24Regular,
    Scales24Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import styles from "./AssistantDetailsSidebar.module.css";
import { AssistantResponse } from "../../api/models";

export interface AssistantCardData {
    id: string;
    title: string;
    description: string;
    subscriptions: number;
    updated: string;
    tags: string[];
    rawData: AssistantResponse;
}

interface AssistantDetailsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    assistant: AssistantCardData | null;
    ownedAssistantIds: Set<string>;
    onStartChat: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export const AssistantDetailsSidebar = ({ isOpen, onClose, assistant, ownedAssistantIds, onStartChat, onEdit, onDelete }: AssistantDetailsSidebarProps) => {
    const { t } = useTranslation();

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

    const creativityConfig = assistant?.rawData?.latest_version?.creativity
        ? getCreativityConfig(assistant.rawData.latest_version.creativity)
        : getCreativityConfig("balanced");

    return (
        <InlineDrawer open={isOpen} position="end" className={styles.inlineDrawer} aria-labelledby="sidebar-title">
            <DrawerHeader>
                <div className={styles.headerContainer}>
                    <div className={styles.closeButtonContainer}>
                        <Button appearance="subtle" aria-label={t("common.close")} icon={<Dismiss24Regular />} onClick={onClose} />
                    </div>
                    <div id="sidebar-title" className={styles.sidebarTitle}>
                        {assistant?.title}
                    </div>
                </div>
            </DrawerHeader>

            <DrawerBody className={styles.drawerBody}>
                <div className={styles.creativitySection}>
                    <div className={styles.creativityBadge}>
                        <span className={styles.creativityIcon}>{creativityConfig.icon}</span>
                        <span>{creativityConfig.text}</span>
                    </div>
                    <Text className={styles.creativityDescription}>{creativityConfig.description}</Text>
                </div>

                {assistant && (
                    <div className={styles.startButtonWrapper}>
                        <Button appearance="primary" className={styles.startConversationButton} icon={<Chat24Regular />} onClick={onStartChat} size="large">
                            {t("components.community_assistants.start_chat", "Start Conversation")}
                        </Button>
                    </div>
                )}

                {assistant && ownedAssistantIds.has(assistant.id) && (
                    <div className={styles.actionButtonsRow}>
                        <Button appearance="outline" className={styles.actionButton} icon={<Edit20Regular />} onClick={onEdit} size="medium">
                            {t("common.edit")}
                        </Button>
                        <Button
                            appearance="outline"
                            className={`${styles.actionButton} ${styles.deleteButton}`}
                            icon={<Delete20Regular />}
                            onClick={onDelete}
                            size="medium"
                        >
                            {t("common.delete")}
                        </Button>
                    </div>
                )}

                <div className={styles.sidebarSection}>
                    <div className={styles.sectionHeader}>
                        <Info24Regular className={styles.sectionIcon} />
                        <span>{t("components.create_assistant_dialog.description", "ABOUT")}</span>
                    </div>
                    <Text className={styles.aboutText}>{assistant?.description}</Text>
                </div>

                {assistant?.rawData?.latest_version?.tools && assistant.rawData.latest_version.tools.length > 0 && (
                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionHeader}>
                            <Sparkle24Regular className={styles.sectionIcon} />
                            <span>{t("components.community_assistants.enabled_tools", "ENABLED TOOLS")}</span>
                        </div>
                        <div className={styles.toolList}>
                            {assistant.rawData.latest_version.tools.map((tool, index) => (
                                <div key={index} className={styles.toolPill}>
                                    {tool.id}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {assistant?.rawData?.latest_version?.system_prompt && (
                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionHeader}>
                            <DocumentText24Regular className={styles.sectionIcon} />
                            <span>{t("components.community_assistants.system_prompt", "SYSTEM PROMPT")}</span>
                        </div>
                        <div className={styles.systemPromptContainer}>
                            <Text className={styles.promptText}>{assistant.rawData.latest_version.system_prompt}</Text>
                        </div>
                    </div>
                )}
            </DrawerBody>
        </InlineDrawer>
    );
};
