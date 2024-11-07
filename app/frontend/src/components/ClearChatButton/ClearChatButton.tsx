import { ChatAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./ClearChatButton.module.css";
import { useTranslation } from 'react-i18next';
interface Props {
    onClick: () => void;
    disabled?: boolean;
}

export const ClearChatButton = ({ disabled, onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content={t('common.clear_chat')} relationship="description" positioning="below">
                <Button appearance="secondary" aria-label={t('common.clear_chat')} icon={<ChatAdd24Regular className={styles.iconRightMargin} />} disabled={disabled} onClick={onClick} size="large">
                </Button>
            </Tooltip>
        </div >
    );
};
