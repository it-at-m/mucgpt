import { Add24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
}

export const AddAssistantButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t("components.add_assistant_button.add_assistant")} relationship="description" positioning="below">
            <Button appearance="primary" aria-label={t("components.add_assistant_button.add_assistant")} icon={<Add24Regular />} onClick={onClick}>
                {t("components.add_assistant_button.add_assistant")}
            </Button>
        </Tooltip>
    );
};
