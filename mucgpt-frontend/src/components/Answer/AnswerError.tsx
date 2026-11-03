import { Button } from "@fluentui/react-components";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./Answer.module.css";
import { useTranslation } from "react-i18next";

interface Props {
    error: string;
    onRetry?: () => void;
    retryUnavailableReason?: string;
}

export const AnswerError = ({ error, onRetry, retryUnavailableReason }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.answerContainer}>
            <div className={styles.errorRow}>
                <ErrorCircle24Regular aria-hidden="true" aria-label="Error icon" primaryFill="red" />

                <div className={styles.growItem}>
                    <p className={styles.answerText}>{error}</p>
                </div>
            </div>

            {onRetry ? (
                <Button appearance="primary" onClick={onRetry}>
                    {t("components.answererror.retry")}
                </Button>
            ) : (
                retryUnavailableReason && <p className={styles.answerText}>{retryUnavailableReason}</p>
            )}
        </div>
    );
};
