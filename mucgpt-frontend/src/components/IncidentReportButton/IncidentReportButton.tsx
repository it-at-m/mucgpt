import { Button } from "@fluentui/react-components";
import { Warning24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./IncidentReportButton.module.css";

interface IncidentReportButtonProps {
    url: string;
}

export const IncidentReportButton = ({ url }: IncidentReportButtonProps) => {
    const { t } = useTranslation();

    return (
        <Button
            as={"a"}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            appearance={"subtle"}
            icon={<Warning24Regular className={styles.icon} />}
            aria-label={t("components.incident_report_button.aria_label", "Störung melden")}
            className={styles.incidentReportButton}
        >
            {t("components.incident_report_button.label", "Störung melden")}
        </Button>
    );
};

export default IncidentReportButton;
