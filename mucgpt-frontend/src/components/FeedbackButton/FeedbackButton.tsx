import { Button, Tooltip } from "@fluentui/react-components";
import { Mail24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./FeedbackButton.module.css";

interface FeedbackButtonProps {
    emailAddress: string;
    subject?: string;
}

export const FeedbackButton = ({ emailAddress, subject = "Feedback" }: FeedbackButtonProps) => {
    const { t } = useTranslation();

    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}`;

    return (
        <Tooltip content={t("components.feedback.tooltip", "Send us your feedback")} relationship="description" positioning="below">
            <Button
                as={"a"}
                href={mailtoLink}
                appearance={"subtle"}
                icon={<Mail24Regular className={styles.icon} />}
                aria-label={t("components.feedback.aria_label", "Send feedback via email")}
                className={styles.feedbackButton}
            >
                {t("components.feedback.label", "Feedback")}
            </Button>
        </Tooltip>
    );
};

export default FeedbackButton;
