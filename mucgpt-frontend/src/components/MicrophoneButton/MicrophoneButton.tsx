import { Popover, PopoverSurface, PopoverTrigger, Tooltip, mergeClasses, makeStyles, tokens, type PositioningProps } from "@fluentui/react-components";
import { MicOffRegular, MicRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./MicrophoneButton.module.css";
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

// Mirrors the LLMSelector trigger so the muted setup mic recedes exactly like
// the model picker next to it instead of competing with the input.
const useStyles = makeStyles({
    trigger: {
        color: tokens.colorNeutralForeground3
    }
});

// Anchor/alignment identical to the model picker's popover: right-aligned to the
// trigger with a small offset and a viewport gutter.
const POPOVER_POSITIONING: PositioningProps = {
    position: "above",
    align: "end",
    offset: 8,
    overflowBoundaryPadding: 16
};

export const MicrophoneButton = ({ onTranscription, onLiveTranscription, onRecordingStart, disabled = false }: Props) => {
    const { t } = useTranslation();
    const { status, modelState, modelProgress, transcript, startRecording, stopAndTranscribe } = useTranscription();
    const triggerStyles = useStyles();
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

    // During an active transcription the whole box turns into the send button's
    // primary look (brand background, white icon, regular mic icon) — the box
    // color alone signals the active transcription. Otherwise the mic sits in the
    // composition like the model picker (quiet, same regular icon); only the
    // setup/panel state marks itself with the muted mic.
    const usesPrimary = status === "recording" || status === "transcribing";
    const getIcon = () => (opensPanel ? <MicOffRegular /> : <MicRegular />);

    const getTooltipContent = () => {
        if (PROGRESS_STATES.has(modelState)) return `${t("components.microphonebutton.loading_model")} ${modelProgress > 0 ? `${modelProgress}%` : ""}`;
        if (opensPanel) return t("components.transcription.setup_tooltip");
        if (status === "recording") return t("components.microphonebutton.stop");
        return t("components.microphonebutton.record");
    };

    const buttonAppearance = usesPrimary ? "primary" : "subtle";
    const buttonClass = mergeClasses(styles.micButton, opensPanel && styles.busy, opensPanel && triggerStyles.trigger);
    const buttonTone = opensPanel ? "muted" : undefined;
    // Keep the popover mounted while it shows live progress, even though the mic
    // itself leaves the muted state as soon as downloading/loading starts.
    const popoverMode = opensPanel || (panelOpen && PROGRESS_STATES.has(modelState));

    return (
        <div className={styles.wrapper}>
            {popoverMode ? (
                <Popover open={panelOpen} positioning={POPOVER_POSITIONING} onOpenChange={(_, data) => setPanelOpen(data.open)}>
                    <PopoverTrigger disableButtonEnhancement>
                        <Tooltip positioning={"below"} content={getTooltipContent()} relationship="label">
                            <Button
                                appearance={buttonAppearance}
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
                        appearance={buttonAppearance}
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
