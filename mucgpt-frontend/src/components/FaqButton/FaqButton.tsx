import { Button } from "@fluentui/react-components";
import { QuestionCircle24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./FaqButton.module.css";

interface FaqButtonProps {
    url: string;
    label?: string;
}

export const FaqButton = ({ url, label }: FaqButtonProps) => {
    const { t } = useTranslation();

    const faqLabel = label || t("components.faqbutton.label", "Fragen & Antworten");

    return (
        <Button
            as={"a"}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            appearance={"subtle"}
            icon={<QuestionCircle24Regular className={styles.icon} />}
            aria-label={t("components.faqbutton.aria_label", "Fragen und Antworten öffnen")}
            className={styles.faqButton}
        >
            {faqLabel}
        </Button>
    );
};

export default FaqButton;
