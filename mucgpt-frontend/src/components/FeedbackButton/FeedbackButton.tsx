import { Button, Tooltip } from "@fluentui/react-components";
import { Mail24Regular } from "@fluentui/react-icons";
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
            <a href={mailtoLink}>
                <Button appearance={"subtle"} icon={<Mail24Regular />} aria-label={t("components.feedback.aria_label", "Send feedback via email")}>
                    {t("components.feedback.label", "Feedback")}
                </Button>
            </a>
        </Tooltip>
    );
};

export default FeedbackButton;
