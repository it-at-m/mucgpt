import { Text, Spinner } from "@fluentui/react-components";
import { Assistant } from "../../../api";
import { AssistantCard } from "./AssistantCard";
import { useTranslation } from "react-i18next";
import styles from "../CommunityAssistantDialog.module.css";

interface AssistantGridProps {
    assistants: Array<{ assistant: Assistant; updated: string; subscriptions: number }>;
    ownedAssistants: string[];
    subscribedAssistants: string[];
    isLoading: boolean;
    onAssistantClick: (assistant: Assistant) => void;
    choosenTag?: string;
}

export const AssistantGrid = ({ assistants, ownedAssistants, subscribedAssistants, isLoading, onAssistantClick, choosenTag = "" }: AssistantGridProps) => {
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <Spinner size="medium" />
                <Text>{t("components.community_assistants.loading_assistants")}</Text>
            </div>
        );
    }

    const filteredAssistants = assistants.filter(assistantObj => (choosenTag === "" ? true : assistantObj.assistant.tags?.includes(choosenTag)));

    if (filteredAssistants.length === 0) {
        return (
            <div className={styles.noResults}>
                <Text size={400}>{t("components.community_assistants.no_assistants_found")}</Text>
            </div>
        );
    }

    return (
        <div className={styles.assistantsGrid}>
            {filteredAssistants.map(assistantObj => (
                <AssistantCard
                    key={assistantObj.assistant.id ?? ""}
                    assistant={assistantObj.assistant}
                    subscriptions={assistantObj.subscriptions}
                    isOwned={ownedAssistants.includes(assistantObj.assistant.id ?? "")}
                    isSubscribed={subscribedAssistants.includes(assistantObj.assistant.id ?? "")}
                    onClick={onAssistantClick}
                />
            ))}
        </div>
    );
};
