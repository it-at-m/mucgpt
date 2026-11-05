import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { findTranscriptionModel, type TranscriptionModel } from "../../config/transcriptionModels";
import { localeToWhisperLang, modelSupportsLanguage } from "../../config/transcriptionLanguages";
import { clearModelVerification, deleteModelFromCache, hasModelFiles, isModelDownloaded, markModelVerified } from "../../utils/transcriptionModelCache";
import { supportsWebGPU } from "../../utils/webgpuSupport";
import type { WorkerInMessage, WorkerOutMessage } from "../../workers/transcription.worker";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { fetchModelFileSizes } from "../../utils/modelSizeUtils";

/** Lifecycle of the transcription UI, mirrored to the worker status handling. */
export type TranscriptionStatus = "idle" | "warming-up" | "loading-model" | "recording" | "transcribing" | "error";
/** Whisper language tag driving the pipeline (undefined lets models auto-detect). */
export type TranscriptionLanguage = string | undefined;
/** Availability of the (single, deployment-configured) transcription model. */
export type TranscriptionModelState =
    | "checking" // cache probe in flight (app start)
    | "missing" // never downloaded / cache evicted
    | "unverified" // cached files present but the last load failed (possibly corrupted)
    | "downloading" // user-initiated download in flight
    | "loading" // model being loaded from cache (warming up)
    | "ready" // loaded and usable
    | "unsupported"; // browser cannot run the configured model (e.g. WebGPU-only without WebGPU)

/** Everything the mic button and the model popover need, plus the actions driving them. */
export interface ITranscription {
    // Configuration
    /** Feature enabled and the configured model is a known registry entry. */
    enabled: boolean;
    /** The deployment-configured model (null when transcription is disabled or the id is unknown). */
    model: TranscriptionModel | null;
    modelState: TranscriptionModelState;
    // Worker state
    status: TranscriptionStatus;
    modelProgress: number;
    downloadedBytes: number;
    totalBytes: number;
    transcript: string;
    error: string | null;
    language: TranscriptionLanguage;
    setLanguage: (lang: TranscriptionLanguage) => void;
    // Actions
    downloadModel: () => Promise<void>;
    /** Re-loads the model from existing cache entries without purging them. */
    retryModelLoad: () => void;
    /** Purges the cached files and downloads the model anew. */
    redownloadModel: () => Promise<void>;
    cancelDownload: () => void;
    /** Clears the cache entry and verification marker (used by the popover's cleanup action). */
    deleteModel: () => Promise<void>;
    startRecording: () => Promise<void>;
    stopAndTranscribe: () => Promise<void>;
}

const defaultValue: ITranscription = {
    enabled: false,
    model: null,
    modelState: "missing",
    status: "idle",
    modelProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    transcript: "",
    error: null,
    language: undefined,
    setLanguage: () => {},
    downloadModel: async () => {},
    retryModelLoad: async () => {},
    redownloadModel: async () => {},
    cancelDownload: () => {},
    deleteModel: async () => {},
    startRecording: async () => {},
    stopAndTranscribe: async () => {}
};

/** React context carrying {@link ITranscription}; consume via {@link useTranscription}. */
export const TranscriptionContext = React.createContext<ITranscription>(defaultValue);

/** Access hook for the transcription model state, status and actions. */
export const useTranscription = () => useContext(TranscriptionContext);

interface TranscriptionProviderProps {
    /** Deployment feature flag (`TRANSCRIPTION_ENABLED`); the sole switch for the whole flow. */
    transcriptionEnabled: boolean;
    /** The single model id announced by the backend; unknown ids disable the feature. */
    transcriptionModelId?: string | null;
}

/** Owns the transcription worker, tracks the configured model's availability and exposes everything through the context. */
/** Ceiling for a stalling model load: without any result or progress for this long, the load counts as failed. */
export const LOAD_WATCHDOG_MS = 45_000;
/** Minimum spacing between worker replacements triggered by worker errors, so a permanently broken script cannot loop. */
const WORKER_RECREATE_MIN_INTERVAL_MS = 5_000;

export const TranscriptionProvider = ({ children, transcriptionEnabled, transcriptionModelId }: React.PropsWithChildren<TranscriptionProviderProps>) => {
    const { t, i18n } = useTranslation();
    const translateRef = useRef(t);
    translateRef.current = t;

    // Registry lookup: an unset id (null) keeps the feature disabled without a
    // fallback — core and frontend are updated in sync. An unknown id disables
    // the feature with a warning instead of silently running another model.
    const model = useMemo<TranscriptionModel | null>(() => {
        if (transcriptionModelId === undefined || transcriptionModelId === null) return null;
        const found = findTranscriptionModel(transcriptionModelId);
        if (!found)
            console.warn(
                `[Transcription] Unknown configured transcription model "${transcriptionModelId}"; feature is disabled. See manifest in src/config/transcriptionModels.ts.`
            );
        return found ?? null;
    }, [transcriptionModelId]);
    const enabled = transcriptionEnabled && model !== null;
    const webgpuAvailable = useMemo(() => supportsWebGPU(), []);

    // Cache probe result for the configured model (drives "missing" vs "unverified").
    const [cacheVerified, setCacheVerified] = useState<boolean | null>(null);
    const [cacheHasFiles, setCacheHasFiles] = useState(false);

    // Worker state
    const [status, setStatus] = useState<TranscriptionStatus>("idle");
    const [modelProgress, setModelProgress] = useState<number>(0);
    const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
    const [totalBytes, setTotalBytes] = useState<number>(0);
    const [transcript, setTranscript] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [language, setLanguageState] = useState<TranscriptionLanguage>(() => localeToWhisperLang(i18n.language));

    const workerRef = useRef<Worker | null>(null);
    const languageRef = useRef<TranscriptionLanguage>(localeToWhisperLang(i18n.language));
    const loadedModelIdRef = useRef<string | null>(null);
    const loadRequestIdRef = useRef(0);
    const downloadGenerationRef = useRef(0);
    const expectedLoadRef = useRef<{ requestId: number; modelId: string } | null>(null);
    const recordingSessionIdRef = useRef(0);
    const activeRecordingSessionIdRef = useRef<number | null>(null);
    const pendingDownloadRef = useRef<{ requestId: number; resolve: () => void; reject: (err: Error) => void } | null>(null);
    /** Timestamp of the last worker progress message — keeps the load watchdog from aborting healthy downloads. */
    const lastProgressAtRef = useRef(0);
    /** Guards against concurrent mic starts while microphone acquisition / AudioContext setup is still in flight. */
    const pendingStartRef = useRef(false);
    /** When the worker must be replaced (stuck load, dead script), bumping this recreates it via the worker effect. */
    const [workerEpoch, setWorkerEpoch] = useState(0);
    const lastWorkerRecreateAtRef = useRef(0);

    const { recordingState, startRecording: startAudioRecording, stopRecording } = useAudioRecorder();

    useEffect(() => {
        languageRef.current = language;
    }, [language]);

    // Keep transcription language in sync with i18n (covers persisted preference
    // restored by Layout on mount via i18n.changeLanguage, not just user-initiated changes).
    // Guard: only update when the locale maps to a known Whisper language — if i18n.language
    // is null/empty/unsupported, keep the current value rather than overwriting with undefined.
    useEffect(() => {
        const mapped = localeToWhisperLang(i18n.language);
        if (mapped !== undefined) setLanguage(mapped);
    }, [i18n.language]);

    const sendToWorker = useCallback((msg: WorkerInMessage, transfer?: Transferable[]) => {
        if (transfer && transfer.length > 0) {
            workerRef.current?.postMessage(msg, transfer);
        } else {
            workerRef.current?.postMessage(msg);
        }
    }, []);

    const requestModelLoad = useCallback(
        (fileSizes?: Record<string, number>) => {
            if (!model) return undefined;
            const requestId = ++loadRequestIdRef.current;
            expectedLoadRef.current = { requestId, modelId: model.model_id };
            // Every load starts its own watchdog window, even before the first
            // progress message arrives.
            lastProgressAtRef.current = Date.now();
            sendToWorker({
                type: "load",
                requestId,
                modelId: model.model_id,
                fileSizes,
                dtype: model.dtype,
                webgpu_only: model.webgpu_only,
                runtime: model.runtime,
                files: model.files,
                language: languageRef.current
            });
            return requestId;
        },
        [model, sendToWorker]
    );

    /** Kicks off a load of the configured model from cache; the result arrives via the worker's `ready`/`error` messages. */
    const loadCachedModel = useCallback(() => {
        if (!model || loadedModelIdRef.current === model.model_id) return;
        setError(null);
        setModelProgress(100);
        setStatus("warming-up");
        requestModelLoad();
    }, [model, requestModelLoad]);

    useEffect(() => {
        if (!workerReady || !model) return;
        let cancelled = false;
        void (async () => {
            const downloaded = await isModelDownloaded(model);
            if (cancelled) return;
            if (downloaded) {
                setCacheVerified(true);
                setCacheHasFiles(true);
                // A verified download is loaded immediately so ONNX sessions are hot
                // before the user clicks the mic (warming-up keeps frames buffered).
                loadCachedModel();
            } else {
                setCacheVerified(false);
                setCacheHasFiles(await hasModelFiles(model));
            }
        })();
        return () => {
            cancelled = true;
        };
        // `model` is stable per configured model id (covered by `loadCachedModel`).
        // Note: the react-hooks exhaustive-deps plugin is not enabled in this repo.
    }, [workerReady, loadCachedModel]);

    // Create worker lazily; terminate on unmount
    useEffect(() => {
        if (!enabled) {
            workerRef.current?.terminate();
            workerRef.current = null;
            setWorkerReady(false);
            setStatus("idle");
            return;
        }

        const worker = new Worker(new URL("../../workers/transcription.worker.ts", import.meta.url), { type: "module" });

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
            const msg = event.data;
            switch (msg.type) {
                case "progress":
                    // Byte-level updates count as activity too, not only rounded percent jumps.
                    lastProgressAtRef.current = Date.now();
                    if (msg.progress >= 0) setModelProgress(Math.round(msg.progress));
                    if (msg.downloadedBytes !== undefined) setDownloadedBytes(msg.downloadedBytes);
                    if (msg.totalBytes !== undefined) setTotalBytes(msg.totalBytes);
                    break;
                case "ready": {
                    if (expectedLoadRef.current?.requestId !== msg.requestId || expectedLoadRef.current.modelId !== msg.modelId) break;
                    const pending = pendingDownloadRef.current;
                    loadedModelIdRef.current = msg.modelId;
                    setLoadedModelId(msg.modelId);
                    expectedLoadRef.current = null;
                    if (pending) {
                        pending.resolve();
                        pendingDownloadRef.current = null;
                    }
                    // A successful load proves the cached bytes are intact.
                    if (model) {
                        markModelVerified(model).catch(err => {
                            // A failed marker write must not present the model as
                            // verified on the next visit; the running session stays usable.
                            console.warn("[Transcription] Failed to persist verification marker:", err);
                            setCacheVerified(false);
                        });
                    }
                    setCacheVerified(true);
                    setCacheHasFiles(true);
                    setModelProgress(100);
                    setStatus(prev => (prev === "loading-model" || prev === "warming-up" ? "idle" : prev));
                    break;
                }
                case "recording_start":
                    // VAD detected onset of speech — status stays "recording"
                    break;
                case "segment":
                    if (msg.sessionId !== activeRecordingSessionIdRef.current) break;
                    // Append each VAD segment to the live transcript
                    setTranscript(prev => (prev ? prev + " " + msg.text : msg.text));
                    break;
                case "auto_stop":
                    if (msg.sessionId !== activeRecordingSessionIdRef.current) break;
                    // VAD detected 2 s of silence after speech — stop audio capture
                    // and let the worker flush remaining inference as normal.
                    stopRecording();
                    setStatus("transcribing");
                    if (activeRecordingSessionIdRef.current !== null) sendToWorker({ type: "stop-recording", sessionId: activeRecordingSessionIdRef.current });
                    break;
                case "complete":
                    if (msg.sessionId !== activeRecordingSessionIdRef.current) break;
                    activeRecordingSessionIdRef.current = null;
                    setStatus("idle");
                    break;
                case "error": {
                    if (msg.requestId !== undefined && expectedLoadRef.current?.requestId !== msg.requestId) break;
                    if (msg.sessionId !== undefined && activeRecordingSessionIdRef.current !== msg.sessionId) break;
                    const pending = pendingDownloadRef.current;
                    if (pending && msg.requestId === pending.requestId) {
                        pending.reject(new Error(msg.message));
                        pendingDownloadRef.current = null;
                    }
                    if (msg.requestId !== undefined) expectedLoadRef.current = null;
                    if (msg.sessionId !== undefined) {
                        activeRecordingSessionIdRef.current = null;
                        // A session error ends the recording: release the microphone,
                        // otherwise it stays captured with a dead session.
                        stopRecording();
                    }
                    loadedModelIdRef.current = null;
                    setLoadedModelId(null);
                    // A failed model load invalidates the verification; the cached files
                    // stay available for a retry, only a re-download purges them.
                    // (Session/transcription errors do not touch the marker.)
                    const isLoadError = msg.requestId !== undefined && msg.sessionId === undefined;
                    if (isLoadError) {
                        if (model) {
                            void clearModelVerification(model);
                            // Re-probe files so the popover can distinguish "missing"
                            // (fresh download) from "unverified" (cached but broken).
                            void hasModelFiles(model).then(present => setCacheHasFiles(present));
                        }
                        setCacheVerified(false);
                        setModelProgress(0);
                    }
                    setError(msg.messageKey ? translateRef.current(`components.${msg.messageKey}`, { defaultValue: msg.message }) : msg.message);
                    setStatus("error");
                    break;
                }
            }
        };

        worker.onerror = (event: ErrorEvent) => {
            console.error("[TranscriptionWorker] Worker error:", event.message, event);
            const pending = pendingDownloadRef.current;
            pending?.reject(new Error(event.message));
            pendingDownloadRef.current = null;
            expectedLoadRef.current = null;
            if (activeRecordingSessionIdRef.current !== null) {
                activeRecordingSessionIdRef.current = null;
                stopRecording();
            }
            loadedModelIdRef.current = null;
            setLoadedModelId(null);
            setError(`Worker error: ${event.message}`);
            setStatus("error");
            // After a script-load failure the worker is dead and ignores every
            // message — retries would each run into the load timeout. Replace it
            // via the worker effect; the interval guard keeps a permanently
            // broken script from looping worker creation.
            if (Date.now() - lastWorkerRecreateAtRef.current >= WORKER_RECREATE_MIN_INTERVAL_MS) {
                lastWorkerRecreateAtRef.current = Date.now();
                setWorkerEpoch(epoch => epoch + 1);
            }
        };

        workerRef.current = worker;
        setWorkerReady(true);
        return () => {
            worker.terminate();
            workerRef.current = null;
            loadedModelIdRef.current = null;
            setWorkerReady(false);
            // A dying worker can never deliver its in-flight result: clear busy
            // state instead of freezing the icon (the cache probe re-runs for the
            // next worker and reloads a verified model there).
            const pending = pendingDownloadRef.current;
            if (pending) {
                pending.reject(new Error("Transcription worker terminated"));
                pendingDownloadRef.current = null;
            }
            expectedLoadRef.current = null;
            // Whatever killed this worker must not leave the microphone captured.
            stopRecording();
            setStatus(prev => (prev === "loading-model" || prev === "warming-up" ? "error" : prev));
        };
    }, [enabled, model, sendToWorker, stopRecording, workerEpoch]);

    // Watchdog against silently wedged loads: if a load receives neither a
    // result nor any progress for LOAD_WATCHDOG_MS, treat it as failed so the UI
    // can offer a retry instead of spinning forever. The timer re-arms itself
    // while progress messages keep arriving (byte-level activity counts, not
    // only rounded percent steps), so healthy — even long — downloads never trip it.
    useEffect(() => {
        if (status !== "loading-model" && status !== "warming-up") return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const armWatchdog = () => {
            timer = setTimeout(() => {
                if (Date.now() - lastProgressAtRef.current < LOAD_WATCHDOG_MS) {
                    armWatchdog();
                    return;
                }
                const requestId = expectedLoadRef.current?.requestId ?? pendingDownloadRef.current?.requestId;
                if (requestId === undefined) return;
                expectedLoadRef.current = null;
                const pending = pendingDownloadRef.current;
                pendingDownloadRef.current = null;
                // Settle the download promise — every other path that clears the
                // ref does, and an unsettled caller would await forever.
                pending?.reject(new Error("Model load timed out"));
                sendToWorker({ type: "abort", requestId });
                loadedModelIdRef.current = null;
                setLoadedModelId(null);
                // A wedged load cannot recover in place: the worker stays busy
                // until the pending load returns, so a retry would queue behind
                // it and be dropped at the next timeout. Replace the worker so
                // the retry starts on a fresh, idle instance.
                setWorkerEpoch(epoch => epoch + 1);
                if (model) {
                    void clearModelVerification(model);
                    void hasModelFiles(model).then(present => setCacheHasFiles(present));
                }
                setCacheVerified(false);
                setModelProgress(0);
                setError(t("components.transcription.load_timeout"));
                setStatus("error");
            }, LOAD_WATCHDOG_MS);
        };
        armWatchdog();
        return () => clearTimeout(timer);
    }, [status, sendToWorker, t, model]);

    const setLanguage = useCallback(
        (lang: TranscriptionLanguage) => {
            setLanguageState(lang);
            // Keep the worker in sync so in-flight VAD segments use the updated language.
            sendToWorker({ type: "set-language", language: lang });
        },
        [sendToWorker]
    );

    const downloadModel = useCallback((): Promise<void> => {
        if (!model || !workerRef.current) return Promise.reject(new Error("Transcription is disabled"));
        const prior = pendingDownloadRef.current;
        if (prior) {
            prior.reject(new Error("Superseded by new download"));
            pendingDownloadRef.current = null;
        }
        setError(null);
        setModelProgress(0);
        setDownloadedBytes(0);
        setTotalBytes(0);
        setStatus("loading-model");
        const downloadGeneration = ++downloadGenerationRef.current;
        return new Promise<void>((resolve, reject) => {
            // NeMo runtimes report real byte counters while downloading, so the
            // HuggingFace tree lookup (used only for Whisper's combined progress)
            // is skipped to avoid an unnecessary request with an incompatible URL.
            const isNemo = model.runtime === "canary" || model.runtime === "parakeet";
            const startLoad = (fileSizes?: Record<string, number>) => {
                if (downloadGeneration !== downloadGenerationRef.current) {
                    // This download was superseded (cancel or a newer call) while
                    // the file-size lookup was in flight — settle the promise.
                    reject(new Error("Superseded by newer download"));
                    return;
                }
                const requestId = requestModelLoad(fileSizes);
                if (requestId === undefined) {
                    reject(new Error("Transcription is disabled"));
                    return;
                }
                pendingDownloadRef.current = { requestId, resolve, reject };
            };
            if (isNemo) {
                startLoad();
                return;
            }
            fetchModelFileSizes(model.model_id, model.file_tree)
                .then(fileSizes => startLoad(fileSizes))
                .catch(err => {
                    console.error("Failed to fetch file sizes, continuing without size info:", err);
                    startLoad();
                });
        });
    }, [model, requestModelLoad]);

    const retryModelLoad = useCallback(() => {
        loadCachedModel();
    }, [loadCachedModel]);

    const redownloadModel = useCallback(async (): Promise<void> => {
        if (!model) return;
        if (loadedModelIdRef.current === model.model_id) {
            sendToWorker({ type: "unload" });
            loadedModelIdRef.current = null;
            setLoadedModelId(null);
            setStatus("idle");
        }
        await deleteModelFromCache(model);
        return downloadModel();
    }, [model, sendToWorker, downloadModel]);

    const cancelDownload = useCallback(() => {
        if (status !== "loading-model") return;
        downloadGenerationRef.current += 1;
        const pending = pendingDownloadRef.current;
        const requestId = pending?.requestId ?? expectedLoadRef.current?.requestId;
        if (pending) {
            pending.reject(new Error("Model download canceled"));
            pendingDownloadRef.current = null;
        }
        if (requestId !== undefined) sendToWorker({ type: "abort", requestId });
        expectedLoadRef.current = null;
        setModelProgress(0);
        setDownloadedBytes(0);
        setTotalBytes(0);
        setStatus("idle");
    }, [sendToWorker, status]);

    const deleteModel = useCallback(async (): Promise<void> => {
        if (!model) return;
        if (loadedModelIdRef.current === model.model_id) {
            sendToWorker({ type: "unload" });
            loadedModelIdRef.current = null;
            setLoadedModelId(null);
            setStatus("idle");
        }
        await deleteModelFromCache(model);
        setCacheVerified(false);
        setCacheHasFiles(false);
    }, [model, sendToWorker]);

    const startRecording = useCallback(async () => {
        // A second click while the first start is still acquiring the microphone
        // or building the AudioContext must not spawn a second capture that
        // overwrites the recorder refs and leaks the first stream.
        if (pendingStartRef.current || status === "recording" || recordingState === "recording") return;
        if (!enabled || loadedModelIdRef.current !== model?.model_id) {
            setError("Transcription model not ready");
            return;
        }
        if (model && !modelSupportsLanguage(model.languages, languageRef.current)) {
            // Refuse before any capture starts: the configured model cannot
            // transcribe the active interface language (e.g. Ukrainian on Canary).
            setError(translateRef.current("components.transcription.language_unsupported"));
            throw new Error(translateRef.current("components.transcription.language_unsupported"));
        }
        setError(null);
        setTranscript("");

        pendingStartRef.current = true;
        try {
            // Sync language before frames start arriving
            sendToWorker({ type: "set-language", language: languageRef.current });
            const sessionId = ++recordingSessionIdRef.current;
            activeRecordingSessionIdRef.current = sessionId;
            sendToWorker({ type: "start-recording", sessionId });

            await startAudioRecording((frame: Float32Array) => {
                // Transfer ownership of the buffer to avoid a copy on every frame.
                sendToWorker({ type: "audio-frame", sessionId, buffer: frame }, [frame.buffer]);
            });
            setStatus("recording");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
            throw err;
        } finally {
            pendingStartRef.current = false;
        }
    }, [status, recordingState, enabled, model, startAudioRecording, sendToWorker]);

    const stopAndTranscribe = useCallback(async () => {
        if (recordingState !== "recording") return;
        stopRecording();
        setStatus("transcribing");
        if (activeRecordingSessionIdRef.current !== null) sendToWorker({ type: "stop-recording", sessionId: activeRecordingSessionIdRef.current });
    }, [recordingState, stopRecording, sendToWorker]);

    const modelState = useMemo<TranscriptionModelState>(() => {
        if (!model) return "missing";
        if (enabled && loadedModelId === model.model_id) return "ready";
        if (status === "loading-model") return "downloading";
        if (status === "warming-up") return "loading";
        if (model.webgpu_only && !webgpuAvailable) return "unsupported";
        if (cacheVerified === null) return "checking";
        return cacheHasFiles ? "unverified" : "missing";
    }, [model, enabled, loadedModelId, status, webgpuAvailable, cacheVerified, cacheHasFiles]);

    const value = useMemo<ITranscription>(
        () => ({
            enabled,
            model,
            modelState,
            status,
            modelProgress,
            downloadedBytes,
            totalBytes,
            transcript,
            error,
            language,
            setLanguage,
            downloadModel,
            retryModelLoad,
            redownloadModel,
            cancelDownload,
            deleteModel,
            startRecording,
            stopAndTranscribe
        }),
        [
            enabled,
            model,
            modelState,
            status,
            modelProgress,
            downloadedBytes,
            totalBytes,
            transcript,
            error,
            language,
            setLanguage,
            downloadModel,
            retryModelLoad,
            redownloadModel,
            cancelDownload,
            deleteModel,
            startRecording,
            stopAndTranscribe
        ]
    );

    return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
};
