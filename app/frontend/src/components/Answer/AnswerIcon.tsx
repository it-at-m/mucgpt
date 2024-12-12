import { Tooltip } from "@fluentui/react-components";
import { BrainCircuit24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

export const AnswerIcon = () => {
    const { t, i18n } = useTranslation();
    return (
        <Tooltip content={t("components.answericon.label")} relationship="description" positioning="above">
            <BrainCircuit24Regular aria-hidden="true" aria-label={t("components.answericon.label")} />
        </Tooltip>
    );
};
