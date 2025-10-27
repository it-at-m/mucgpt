import { CardHeader, CardFooter, Text, Badge, Body1 } from "@fluentui/react-components";
import { Assistant } from "../../../api";
import { useTranslation } from "react-i18next";
import { AssistantCard as BaseAssistantCard } from "../../AssistantCard";
import styles from "../CommunityAssistantDialog.module.css";

interface CommunityAssistantCardProps {
    assistant: Assistant;
    subscriptions: number;
    isOwned: boolean;
    isSubscribed: boolean;
    onClick: (assistant: Assistant) => void;
}

export const CommunityAssistantCard = ({ assistant, subscriptions, isOwned, isSubscribed, onClick }: CommunityAssistantCardProps) => {
    const { t } = useTranslation();

    const handleClick = () => {
        onClick(assistant);
    };

    const header = (
        <CardHeader
            header={
                <>
                    <div className={styles.cardHeader}>
                        <Body1 className={styles.assistantTitle}>{assistant.title}</Body1>
                        {isOwned && (
                            <Badge size="small" appearance="outline" color="success">
                                {t("components.community_assistants.owned_assistant")}
                            </Badge>
                        )}
                        {isSubscribed && (
                            <Badge size="small" appearance="outline" color="success">
                                {t("components.community_assistants.subscribed_assistant")}
                            </Badge>
                        )}
                        {/* Tags */}
                        {assistant.tags && assistant.tags.length > 0 && (
                            <div className={styles.tagsContainer}>
                                {assistant.tags.slice(0, 3).map((tag, index) => (
                                    <Badge key={index} size="small" appearance="tint" color="informative">
                                        {tag}
                                    </Badge>
                                ))}
                                {assistant.tags.length > 3 && (
                                    <Badge size="small" appearance="tint" color="informative">
                                        +{assistant.tags.length - 3}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                </>
            }
            description={
                <Text size={200} className={styles.assistantDescription}>
                    {assistant.description.length > 100 ? `${assistant.description.substring(0, 100)}...` : assistant.description}
                </Text>
            }
        />
    );

    const footer = (
        <CardFooter>
            <div className={styles.assistantCardFooter}>
                {/* Tools */}
                {assistant.tools && assistant.tools.length > 0 && (
                    <>
                        <Text size={200} className={styles.footerText}>
                            {assistant.tools.length}{" "}
                            {assistant.tools.length === 1
                                ? t("components.community_assistants.tool_single")
                                : t("components.community_assistants.tools_plural")}
                        </Text>
                        <span className={styles.separator}>•</span>
                    </>
                )}

                {/* Departments */}
                {assistant.hierarchical_access && assistant.hierarchical_access.length > 0 ? (
                    <>
                        <Text size={200} className={styles.footerText}>
                            {assistant.hierarchical_access.length}{" "}
                            {assistant.hierarchical_access.length === 1
                                ? t("components.community_assistants.department_single")
                                : t("components.community_assistants.departments_plural")}
                        </Text>
                        <span className={styles.separator}>•</span>
                    </>
                ) : (
                    <>
                        <Text className={styles.footerText}>{t("components.community_assistants.public_access")}</Text>
                        <span className={styles.separator}>•</span>
                    </>
                )}

                {/* Subscriptions */}
                {subscriptions > 0 && (
                    <>
                        <Text size={200} className={styles.footerTextAccent}>
                            {subscriptions} {t("components.community_assistants.times_subscribed")}
                        </Text>
                        <span className={styles.separator}>•</span>
                    </>
                )}

                {/* Version */}
                <Text size={200} className={styles.footerTextVersion}>
                    v{assistant.version}
                </Text>
            </div>
        </CardFooter>
    );

    return (
        <BaseAssistantCard
            id={assistant.id ?? ""}
            className={styles.assistantCard}
            header={header}
            footer={footer}
            showDivider={true}
            showTooltip={false}
            onClick={handleClick}
        />
    );
};
