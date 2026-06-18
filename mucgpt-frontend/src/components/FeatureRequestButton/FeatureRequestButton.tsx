import { Button } from "@fluentui/react-components";
import { Lightbulb24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./FeatureRequestButton.module.css";

interface FeatureRequestButtonProps {
    url: string;
}

export const FeatureRequestButton = ({ url }: FeatureRequestButtonProps) => {
    const { t } = useTranslation();

    return (
        <Button
            as={"a"}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            appearance={"subtle"}
            icon={<Lightbulb24Regular className={styles.icon} />}
            aria-label={t("components.feature_request_button.aria_label", "Verbesserungswunsch vorschlagen")}
            className={styles.incidentReportButton}
        >
            {t("components.feature_request_button.label", "Verbesserungswunsch vorschlagen")}
        </Button>
    );
};

export default FeatureRequestButton;