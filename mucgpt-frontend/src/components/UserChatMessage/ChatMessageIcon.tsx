import { Tooltip } from "@fluentui/react-components";
import { PersonChat24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

export const ChatMessageIcon = () => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t("components.usericon.label")} relationship="description" positioning="above">
            <PersonChat24Regular aria-hidden="true" aria-label={t("components.usericon.label")} />
        </Tooltip>
    );
};
