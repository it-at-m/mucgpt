import { BotAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./AddBotButton.module.css";
import { useTranslation } from 'react-i18next';
interface Props {
    onClick: () => void;
}

export const AddBotButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content={t('components.add_bot_button.add_bot')} relationship="description" positioning="below">
                <Button appearance="secondary" aria-label={t('components.add_bot_button.add_bot')} icon={<BotAdd24Regular className={styles.iconLeftMargin} />} onClick={onClick} size="large">
                </Button>
            </Tooltip>
        </div >
    );
};
