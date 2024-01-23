import { Delete24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./ClearChatButton.module.css";
import { useTranslation } from 'react-i18next';
interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ClearChatButton = ({ className, disabled, onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <Tooltip content={t('common.clear_chat')} relationship="description" positioning="below">
                <Button appearance="secondary" aria-label={t('common.clear_chat')} icon={<Delete24Regular className={styles.iconRightMargin} />} disabled={disabled} onClick={onClick} size="large">
                </Button>
            </Tooltip>
        </div >
    );
};
