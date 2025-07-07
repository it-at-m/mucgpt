import { BotAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./SearchCommunityBotButton.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
}

export const SearchCommunityBotButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content={t("components.search_bot_button.search_bots")} relationship="description" positioning="below">
                <Button
                    appearance="secondary"
                    aria-label={t("components.search_bot_button.search_bots")}
                    icon={<BotAdd24Regular className={styles.iconLeftMargin} />}
                    onClick={onClick}
                    size="large"
                >
                    {t("components.search_bot_button.search_bots")}
                </Button>
            </Tooltip>
        </div>
    );
};
