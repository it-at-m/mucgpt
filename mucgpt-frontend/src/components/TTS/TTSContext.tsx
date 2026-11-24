import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findTtsModel, type TtsModel } from "../../config/ttsModels";
import { disposeTts, loadTts, type TtsLoadProgress } from "../../utils/tts/phononRuntime";
import { playSpeechStream } from "../../utils/tts/playback";

/** Lifecycle of the read-aloud (TTS) UI. */
export type TtsStatus = "idle" | "loading" | "speaking" | "error";

/** Everything the read-aloud button needs, plus the actions driving it. */
export interface ITts {
    /** Feature enabled and the configured model is a known registry entry. */
    enabled: boolean;
    /** The deployment-configured model (null when read-aloud is disabled or the id is unknown). */
    model: TtsModel | null;
    status: TtsStatus;
    /** 0..100 during loading, or -1 when indeterminate. */
    modelProgress: number;
    downloadedBytes: number;
    totalBytes: number;
    /** Token of the answer currently loading or spoken (matches the button's `useId` token). */
    activeToken: string | null;
    error: string | null;
    /** Reads `text` aloud; a running playback (or load) is stopped first. The text must already be speech-ready prose. */
    speak: (token: string, text: string) => void;
    /** Stops playback and, if possible, the pending load. */
    stop: () => void;
}

const defaultValue: ITts = {
    enabled: false,
    model: null,
    status: "idle",
    modelProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    activeToken: null,
    error: null,
    speak: () => {},
    stop: () => {}
};

/** React context carrying {@link ITts}; consume via {@link useTTS}. */
export const TtsContext = React.createContext<ITts>(defaultValue);

interface TtsProviderProps {
    /** Deployment feature flag; the sole switch for the whole flow (absent/`false` hides every button). */
    ttsEnabled: boolean;
    /** The single model id announced by the backend; unknown ids disable the feature. */
    ttsModelId?: string | null;
}

/**
 * Owns the phonon-tts runtime (one worker per page), tracks the currently
 * spoken answer token and exposes everything through the context.
 */
export const TtsProvider = ({ children, ttsEnabled, ttsModelId }: React.PropsWithChildren<TtsProviderProps>) => {
    // Registry lookup mirrors TranscriptionProvider: an unset id (null) keeps
    // the feature disabled without a fallback; an unknown id disables it with
    // a warning instead of silently running another model.
    const model = useMemo<TtsModel | null>(() => {
        if (ttsModelId === undefined || ttsModelId === null) return null;
        const found = findTtsModel(ttsModelId);
        if (!found) console.warn(`[TTS] Unknown configured read-aloud model "${ttsModelId}"; feature is disabled. See manifest in src/config/ttsModels.ts.`);
        return found ?? null;
    }, [ttsModelId]);
    const enabled = ttsEnabled && model !== null;

    const [status, setStatus] = useState<TtsStatus>("idle");
    const [modelProgress, setModelProgress] = useState(0);
    const [downloadedBytes, setDownloadedBytes] = useState(0);
    const [totalBytes, setTotalBytes] = useState(0);
    const [activeToken, setActiveToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** Bumped per speak request; stale async continuations must not touch state. */
    const speakGenerationRef = useRef(0);
    /** Abort controller of the current speak request (stops playback and generation). */
    const abortRef = useRef<AbortController | null>(null);

    /** Stops everything in flight and returns to idle; returns the generation the stop belongs to. */
    const stop = useCallback(() => {
        speakGenerationRef.current += 1;
        abortRef.current?.abort();
        abortRef.current = null;
        setStatus("idle");
        setActiveToken(null);
    }, []);

    // Stop playback when the feature is disabled under us (config change).
    useEffect(() => {
        if (!enabled) stop();
    }, [enabled, stop]);

    // On unmount: abort in-flight work and free the model worker.
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            abortRef.current = null;
            void disposeTts();
        };
    }, []);

    const speak = useCallback(
        (token: string, text: string) => {
            if (!enabled || !model) return;
            const trimmed = text.trim();
            if (!trimmed) return;

            // A second click either toggles off (the button handles "same
            // token → stop") or switches answers — both begin with a clean stop.
            const generation = ++speakGenerationRef.current;
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            setError(null);
            setModelProgress(0);
            setDownloadedBytes(0);
            setTotalBytes(0);
            setActiveToken(token);
            setStatus("loading");

            void (async () => {
                try {
                    const tts = await loadTts(model, (progress: TtsLoadProgress) => {
                        if (speakGenerationRef.current !== generation) return;
                        setModelProgress(progress.progress);
                        setDownloadedBytes(progress.downloadedBytes);
                        setTotalBytes(progress.totalBytes);
                    });
                    if (speakGenerationRef.current !== generation || controller.signal.aborted) return;
                    setStatus("speaking");
                    await playSpeechStream(tts.stream(trimmed, { signal: controller.signal }), { signal: controller.signal });
                    if (speakGenerationRef.current !== generation || controller.signal.aborted) return;
                    setStatus("idle");
                    setActiveToken(null);
                } catch (err) {
                    if (speakGenerationRef.current !== generation || controller.signal.aborted) return;
                    console.error("[TTS] Read-aloud failed:", err);
                    setError(err instanceof Error ? err.message : String(err));
                    setStatus("error");
                    setActiveToken(null);
                }
            })();
        },
        [enabled, model]
    );

    const value = useMemo<ITts>(
        () => ({
            enabled,
            model,
            status,
            modelProgress,
            downloadedBytes,
            totalBytes,
            activeToken,
            error,
            speak,
            stop
        }),
        [enabled, model, status, modelProgress, downloadedBytes, totalBytes, activeToken, error, speak, stop]
    );

    return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
};
