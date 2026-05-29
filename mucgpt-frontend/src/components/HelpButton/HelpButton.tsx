import { Button } from "@fluentui/react-components";
import { QuestionCircle24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./HelpButton.module.css";

interface HelpButtonProps {
    url: string;
    label?: string;
}

export const HelpButton = ({ url, label }: HelpButtonProps) => {
    const { t } = useTranslation();

    const helpLabel = label || t("components.helpbutton.label", "Hilfe & FAQ");

    return (
        <Button
            as={"a"}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            appearance={"subtle"}
            icon={<QuestionCircle24Regular className={styles.icon} />}
            aria-label={t("components.helpbutton.aria_label", "Hilfe und FAQ öffnen")}
            className={styles.helpButton}
        >
            {helpLabel}
        </Button>
    );
};

export default HelpButton;
