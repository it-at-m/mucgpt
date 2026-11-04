import { Badge, Button, makeStyles, ProgressBar, tokens, typographyStyles } from "@fluentui/react-components";
import { Warning20Filled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useTranscription } from "../../hooks/useTranscription";
import { EdelweissSpinner } from "../EdelweissSpinner";

const useStyles = makeStyles({
    surface: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        width: "280px",
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`
    },
    modelRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalSNudge,
        ...typographyStyles.body1Strong
    },
    // Match the model picker's secondary facts typography.
    meta: {
        color: tokens.colorNeutralForeground3,
        ...typographyStyles.caption1
    },
    statusRow: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalSNudge,
        ...typographyStyles.caption1
    },
    progress: {
        flex: 1
    },
    warning: {
        display: "flex",
        alignItems: "flex-start",
        gap: tokens.spacingHorizontalSNudge,
        ...typographyStyles.caption1,
        color: tokens.colorStatusWarningForeground1,
        backgroundColor: tokens.colorStatusWarningBackground1,
        borderRadius: tokens.borderRadiusMedium,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`
    },
    error: {
        ...typographyStyles.caption1,
        color: tokens.colorStatusDangerForeground1
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: tokens.spacingHorizontalS,
        justifyContent: "flex-end"
    }
});

/**
 * Trimmed model panel of the transcription popover: the deployment-configured
 * model (name, size, one-line status) and the state-specific actions only —
 * deliberately matching the restraint of the LLM model picker's details panel.
 */
export const TranscriptionModelContent = () => {
    const { model, modelState, modelProgress, downloadedBytes, totalBytes, error, downloadModel, retryModelLoad, redownloadModel, cancelDownload } =
        useTranscription();
    const { t } = useTranslation();
    const styles = useStyles();

    if (!model) return null;

    const isDownloading = modelState === "downloading";
    const isLoading = modelState === "loading";
    const showProgress = (isDownloading || isLoading) && modelProgress > 0;

    const onDownload = () => downloadModel().catch(() => undefined);
    const onRetry = () => {
        retryModelLoad();
    };
    const onRedownload = () => redownloadModel().catch(() => undefined);

    return (
        <div className={styles.surface}>
            <span className={styles.modelRow}>
                {model.label}
                <Badge appearance="tint" color="warning">
                    {t("components.transcription.beta")}
                </Badge>
            </span>
            {model.size_hint && <span className={styles.meta}>{t("components.transcription.size_hint", { size: model.size_hint })}</span>}

            {showProgress && <ProgressBar className={styles.progress} value={modelProgress / 100} thickness="medium" />}

            {isDownloading && (
                <span className={styles.statusRow}>
                    {t("components.transcription.downloading", {
                        progress: modelProgress,
                        mb: downloadedBytes && totalBytes ? ` · ${downloadedBytes} / ${totalBytes} MB` : ""
                    })}
                </span>
            )}
            {isLoading && (
                <span className={styles.statusRow}>
                    <EdelweissSpinner size="tiny" />
                    {t("components.transcription.loading")}
                </span>
            )}

            {modelState === "missing" && <span className={styles.meta}>{t("components.transcription.not_downloaded_hint")}</span>}

            {modelState === "unverified" && (
                <span className={styles.error} role="alert">
                    {error ?? t("components.transcription.unverified")}
                </span>
            )}

            {modelState === "unsupported" && (
                <span className={styles.warning} role="alert">
                    <Warning20Filled aria-hidden />
                    <span>{t("components.transcription.webgpu_warning")}</span>
                </span>
            )}

            <div className={styles.actions}>
                {isDownloading ? (
                    <Button appearance="subtle" size="small" onClick={() => cancelDownload()}>
                        {t("components.transcription.cancel_download")}
                    </Button>
                ) : (
                    <>
                        {modelState === "unverified" && (
                            <Button appearance="subtle" size="small" disabled={isLoading} onClick={onRedownload}>
                                {t("components.transcription.redownload")}
                            </Button>
                        )}
                        {(modelState === "missing" || modelState === "unverified") && (
                            <Button appearance="primary" size="small" disabled={isLoading} onClick={modelState === "unverified" ? onRetry : onDownload}>
                                {modelState === "unverified" ? t("components.transcription.retry") : t("components.transcription.download")}
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TranscriptionModelContent;
