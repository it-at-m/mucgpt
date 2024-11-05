import { ChatSettings24Regular, ChatWarning24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./ChatSettingsButton.module.css";
import { useTranslation } from 'react-i18next';
interface Props {
    isEmptySystemPrompt: boolean;
    onClick: () => void
}

export const ChatSettingsButton = ({ isEmptySystemPrompt, onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            {isEmptySystemPrompt ?
                <Tooltip content={t('components.chattsettingsdrawer.settings_button')} relationship="description" positioning="below">
                    <Button aria-label={t('components.chattsettingsdrawer.settings_button')} icon={< ChatSettings24Regular />} appearance="subtle" onClick={onClick} size="large">
                    </Button>
                </Tooltip>
                :
                <Tooltip content={t('components.chattsettingsdrawer.settings_button_system_prompt')} relationship="description" positioning="below">
                    <Button aria-label={t('components.chattsettingsdrawer.settings_button_system_prompt')} icon={<ChatWarning24Regular className={styles.system_prompt_warining_icon} />} appearance="subtle" onClick={onClick} size="large">
                    </Button>
                </Tooltip>
            }
        </div>
    );
};
