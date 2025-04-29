import { ChatAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./ClearChatButton.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
    disabled?: boolean;
    showText?: boolean;
}

export const ClearChatButton = ({ disabled, onClick, showText = true }: Props) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t("common.clear_chat")} relationship="description" positioning="below">
            <Button
                appearance="primary"
                aria-label={t("common.clear_chat")}
                icon={<ChatAdd24Regular className={styles.iconRightMargin} />}
                disabled={disabled}
                onClick={onClick}
            >
                {showText && t("common.clear_chat")}
            </Button>
        </Tooltip>
    );
};
