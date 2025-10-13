import { Button, Tooltip } from "@fluentui/react-components";
import { QuestionCircle24Regular } from "@fluentui/react-icons";
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
            <Button as={"a"} href={url} appearance={"subtle"} icon={<QuestionCircle24Regular />} aria-label={t("components.helpbutton.aria_label", "Hilfe und FAQ öffnen")}>
                {helpLabel}
            </Button>
        </Tooltip>
    );
};

export default HelpButton;
