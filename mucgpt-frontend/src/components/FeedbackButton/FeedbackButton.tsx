import { Button } from "@fluentui/react-components";
import { Mail24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./FeedbackButton.module.css";

interface FeedbackButtonProps {
    contactMailUrl: string;
    subject?: string;
}

export const FeedbackButton = ({ contactMailUrl, subject = "Feedback" }: FeedbackButtonProps) => {
    const { t } = useTranslation();

    const mailtoLink = contactMailUrl.includes("subject=")
        ? contactMailUrl
        : `${contactMailUrl}${contactMailUrl.includes("?") ? "&" : "?"}subject=${encodeURIComponent(subject)}`;

    return (
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
    );
};

export default FeedbackButton;
