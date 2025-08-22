import { Tooltip } from "@fluentui/react-components";
import { Mail24Regular } from "@fluentui/react-icons";
import styles from "./FeedbackButton.module.css";
import { useTranslation } from "react-i18next";

interface FeedbackButtonProps {
    emailAddress: string;
    subject?: string;
}

export const FeedbackButton = ({ emailAddress, subject = "Feedback" }: FeedbackButtonProps) => {
    const { t } = useTranslation();

    const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}`;

    return (
        <Tooltip content={t("components.feedback.tooltip", "Send us your feedback")} relationship="description" positioning="below">
            <div className={styles.container}>
                <a href={mailtoLink} className={styles.buttonContainer} aria-label={t("components.feedback.aria_label", "Send feedback via email")}>
                    <Mail24Regular aria-hidden />
                    <span className={styles.feedbackText}>{t("components.feedback.label", "Feedback")}</span>
                </a>
            </div>
        </Tooltip>
    );
};

export default FeedbackButton;
