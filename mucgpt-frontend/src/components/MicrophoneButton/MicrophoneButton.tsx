import { Button, Tooltip, ProgressBar } from "@fluentui/react-components";
import { MicRegular, MicFilled } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useEffect, useRef } from "react";
import styles from "./MicrophoneButton.module.css";
import { useTranscription } from "../../hooks/useTranscription";
import { LanguageContext } from "../LanguageSelector/LanguageContextProvider";
import { mapUILanguageToWhisper } from "../../utils/language-utils";

interface Props {
    onTranscription: (text: string) => void;
    onLiveTranscription?: (text: string) => void;
    onRecordingStart?: () => void;
    disabled?: boolean;
}

export const MicrophoneButton = ({ onTranscription, onLiveTranscription, onRecordingStart, disabled = false }: Props) => {
    const { t } = useTranslation();
    const { language: uiLanguage } = useContext(LanguageContext);
    const { status, modelProgress, transcript, startRecording, stopAndTranscribe, setLanguage } = useTranscription();

    // Keep Whisper language in sync with the UI language picker
    useEffect(() => {
        setLanguage(mapUILanguageToWhisper(uiLanguage));
    }, [uiLanguage, setLanguage]);

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

    const isRecording = status === "recording";
    const isTranscribing = status === "transcribing";
    const isLoadingModel = status === "loading-model";
    const isBusy = isTranscribing || isLoadingModel;

    const getTooltipContent = () => {
        if (isLoadingModel) return `${t("components.microphonebutton.loading_model", "Modell wird geladen...")} ${modelProgress > 0 ? `${modelProgress}%` : ""}`;
        if (isRecording) return t("components.microphonebutton.stop", "Aufnahme beenden");
        if (isTranscribing) return t("components.microphonebutton.transcribing", "Transkribiere...");
        return t("components.microphonebutton.record", "Sprachaufnahme starten");
    };

    return (
        <div className={styles.wrapper}>
            {isLoadingModel && (
                <div className={styles.progressWrapper}>
                    <ProgressBar value={modelProgress > 0 ? modelProgress / 100 : undefined} thickness="medium" />
                </div>
            )}
            <Tooltip content={getTooltipContent()} relationship="label">
                <Button
                    size="large"
                    appearance="transparent"
                    className={`${styles.micButton} ${isRecording ? styles.recording : ""} ${isBusy ? styles.busy : ""}`}
                    icon={isRecording ? <MicFilled className={styles.recordingIcon} /> : <MicRegular />}
                    aria-label={getTooltipContent()}
                    disabled={disabled || isBusy}
                    onClick={handleClick}
                />
            </Tooltip>
            {isTranscribing && (
                <span className={styles.transcribingLabel}>{t("components.microphonebutton.transcribing", "Transkribiere...")}</span>
            )}
        </div>
    );
};
