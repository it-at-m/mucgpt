import { useTranslation } from "react-i18next";
import { Text } from "@fluentui/react-components";
import { ShieldError24Regular } from "@fluentui/react-icons";

import styles from "./HighRiskTutorial.module.css";

// Placeholder tutorial page. Content will be added later – for now only the basic scaffold is provided.
export const HighRiskTutorial = () => {
    const { t } = useTranslation();

    return (
        <div className={styles.tutorial}>
            <div className={styles.header}>
                <ShieldError24Regular className={styles.headerIcon} />
                <Text as="h3" size={500} weight="semibold">
                    {t("tutorials.high_risk.intro.title", "Hochrisiko-Anwendungsfälle")}
                </Text>
            </div>
            <Text as="p" className={styles.description}>
                {t("tutorials.high_risk.intro.description", "Hier erfahren Sie mehr über Hochrisiko-Anwendungsfälle.")}
            </Text>
        </div>
    );
};

export default HighRiskTutorial;
