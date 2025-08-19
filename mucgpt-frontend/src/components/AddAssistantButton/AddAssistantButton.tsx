import { BotAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./AddAssistantButton.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
}

export const AddAssistantButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content={t("components.add_assistant_button.add_assistant")} relationship="description" positioning="below">
                <Button
                    appearance="secondary"
                    aria-label={t("components.add_assistant_button.add_assistant")}
                    icon={<BotAdd24Regular className={styles.iconLeftMargin} />}
                    onClick={onClick}
                    size="large"
                >
                    {t("components.add_assistant_button.add_assistant")}
                </Button>
            </Tooltip>
        </div>
    );
};
