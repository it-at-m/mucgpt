import styles from "./MicrophoneButton.module.css";
import { Popover, PopoverSurface, PopoverTrigger, Tooltip, mergeClasses } from "@fluentui/react-components";
import { MicOffRegular, MicRecordRegular, MicRegular, MicSyncRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { useTranscription, type TranscriptionModelState } from "../../hooks/useTranscription";
import { TranscriptionModelContent } from "../Transcription/TranscriptionModelContent";

interface Props {
    onTranscription: (text: string) => void;
    onLiveTranscription?: (text: string) => void;
    onRecordingStart?: () => void;
    disabled?: boolean;
}

/** States in which clicking the mic opens the model panel instead of recording. */
const PANEL_STATES: ReadonlySet<TranscriptionModelState> = new Set(["missing", "unverified", "unsupported"]);
/** Live model states; the panel stays open to show the ongoing progress. */
const PROGRESS_STATES: ReadonlySet<TranscriptionModelState> = new Set(["checking", "loading", "downloading"]);

export const MicrophoneButton = ({ onTranscription, onLiveTranscription, onRecordingStart, disabled = false }: Props) => {
    const { t } = useTranslation();
    const { status, modelState, modelProgress, transcript, startRecording, stopAndTranscribe } = useTranscription();
    const [panelOpen, setPanelOpen] = useState(false);

    // Keep the panel open while it shows live progress or an error with recovery
    // actions; only a finished (and therefore clickable-again) mic closes it.
    useEffect(() => {
        if (modelState === "ready") setPanelOpen(false);
    }, [modelState]);

    // Forward interim transcript to input while recording
    useEffect(() => {
        if (status === "recording" && transcript) {
            onLiveTranscription?.(transcript);
        }
    }, [transcript, status, onLiveTranscription]);

    // Forward final transcript when recording is done
    const lastForwardedRef = useRef("");
    const prevStatusRef = useRef(status);
    useEffect(() => {
        if (prevStatusRef.current !== "idle" && status === "idle" && transcript && transcript !== lastForwardedRef.current) {
            lastForwardedRef.current = transcript;
            onTranscription(transcript);
        }
        prevStatusRef.current = status;
    }, [status, transcript, onTranscription]);

    useEffect(() => {
        if (status === "recording") lastForwardedRef.current = "";
    }, [status]);

    const handleClick = useCallback(async () => {
        if (status === "idle" || status === "error") {
            onRecordingStart?.();
            try {
                await startRecording();
            } catch (error) {
                console.error("Failed to start recording:", error);
            }
        } else if (status === "recording") {
            try {
                await stopAndTranscribe();
            } catch (error) {
                console.error("Failed to stop and transcribe recording:", error);
            }
        }
    }, [status, startRecording, stopAndTranscribe, onRecordingStart]);

    const opensPanel = PANEL_STATES.has(modelState);
    // In panel states the click action is the panel itself, so the button stays
    // enabled (greyed-out styling communicates "not usable for recording");
    // otherwise it follows the recording lifecycle and the input's disabled state.
    const buttonDisabled = disabled || (!opensPanel && (status === "transcribing" || PROGRESS_STATES.has(modelState)));

    const getIcon = () => {
        if (opensPanel) return <MicOffRegular />;
        if (PROGRESS_STATES.has(modelState) || status === "transcribing") return <MicSyncRegular />;
        if (status === "recording") return <MicRecordRegular />;
        return <MicRegular />;
    };

    const getTooltipContent = () => {
        if (PROGRESS_STATES.has(modelState)) return `${t("components.microphonebutton.loading_model")} ${modelProgress > 0 ? `${modelProgress}%` : ""}`;
        if (opensPanel) return t("components.transcription.setup_tooltip");
        if (status === "recording") return t("components.microphonebutton.stop");
        return t("components.microphonebutton.record");
    };

    const buttonClass = mergeClasses(styles.micButton, (PROGRESS_STATES.has(modelState) || status === "transcribing") && styles.busy);
    const buttonTone = opensPanel ? "muted" : undefined;

    return (
        <div className={styles.wrapper}>
            {opensPanel ? (
                <Popover open={panelOpen} onOpenChange={(_, data) => setPanelOpen(data.open)}>
                    <PopoverTrigger disableButtonEnhancement>
                        <Tooltip positioning={"below"} content={getTooltipContent()} relationship="label">
                            <Button
                                appearance="subtle"
                                tone={buttonTone}
                                className={buttonClass}
                                icon={getIcon()}
                                aria-label={getTooltipContent()}
                                disabled={buttonDisabled}
                            />
                        </Tooltip>
                    </PopoverTrigger>
                    <PopoverSurface>
                        <TranscriptionModelContent />
                    </PopoverSurface>
                </Popover>
            ) : (
                <Tooltip positioning={"below"} content={getTooltipContent()} relationship="label">
                    <Button
                        appearance="subtle"
                        tone={buttonTone}
                        className={buttonClass}
                        icon={getIcon()}
                        aria-label={getTooltipContent()}
                        disabled={buttonDisabled}
                        onClick={() => {
                            void handleClick();
                        }}
                    />
                </Tooltip>
            )}
        </div>
    );
};
