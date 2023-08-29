import { Stack, PrimaryButton } from "@fluentui/react";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./Answer.module.css";
import { useTranslation } from 'react-i18next';


interface Props {
    error: string;
    onRetry: () => void;
}

export const AnswerError = ({ error, onRetry }: Props) => {
    const { t} = useTranslation ();
    return (
        <Stack className={styles.answerContainer} verticalAlign="space-between">
            <ErrorCircle24Regular aria-hidden="true" aria-label="Error icon" primaryFill="red" />

            <Stack.Item grow>
                <p className={styles.answerText}>{error}</p>
            </Stack.Item>

            <PrimaryButton className={styles.retryButton} onClick={onRetry} text={t('components.answererror.retry')} />
        </Stack>
    );
};
