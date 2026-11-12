import { useEffect, useRef, useState } from "react";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { Info16Regular } from "@fluentui/react-icons";
import { ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./Answer.module.css";
import { useTranslation } from "react-i18next";
import { providerErrorCodeToI18nKey, type ChatProviderError } from "../../utils/providerError";
import { Button } from "../../ui/Button";

interface Props {
    error: ChatProviderError;
    onRetry?: () => void;
    retryUnavailableReason?: string;
}

export const AnswerError = ({ error, onRetry, retryUnavailableReason }: Props) => {
    const { t } = useTranslation();
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
    const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Keep the HTTP status available even when a plain error body carries no
    // status line, so the technical view stays usable for gateway failures.
    const statusLine = error.statusCode === null ? "" : `HTTP status: ${error.statusCode}`;
    const detail = [error.detail.trim(), statusLine].filter(Boolean).join("\n").trim();
    const hasDetails = detail.length > 0;

    const clearCopyResetTimer = () => {
        if (copyResetTimer.current) {
            clearTimeout(copyResetTimer.current);
            copyResetTimer.current = null;
        }
    };

    useEffect(() => clearCopyResetTimer, []);

    /** Copies the technical details and tracks success/failure for user feedback. */
    const copyDetails = async () => {
        clearCopyResetTimer();
        try {
            await navigator.clipboard.writeText(detail);
            setCopyStatus("copied");
            copyResetTimer.current = setTimeout(() => {
                copyResetTimer.current = null;
                setCopyStatus("idle");
            }, 1000);
        } catch {
            // Clipboard unavailable (e.g. insecure context); keep the dialog open.
            setCopyStatus("failed");
        }
    };

    return (
        <div className={styles.answerContainer}>
            <div className={styles.errorRow}>
                <ErrorCircle24Regular aria-hidden="true" aria-label="Error icon" primaryFill="var(--colorStatusDangerForeground1)" />

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
                <Dialog
                    open={detailsOpen}
                    onOpenChange={(_, data) => {
                        setDetailsOpen(data.open);
                        if (!data.open) {
                            clearCopyResetTimer();
                            setCopyStatus("idle");
                        }
                    }}
                >
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>{t("common.errors.provider.details_title")}</DialogTitle>
                            <DialogContent className={styles.errorDetailsContent}>
                                <pre className={styles.errorDetails}>{detail}</pre>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="primary" aria-live="polite" onClick={copyDetails}>
                                    {copyStatus === "copied"
                                        ? t("common.errors.provider.details_copied")
                                        : copyStatus === "failed"
                                          ? t("common.errors.provider.details_copy_failed")
                                          : t("common.errors.provider.copy_details")}
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
