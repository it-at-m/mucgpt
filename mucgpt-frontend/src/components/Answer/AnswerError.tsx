import { useState } from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./Answer.module.css";
import { useTranslation } from "react-i18next";
import { providerErrorCodeToI18nKey, type ChatProviderError } from "../../utils/providerError";

interface Props {
    error: ChatProviderError;
    onRetry?: () => void;
    retryUnavailableReason?: string;
}

export const AnswerError = ({ error, onRetry, retryUnavailableReason }: Props) => {
    const { t } = useTranslation();
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const detail = error.detail.trim();
    const hasDetails = detail.length > 0;

    const copyDetails = async () => {
        try {
            await navigator.clipboard.writeText(detail);
            setCopied(true);
            setTimeout(() => setCopied(false), 1000);
        } catch {
            // Clipboard unavailable (e.g. insecure context); keep the dialog open.
        }
    };

    return (
        <div className={styles.answerContainer}>
            <div className={styles.errorRow}>
                <ErrorCircle24Regular aria-hidden="true" aria-label="Error icon" primaryFill="red" />

                <div className={styles.growItem}>
                    <p className={styles.answerText}>{t(providerErrorCodeToI18nKey(error.code))}</p>
                    {hasDetails && (
                        <Button
                            appearance="subtle"
                            size="small"
                            icon={<Info16Regular aria-hidden />}
                            className={styles.errorDetailsButton}
                            onClick={() => setDetailsOpen(true)}
                        >
                            {t("common.errors.provider.details")}
                        </Button>
                    )}
                </div>
            </div>

            {hasDetails && (
                <Dialog open={detailsOpen} onOpenChange={(_, data) => setDetailsOpen(data.open)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>{t("common.errors.provider.details_title")}</DialogTitle>
                            <DialogContent className={styles.errorDetailsContent}>
                                <pre className={styles.errorDetails}>{detail}</pre>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="primary" onClick={copyDetails}>
                                    {copied ? t("common.errors.provider.details_copied") : t("common.errors.provider.copy_details")}
                                </Button>
                                <Button appearance="secondary" onClick={() => setDetailsOpen(false)}>
                                    {t("common.errors.provider.close_details")}
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

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
