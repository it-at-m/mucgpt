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
    const { status, modelState, modelProgress, transcript, startRecording, cancelPendingStart, stopAndTranscribe } = useTranscription();
    const triggerStyles = useStyles();
    const [panelOpen, setPanelOpen] = useState(false);
    // Only the instance that started the current recording may forward its
    // transcript: a QuestionInput mounted later on another route would
    // otherwise adopt the live/final transcript into its own draft.
    const ownsRecordingRef = useRef(false);
    // Set while this instance's startRecording is still acquiring the microphone.
    // The provider cannot know which button began the start, so the instance
    // marks its own pending window and aborts it if it is unmounted meanwhile.
    const pendingOwnStartRef = useRef(false);
    const statusRef = useRef(status);
    // Latest action handle for the unmount cleanup below (the mount-time
    // closure would otherwise capture a stale, idle recordingState).
    const stopAndTranscribeRef = useRef(stopAndTranscribe);
    // Ref writes must happen in effects, not render: React can replay or discard
    // render work, so a render-time write could leak from a render that never
    // commits. On unmount the refs still hold the latest committed values.
    useEffect(() => {
        statusRef.current = status;
    }, [status]);
    useEffect(() => {
        stopAndTranscribeRef.current = stopAndTranscribe;
    }, [stopAndTranscribe]);

    // Keep the panel open while it shows live progress or an error with recovery
    // actions; only a finished (and therefore clickable-again) mic closes it.
    useEffect(() => {
        if (modelState === "ready") setPanelOpen(false);
    }, [modelState]);

    // Stop the recording when the page that started it goes away — the provider
    // outlives the input, and an orphaned capture would keep the mic busy.
    // Mount/unmount lifecycle only (the react-hooks lint plugin is not enabled here).
    useEffect(() => {
        return () => {
            if (ownsRecordingRef.current && statusRef.current === "recording") {
                ownsRecordingRef.current = false;
                void stopAndTranscribeRef.current();
            } else if (pendingOwnStartRef.current) {
                // The start never completed: abort the pending microphone setup so
                // the capture cannot silently begin after this page is gone.
                cancelPendingStart();
            }
        };
    }, []);

    // Forward interim transcript to input while recording
    useEffect(() => {
        if (ownsRecordingRef.current && status === "recording" && transcript) {
            onLiveTranscription?.(transcript);
        }
    }, [transcript, status, onLiveTranscription]);

    // Forward final transcript when recording is done
    const lastForwardedRef = useRef("");
    const prevStatusRef = useRef(status);
    useEffect(() => {
        if (ownsRecordingRef.current && prevStatusRef.current !== "idle" && status === "idle" && transcript && transcript !== lastForwardedRef.current) {
            lastForwardedRef.current = transcript;
            onTranscription(transcript);
            ownsRecordingRef.current = false;
        }
        prevStatusRef.current = status;
    }, [status, transcript, onTranscription]);

    useEffect(() => {
        if (status === "recording") lastForwardedRef.current = "";
    }, [status]);

    const handleClick = useCallback(async () => {
        if (status === "idle" || status === "error") {
            // Ignore further clicks while this instance's start is still pending:
            // the provider no-ops the duplicate, which would resolve immediately,
            // steal the ownership claim and clear the pending marker that the
            // unmount cleanup relies on to cancel the real start.
            if (pendingOwnStartRef.current) return;
            onRecordingStart?.();
            try {
                pendingOwnStartRef.current = true;
                await startRecording();
                // Claim ownership only once the capture actually started, so a
                // rejected start can never make this instance forward a
                // recording it does not own.
                ownsRecordingRef.current = true;
            } catch (error) {
                // A start aborted by our own unmount is not a failure: the page
                // is gone and the provider already returned everything to idle.
                if (error instanceof Error && error.name === "AbortError") return;
                console.error("Failed to start recording:", error);
                // A rejected start (e.g. unsupported language) carries its message
                // in the provider's error state — open the panel so it is visible.
                setPanelOpen(true);
            } finally {
                pendingOwnStartRef.current = false;
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
    // itself leaves the muted state as soon as downloading/loading starts. A
    // user-initiated download always keeps its panel — with the cancel action —
    // reachable instead of stranding the user on a disabled standalone trigger;
    // a rejected start reopens the panel to surface the error message.
    const isDownloading = modelState === "downloading";
    const popoverMode = opensPanel || isDownloading || (panelOpen && (PROGRESS_STATES.has(modelState) || status === "error"));

    return (
        <div className={styles.wrapper}>
            {popoverMode ? (
                <Popover open={panelOpen || isDownloading} positioning={POPOVER_POSITIONING} onOpenChange={(_, data) => setPanelOpen(data.open)}>
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
