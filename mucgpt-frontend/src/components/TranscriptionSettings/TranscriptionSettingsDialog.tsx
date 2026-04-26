import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Switch,
    Badge,
    Radio,
    RadioGroup,
    ProgressBar,
    Label
} from "@fluentui/react-components";
import { Dismiss24Regular, CheckmarkCircle20Filled, Warning20Filled } from "@fluentui/react-icons";
import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionSettingsContext } from "./TranscriptionSettingsContext";
import { TRANSCRIPTION_MODELS } from "../../config/transcriptionModels";
import { supportsWebGPU } from "../../utils/webgpuSupport";
import styles from "./TranscriptionSettingsDialog.module.css";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const TranscriptionSettingsDialog = ({ open, onOpenChange }: Props) => {
    const { t } = useTranslation();
    const {
        enabled,
        setEnabled,
        selectedModelId,
        setSelectedModelId,
        downloadedModels,
        status,
        modelProgress,
        downloadedBytes,
        totalBytes,
        loadingModelId,
        downloadModel,
        error
    } = useContext(TranscriptionSettingsContext);

    const selectedIsDownloaded = downloadedModels.includes(selectedModelId);
    const isLoading = status === "loading-model";
    const webgpuAvailable = useMemo(() => supportsWebGPU(), []);

    const statusLabel = (() => {
        if (isLoading && loadingModelId === selectedModelId) {
            if (modelProgress > 0) {
                if (totalBytes > 0) {
                    return t("components.transcriptionSettings.status_loading_mb", {
                        progress: modelProgress,
                        downloaded_mb: downloadedBytes,
                        total_mb: totalBytes
                    });
                }
                return t("components.transcriptionSettings.status_loading", { progress: modelProgress });
            }
            return t("components.transcriptionSettings.status_loading_indeterminate");
        }
        if (selectedIsDownloaded) return t("components.transcriptionSettings.status_ready");
        return t("components.transcriptionSettings.status_idle");
    })();

    const onDownload = () => {
        downloadModel(selectedModelId).catch(() => {
            // error already surfaced via context
        });
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
            <DialogSurface>
                <DialogBody>
                    <div className={styles.header}>
                        <div className={styles.titleRow}>
                            <DialogTitle>{t("components.transcriptionSettings.title")}</DialogTitle>
                            <Badge appearance="tint" color="warning">
                                {t("components.transcriptionSettings.beta")}
                            </Badge>
                        </div>
                        <Button
                            appearance="subtle"
                            icon={<Dismiss24Regular />}
                            onClick={() => onOpenChange(false)}
                            aria-label={t("components.transcriptionSettings.close")}
                        />
                    </div>
                    <DialogContent className={styles.content}>
                        <div className={styles.disclaimer}>{t("components.transcriptionSettings.disclaimer")}</div>

                        {!webgpuAvailable && (
                            <div className={styles.warning} role="alert">
                                <Warning20Filled className={styles.warningIcon} />
                                <span>{t("components.transcriptionSettings.webgpu_warning")}</span>
                            </div>
                        )}

                        <div className={styles.section}>
                            <Switch
                                checked={enabled}
                                onChange={(_, data) => setEnabled(data.checked)}
                                label={t("components.transcriptionSettings.enable_label")}
                            />
                            <span className={styles.modelHint}>{t("components.transcriptionSettings.enable_hint")}</span>
                        </div>

                        <div className={styles.section}>
                            <Label>{t("components.transcriptionSettings.model_label")}</Label>
                            <div className={styles.modelList}>
                                <RadioGroup
                                    value={selectedModelId}
                                    onChange={(_, data) => setSelectedModelId(data.value)}
                                    disabled={!enabled}
                                >
                                    {TRANSCRIPTION_MODELS.map(m => {
                                        const isDownloaded = downloadedModels.includes(m.model_id);
                                        return (
                                            <div key={m.model_id} className={styles.modelRow}>
                                                <Radio
                                                    value={m.model_id}
                                                    label={
                                                        <div className={styles.modelMeta}>
                                                            <span className={styles.modelLabel}>{m.label}</span>
                                                            {m.size_hint && <span className={styles.modelHint}>{m.size_hint}</span>}
                                                        </div>
                                                    }
                                                />
                                                {isDownloaded && (
                                                    <Badge appearance="tint" color="success" icon={<CheckmarkCircle20Filled />}>
                                                        {t("components.transcriptionSettings.model_ready")}
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.downloadRow}>
                                <Button appearance="primary" disabled={!enabled || isLoading} onClick={onDownload}>
                                    {selectedIsDownloaded
                                        ? t("components.transcriptionSettings.redownload")
                                        : t("components.transcriptionSettings.download")}
                                </Button>
                                <span className={styles.statusRow}>{statusLabel}</span>
                            </div>
                            {isLoading && loadingModelId === selectedModelId && (
                                <ProgressBar
                                    className={styles.progress}
                                    value={modelProgress > 0 ? modelProgress / 100 : undefined}
                                    thickness="medium"
                                />
                            )}
                            {error && status === "error" && <span className={styles.statusRow}>{error}</span>}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={() => onOpenChange(false)}>
                            {t("components.transcriptionSettings.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
