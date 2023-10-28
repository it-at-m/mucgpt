import { Delete24Regular } from "@fluentui/react-icons";
import { Button } from "@fluentui/react-components";

import styles from "./ClearChatButton.module.css";
import { useTranslation } from 'react-i18next';
interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
}

export const ClearChatButton = ({ className, disabled, onClick }: Props) => {
    const { t} = useTranslation ();
    return (
        <div className={`${styles.container} ${className ?? ""}`}>
            <Button icon={<Delete24Regular />} disabled={disabled} onClick={onClick}>
                {t('common.clear_chat')}
            </Button>
        </div>
    );
};
