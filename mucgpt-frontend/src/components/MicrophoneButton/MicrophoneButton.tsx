import { Button, Tooltip } from "@fluentui/react-components";
import { MicRegular, MicRecordRegular, MicSyncRegular, MicOffRegular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef } from "react";
import styles from "./MicrophoneButton.module.css";
import { useTranscription } from "../../hooks/useTranscription";

interface Props {
    onTranscription: (text: string) => void;
    onLiveTranscription?: (text: string) => void;
    onRecordingStart?: () => void;
    disabled?: boolean;
}

export const MicrophoneButton = ({ onTranscription, onLiveTranscription, onRecordingStart, disabled = false }: Props) => {
    const { t } = useTranslation();
    const { status, modelProgress, transcript, startRecording, stopAndTranscribe } = useTranscription();

    // Forward interim transcript to input while recording
    useEffect(() => {
        if (status === "recording" && transcript) {
            onLiveTranscription?.(transcript);
        }
    }, [transcript, status, onLiveTranscription]);

    // Forward final transcript when recording is done
    const lastForwardedRef = useRef("");
    useEffect(() => {
        if (status === "idle" && transcript && transcript !== lastForwardedRef.current) {
            lastForwardedRef.current = transcript;
            onTranscription(transcript);
        }
    }, [status, transcript, onTranscription]);

    useEffect(() => {
        if (status === "recording") lastForwardedRef.current = "";
    }, [status]);

    const handleClick = useCallback(async () => {
        if (status === "idle" || status === "error") {
            onRecordingStart?.();
            await startRecording();
        } else if (status === "recording") {
            await stopAndTranscribe();
        }
    }, [status, startRecording, stopAndTranscribe, onRecordingStart]);

    const isLoadingModel = status === "loading-model";
    const isWarmingUp = status === "warming-up";
    const isModelLoading = isLoadingModel || isWarmingUp;
    const isRecording = status === "recording";
    const isBusy = status === "transcribing" || isModelLoading;

    const getIcon = () => {
        if (disabled) return <MicOffRegular />;
        if (isModelLoading || isBusy) return <MicSyncRegular />;
        if (isRecording) return <MicRecordRegular />;
        return <MicRegular />;
    };

    const getTooltipContent = () => {
        if (isModelLoading)
            return `${t("components.microphonebutton.loading_model", "Modell wird geladen...")} ${modelProgress > 0 ? `${modelProgress}%` : ""}`;
        if (isRecording) return t("components.microphonebutton.stop", "Aufnahme beenden");
        return t("components.microphonebutton.record", "Sprachaufnahme starten");
    };

    return (
        <div className={styles.wrapper}>
            <Tooltip content={getTooltipContent()} relationship="label">
                <Button
                    size="large"
                    appearance="transparent"
                    className={`${styles.micButton} ${isBusy ? styles.busy : ""}`}
                    icon={getIcon()}
                    aria-label={getTooltipContent()}
                    disabled={disabled || isBusy}
                    onClick={handleClick}
                />
            </Tooltip>
        </div>
    );
};
