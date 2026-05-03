import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
import { DEFAULT_TRANSCRIPTION_MODEL, TRANSCRIPTION_MODELS } from "../../config/transcriptionModels";
import type { WorkerInMessage, WorkerOutMessage } from "../../workers/transcription.worker";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { fetchModelFileSizes } from "../../utils/modelSizeUtils";

// Maps the app's i18n locale code to a Whisper language tag.
// Bavarian (BAY) is a German dialect not supported by Whisper → fall back to "de".
const LOCALE_TO_WHISPER: Record<string, string> = {
    DE: "de",
    EN: "en",
    FR: "fr",
    UK: "uk",
    BAY: "de"
};

function localeToWhisperLang(locale: string): string | undefined {
    return LOCALE_TO_WHISPER[locale.toUpperCase().split("-")[0]];
}

export type TranscriptionStatus = "idle" | "warming-up" | "loading-model" | "recording" | "transcribing" | "error";
export type TranscriptionLanguage = string | undefined;

export interface ITranscriptionSettings {
    // Settings
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    selectedModelId: string;
    setSelectedModelId: (id: string) => void;
    downloadedModels: string[];
    isModelReady: boolean;
    // Worker state
    status: TranscriptionStatus;
    modelProgress: number;
    downloadedBytes: number;
    totalBytes: number;
    transcript: string;
    error: string | null;
    loadingModelId: string | null;
    language: TranscriptionLanguage;
    setLanguage: (lang: TranscriptionLanguage) => void;
    // Actions
    downloadModel: (modelId: string) => Promise<void>;
    startRecording: () => Promise<void>;
    stopAndTranscribe: () => Promise<void>;
}

const KNOWN_MODEL_IDS = new Set(TRANSCRIPTION_MODELS.map(m => m.model_id));

const readEnabled = (): boolean => {
    try {
        return localStorage.getItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_ENABLED) === "true";
    } catch {
        return false;
    }
};

const readSelected = (): string => {
    try {
        const v = localStorage.getItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_MODEL_ID);
        if (v && KNOWN_MODEL_IDS.has(v)) return v;
    } catch {
        // ignore
    }
    return DEFAULT_TRANSCRIPTION_MODEL;
};

const readDownloaded = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_DOWNLOADED_MODELS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((v: unknown): v is string => typeof v === "string");
    } catch {
        // ignore
    }
    return [];
};

const defaultValue: ITranscriptionSettings = {
    enabled: false,
    setEnabled: () => {},
    selectedModelId: DEFAULT_TRANSCRIPTION_MODEL,
    setSelectedModelId: () => {},
    downloadedModels: [],
    isModelReady: false,
    status: "idle",
    modelProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    transcript: "",
    error: null,
    loadingModelId: null,
    language: undefined,
    setLanguage: () => {},
    downloadModel: async () => {},
    startRecording: async () => {},
    stopAndTranscribe: async () => {}
};

export const TranscriptionSettingsContext = React.createContext<ITranscriptionSettings>(defaultValue);

export const TranscriptionSettingsProvider = (props: React.PropsWithChildren<unknown>) => {
    const { t, i18n } = useTranslation();

    // Persisted settings
    const [enabled, setEnabledState] = useState<boolean>(() => readEnabled());
    const [selectedModelId, setSelectedModelIdState] = useState<string>(() => readSelected());
    const [downloadedModels, setDownloadedModels] = useState<string[]>(() => readDownloaded());

    // Worker state
    const [status, setStatus] = useState<TranscriptionStatus>("idle");
    const [modelProgress, setModelProgress] = useState<number>(0);
    const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
    const [totalBytes, setTotalBytes] = useState<number>(0);
    const [transcript, setTranscript] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [language, setLanguageState] = useState<TranscriptionLanguage>(() => localeToWhisperLang(i18n.language));

    const workerRef = useRef<Worker | null>(null);
    const languageRef = useRef<TranscriptionLanguage>(localeToWhisperLang(i18n.language));
    const loadedModelIdRef = useRef<string | null>(null);
    const selectedModelIdRef = useRef<string>(selectedModelId);
    const pendingDownloadRef = useRef<{ id: string; resolve: () => void; reject: (err: Error) => void } | null>(null);

    const { recordingState, startRecording: startAudioRecording, stopRecording } = useAudioRecorder();

    // Persist settings
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_ENABLED, String(enabled));
        } catch {
            // ignore
        }
    }, [enabled]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_MODEL_ID, selectedModelId);
        } catch {
            // ignore
        }
    }, [selectedModelId]);
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS_TRANSCRIPTION_DOWNLOADED_MODELS, JSON.stringify(downloadedModels));
        } catch {
            // ignore
        }
    }, [downloadedModels]);

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

    useEffect(() => {
        selectedModelIdRef.current = selectedModelId;
    }, [selectedModelId]);

    const markDownloaded = useCallback((id: string) => {
        setDownloadedModels(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const sendToWorker = useCallback((msg: WorkerInMessage, transfer?: Transferable[]) => {
        if (transfer && transfer.length > 0) {
            workerRef.current?.postMessage(msg, transfer);
        } else {
            workerRef.current?.postMessage(msg);
        }
    }, []);

    // Pre-warm: when transcription is enabled and the selected model is already
    // cached, load it immediately so the ONNX sessions are hot before the user
    // clicks the mic. Shows "warming-up" (progress bar, button still enabled)
    // rather than "loading-model" so the user can still click and have frames
    // buffered by the worker. The worker's own guards prevent duplicate loads.
    useEffect(() => {
        if (!workerReady) return;
        if (!enabled) return;
        if (!downloadedModels.includes(selectedModelId)) return;
        if (loadedModelIdRef.current === selectedModelId) return;
        const modelCfg = TRANSCRIPTION_MODELS.find(m => m.model_id === selectedModelId);
        setStatus("warming-up");
        sendToWorker({ type: "load", modelId: selectedModelId, dtype: modelCfg?.dtype, webgpu_only: modelCfg?.webgpu_only, language: languageRef.current });
    }, [workerReady, enabled, selectedModelId, downloadedModels, sendToWorker]);

    // Create worker lazily; terminate on unmount
    useEffect(() => {
        const worker = new Worker(new URL("../../workers/transcription.worker.ts", import.meta.url), { type: "module" });

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
            const msg = event.data;
            switch (msg.type) {
                case "progress":
                    if (msg.progress >= 0) setModelProgress(Math.round(msg.progress));
                    if (msg.downloadedBytes !== undefined) setDownloadedBytes(msg.downloadedBytes);
                    if (msg.totalBytes !== undefined) setTotalBytes(msg.totalBytes);
                    break;
                case "ready": {
                    const pending = pendingDownloadRef.current;
                    if (pending) {
                        loadedModelIdRef.current = pending.id;
                        markDownloaded(pending.id);
                        pending.resolve();
                        pendingDownloadRef.current = null;
                    } else {
                        // Pre-warm or startRecording load completed — record which
                        // model is live so startRecording skips the redundant load.
                        loadedModelIdRef.current = loadingModelId ?? selectedModelIdRef.current;
                    }
                    setModelProgress(100);
                    setLoadingModelId(null);
                    setStatus(prev => (prev === "loading-model" || prev === "warming-up" ? "idle" : prev));
                    break;
                }
                case "recording_start":
                    // VAD detected onset of speech — status stays "recording"
                    break;
                case "segment":
                    // Append each VAD segment to the live transcript
                    setTranscript(prev => (prev ? prev + " " + msg.text : msg.text));
                    break;
                case "auto_stop":
                    // VAD detected 2 s of silence after speech — stop audio capture
                    // and let the worker flush remaining inference as normal.
                    stopRecording();
                    setStatus("transcribing");
                    sendToWorker({ type: "stop-recording" });
                    break;
                case "complete":
                    setStatus("idle");
                    break;
                case "error": {
                    const pending = pendingDownloadRef.current;
                    if (pending) {
                        pending.reject(new Error(msg.message));
                        pendingDownloadRef.current = null;
                    }
                    setError(msg.messageKey ? t(msg.messageKey) : msg.message);
                    setStatus("error");
                    setLoadingModelId(null);
                    break;
                }
            }
        };

        worker.onerror = (event: ErrorEvent) => {
            console.error("[TranscriptionWorker] Worker error:", event.message, event);
            const pending = pendingDownloadRef.current;
            if (pending) {
                pending.reject(new Error(event.message));
                pendingDownloadRef.current = null;
            }
            setError(`Worker error: ${event.message}`);
            setStatus("error");
            setLoadingModelId(null);
        };

        workerRef.current = worker;
        setWorkerReady(true);
        return () => {
            worker.terminate();
            workerRef.current = null;
            setWorkerReady(false);
        };
    }, [markDownloaded]);

    const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
    const setSelectedModelId = useCallback((id: string) => setSelectedModelIdState(id), []);

    const setLanguage = useCallback(
        (lang: TranscriptionLanguage) => {
            setLanguageState(lang);
            // Keep the worker in sync so in-flight VAD segments use the updated language.
            sendToWorker({ type: "set-language", language: lang });
        },
        [sendToWorker]
    );

    const downloadModel = useCallback(
        (modelId: string): Promise<void> => {
            if (!workerRef.current) return Promise.reject(new Error("Worker not ready"));
            const prior = pendingDownloadRef.current;
            if (prior) {
                prior.reject(new Error("Superseded by new download"));
                pendingDownloadRef.current = null;
            }
            setError(null);
            setModelProgress(0);
            setDownloadedBytes(0);
            setTotalBytes(0);
            setLoadingModelId(modelId);
            setStatus("loading-model");
            return new Promise<void>((resolve, reject) => {
                pendingDownloadRef.current = { id: modelId, resolve, reject };
                const modelCfg = TRANSCRIPTION_MODELS.find(m => m.model_id === modelId);
                const modelDtype = modelCfg?.dtype;
                const webgpu_only = modelCfg?.webgpu_only;
                fetchModelFileSizes(modelId)
                    .then(fileSizes => {
                        sendToWorker({ type: "load", modelId, fileSizes, dtype: modelDtype, webgpu_only, language: languageRef.current });
                    })
                    .catch(err => {
                        console.error("Failed to fetch file sizes, continuing without size info:", err);
                        sendToWorker({ type: "load", modelId, dtype: modelDtype, webgpu_only, language: languageRef.current });
                    });
            });
        },
        [sendToWorker]
    );

    const startRecording = useCallback(async () => {
        if (status === "recording" || recordingState === "recording") return;
        if (!enabled || !downloadedModels.includes(selectedModelId)) {
            setError("Transcription model not ready");
            return;
        }
        setError(null);
        setTranscript("");

        // Ensure worker has the model loaded (cache hit resolves instantly).
        // Pass language here too so the worker is in sync even without a prior set-language message.
        if (loadedModelIdRef.current !== selectedModelId) {
            sendToWorker({ type: "load", modelId: selectedModelId, language: languageRef.current });
            loadedModelIdRef.current = selectedModelId;
        }

        // Sync language before frames start arriving
        sendToWorker({ type: "set-language", language: languageRef.current });

        try {
            await startAudioRecording((frame: Float32Array) => {
                // Transfer ownership of the buffer to avoid a copy on every frame.
                sendToWorker({ type: "audio-frame", buffer: frame }, [frame.buffer]);
            });
            setStatus("recording");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    }, [status, recordingState, enabled, downloadedModels, selectedModelId, startAudioRecording, sendToWorker]);

    const stopAndTranscribe = useCallback(async () => {
        if (recordingState !== "recording") return;
        stopRecording();
        setStatus("transcribing");
        sendToWorker({ type: "stop-recording" });
    }, [recordingState, stopRecording, sendToWorker]);

    const value = useMemo<ITranscriptionSettings>(
        () => ({
            enabled,
            setEnabled,
            selectedModelId,
            setSelectedModelId,
            downloadedModels,
            isModelReady: enabled && downloadedModels.includes(selectedModelId),
            status,
            modelProgress,
            downloadedBytes,
            totalBytes,
            transcript,
            error,
            loadingModelId,
            language,
            setLanguage,
            downloadModel,
            startRecording,
            stopAndTranscribe
        }),
        [
            enabled,
            setEnabled,
            selectedModelId,
            setSelectedModelId,
            downloadedModels,
            status,
            modelProgress,
            downloadedBytes,
            totalBytes,
            transcript,
            error,
            loadingModelId,
            language,
            setLanguage,
            downloadModel,
            startRecording,
            stopAndTranscribe
        ]
    );

    return <TranscriptionSettingsContext.Provider value={value}>{props.children}</TranscriptionSettingsContext.Provider>;
};
