import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./ChatUsageMessageBar.module.css";

interface Props {
    onDismiss: () => void;
    onStartNewChat: () => void;
}

export const ChatUsageMessageBar = ({ onDismiss, onStartNewChat }: Props) => {
    const { t } = useTranslation();

    return (
        <MessageBar intent="warning" className={styles.messageBar}>
            <MessageBarBody>
                <div className={styles.messageContent}>
                    <MessageBarTitle>{t("chat.usage_warning_title")}</MessageBarTitle>
                    <span className={styles.messageDescription}>{t("chat.usage_warning_description")}</span>
                </div>
            </MessageBarBody>
            <MessageBarActions
                className={styles.actions}
                containerAction={<Button appearance="subtle" icon={<Dismiss20Regular />} onClick={onDismiss} aria-label={t("chat.usage_dismiss_warning")} />}
            >
                <Button appearance="primary" onClick={onStartNewChat}>
                    {t("chat.usage_start_new_chat")}
                </Button>
            </MessageBarActions>
        </MessageBar>
    );
};
