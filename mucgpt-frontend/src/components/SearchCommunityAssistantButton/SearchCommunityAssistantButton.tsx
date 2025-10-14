import { Search24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./SearchCommunityAssistantButton.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
}

export const SearchCommunityAssistantButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content={t("components.search_assistant_button.search_assistants")} relationship="description" positioning="below">
                <Button
                    appearance="secondary"
                    aria-label={t("components.search_assistant_button.search_assistants")}
                    icon={<Search24Regular className={styles.iconLeftMargin} />}
                    onClick={onClick}
                    size="large"
                >
                    {t("components.search_assistant_button.search_assistants")}
                </Button>
            </Tooltip>
        </div>
    );
};
