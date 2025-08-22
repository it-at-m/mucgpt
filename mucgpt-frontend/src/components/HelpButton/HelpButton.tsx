import { Tooltip } from "@fluentui/react-components";
import { QuestionCircle24Regular } from "@fluentui/react-icons";
import styles from "./HelpButton.module.css";
import { useTranslation } from "react-i18next";

interface HelpButtonProps {
    url: string;
    label?: string;
}

export const HelpButton = ({ url, label }: HelpButtonProps) => {
    const { t } = useTranslation();

    const helpLabel = label || t("components.helpbutton.label", "Hilfe & FAQ");

    return (
        <Tooltip content={t("components.helpbutton.tooltip", "Hilfe und häufig gestellte Fragen")} relationship="description" positioning="below">
            <div className={styles.container}>
                <a href={url} className={styles.buttonContainer} aria-label={t("components.helpbutton.aria_label", "Hilfe und FAQ öffnen")}>
                    <QuestionCircle24Regular className={styles.helpIcon} aria-hidden />
                    <span className={styles.helpText}>{helpLabel}</span>
                </a>
            </div>
        </Tooltip>
    );
};

export default HelpButton;
