import { Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { DeleteArrowBackRegular } from "@fluentui/react-icons";

import styles from "./UserChatMessage.module.css";

interface Props {
    onRollback: () => void;
}

export const RollBackMessage = ({ onRollback: deleteMessageCallBack }: Props) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t("components.deleteMessage.label")} relationship="description" positioning="above">
            <Button
                onClick={deleteMessageCallBack}
                appearance="subtle"
                aria-label={t("components.deleteMessage.label")}
                icon={<DeleteArrowBackRegular className={styles.iconRightMargin} />}
                size="large"
            />
        </Tooltip>
    );
};
