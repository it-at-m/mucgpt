import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    Button,
    Switch,
    Badge,
    Radio,
    RadioGroup,
    ProgressBar,
    Label,
    Tooltip
} from "@fluentui/react-components";
import { CheckmarkCircle20Filled, Warning20Filled, Dismiss24Regular, Delete20Regular, ArrowDownloadRegular } from "@fluentui/react-icons";
import { useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionSettingsContext } from "./TranscriptionSettingsContext";
import { TRANSCRIPTION_MODELS, orderModelsWithDefaultFirst } from "../../config/transcriptionModels";
import { supportsWebGPU } from "../../utils/webgpuSupport";
import styles from "./TranscriptionSettingsDialog.module.css";

/** Maps ISO codes to localized language names for the per-model hint. */
function localizedLanguages(t: (key: string) => string, languages: string[]): string {
    return languages.map(code => t(`components.transcriptionSettings.languages.${code}`)).join(", ");
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/** Settings dialog: enable transcription, pick a model, download it and inspect load state. */
export const TranscriptionSettingsDialog = ({ open, onOpenChange }: Props) => {
    const { t } = useTranslation();
    const {
        enabled,
        setEnabled,
        selectedModelId,
        setSelectedModelId,
        defaultModelId,
        downloadedModels,
        status,
        modelProgress,
        loadingModelId,
        downloadModel,
        deleteModel,
        clearModels,
        error
    } = useContext(TranscriptionSettingsContext);

    const [confirmClearOpen, setConfirmClearOpen] = useState(false);
    const isLoading = status === "loading-model";
    const isBusy = isLoading || status === "warming-up" || status === "recording" || status === "transcribing";
    const webgpuAvailable = useMemo(() => supportsWebGPU(), []);
    const orderedModels = useMemo(() => orderModelsWithDefaultFirst(TRANSCRIPTION_MODELS, defaultModelId), [defaultModelId]);

    /** Starts downloading (or re-downloading) the given model and selects it. Failures surface via the context. */
    const onDownloadModel = (modelId: string) => {
        setSelectedModelId(modelId);
        downloadModel(modelId).catch(() => {
            // error already surfaced via context
        });
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle
                        action={
                            <Button
                                appearance="subtle"
                                icon={<Dismiss24Regular />}
                                onClick={() => onOpenChange(false)}
                                aria-label={t("components.transcriptionSettings.close")}
                            />
                        }
                    >
                        <span className={styles.titleWithBadge}>
                            {t("components.transcriptionSettings.title")}
                            <Badge appearance="tint" color="warning">
                                {t("components.transcriptionSettings.beta")}
                            </Badge>
                        </span>
                    </DialogTitle>
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
                                <RadioGroup value={selectedModelId} onChange={(_, data) => setSelectedModelId(data.value)} disabled={!enabled}>
                                    {orderedModels.map(m => {
                                        const isDownloaded = downloadedModels.includes(m.model_id);
                                        const isRecommended = m.model_id === defaultModelId;
                                        return (
                                            <div key={m.model_id} className={styles.modelRow} onClick={() => enabled && setSelectedModelId(m.model_id)}>
                                                <Radio
                                                    value={m.model_id}
                                                    label={
                                                        <div className={styles.modelMeta}>
                                                            <span className={styles.modelLabel}>{m.label}</span>
                                                            {m.size_hint && <span className={styles.modelHint}>{m.size_hint}</span>}
                                                            {m.languages && (
                                                                <span className={styles.modelHint}>
                                                                    {t("components.transcriptionSettings.model_languages", {
                                                                        languages: localizedLanguages(t, m.languages)
                                                                    })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    }
                                                />
                                                <div className={styles.modelActions}>
                                                    {isRecommended && (
                                                        <Badge appearance="tint" color="brand">
                                                            {t("components.transcriptionSettings.recommended")}
                                                        </Badge>
                                                    )}
                                                    {isDownloaded && (
                                                        <Tooltip content={t("components.transcriptionSettings.model_ready")} relationship="label">
                                                            <Badge
                                                                appearance="tint"
                                                                color="success"
                                                                icon={<CheckmarkCircle20Filled />}
                                                                aria-label={t("components.transcriptionSettings.model_ready")}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    {isDownloaded ? (
                                                        <Tooltip content={t("components.transcriptionSettings.delete_model")} relationship="label">
                                                            <Button
                                                                appearance="subtle"
                                                                size="small"
                                                                icon={<Delete20Regular />}
                                                                aria-label={t("components.transcriptionSettings.delete_model")}
                                                                disabled={isBusy}
                                                                onClick={event => {
                                                                    event.stopPropagation();
                                                                    void deleteModel(m.model_id);
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    ) : (
                                                        <Tooltip content={t("components.transcriptionSettings.download")} relationship="label">
                                                            <Button
                                                                appearance="subtle"
                                                                size="small"
                                                                icon={<ArrowDownloadRegular />}
                                                                aria-label={t("components.transcriptionSettings.download")}
                                                                disabled={!enabled || isBusy}
                                                                onClick={event => {
                                                                    event.stopPropagation();
                                                                    onDownloadModel(m.model_id);
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </RadioGroup>
                            </div>
                            {downloadedModels.length > 0 &&
                                (confirmClearOpen ? (
                                    <div className={styles.confirmRow} role="alertdialog">
                                        <div className={styles.confirmText}>
                                            <span className={styles.confirmTitle}>{t("components.transcriptionSettings.clear_models_confirm_title")}</span>
                                            <span className={styles.modelHint}>{t("components.transcriptionSettings.clear_models_confirm_message")}</span>
                                        </div>
                                        <div className={styles.confirmActions}>
                                            <Button size="small" appearance="secondary" onClick={() => setConfirmClearOpen(false)}>
                                                {t("components.transcriptionSettings.cancel")}
                                            </Button>
                                            <Button
                                                size="small"
                                                appearance="primary"
                                                onClick={() => {
                                                    setConfirmClearOpen(false);
                                                    void clearModels();
                                                }}
                                            >
                                                {t("components.transcriptionSettings.confirm")}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button appearance="subtle" icon={<Delete20Regular />} disabled={isBusy} onClick={() => setConfirmClearOpen(true)}>
                                        {t("components.transcriptionSettings.clear_models")}
                                    </Button>
                                ))}
                        </div>

                        {((isLoading && loadingModelId === selectedModelId) || (error && status === "error")) && (
                            <div className={styles.section}>
                                {isLoading && loadingModelId === selectedModelId && (
                                    <ProgressBar className={styles.progress} value={modelProgress > 0 ? modelProgress / 100 : undefined} thickness="medium" />
                                )}
                                {error && status === "error" && <span className={styles.statusRow}>{error}</span>}
                            </div>
                        )}
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
