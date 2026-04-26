import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
import { DEFAULT_TRANSCRIPTION_MODEL, TRANSCRIPTION_MODELS } from "../../config/transcriptionModels";
import type { WorkerInMessage, WorkerOutMessage } from "../../workers/transcription.worker";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { fetchModelFileSizes } from "../../utils/modelSizeUtils";

export type TranscriptionStatus = "idle" | "loading-model" | "recording" | "transcribing" | "error";
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

const TARGET_SAMPLE_RATE = 16000;
// Keep interim transcriptions from re-decoding a growing buffer every tick:
// cap audio at the most recent INTERIM_WINDOW_SECONDS so cost stays bounded.
const INTERIM_WINDOW_SECONDS = 15;

async function resampleAudioTo16kHz(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    // AudioContext resamples implicitly to its sampleRate when decoding.
    const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    try {
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        if (decoded.numberOfChannels === 1) {
            return decoded.getChannelData(0);
        }
        const n = decoded.length;
        const mono = new Float32Array(n);
        const scale = 1 / decoded.numberOfChannels;
        for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
            const data = decoded.getChannelData(ch);
            for (let i = 0; i < n; i++) mono[i] += data[i] * scale;
        }
        return mono;
    } finally {
        await audioCtx.close();
    }
}

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
    const [language, setLanguageState] = useState<TranscriptionLanguage>(undefined);

    const workerRef = useRef<Worker | null>(null);
    const languageRef = useRef<TranscriptionLanguage>(undefined);
    const loadedModelIdRef = useRef<string | null>(null);
    const pendingDownloadRef = useRef<{ id: string; resolve: () => void; reject: (err: Error) => void } | null>(null);
    const isResamplingRef = useRef(false);

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

    const markDownloaded = useCallback((id: string) => {
        setDownloadedModels(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const sendToWorker = useCallback((msg: WorkerInMessage) => {
        workerRef.current?.postMessage(msg);
    }, []);

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
                    }
                    setModelProgress(100);
                    setLoadingModelId(null);
                    setStatus(prev => (prev === "loading-model" ? "idle" : prev));
                    break;
                }
                case "chunk":
                    setTranscript(msg.text);
                    break;
                case "complete":
                    setTranscript(msg.text);
                    setStatus("idle");
                    break;
                case "error": {
                    const pending = pendingDownloadRef.current;
                    if (pending) {
                        pending.reject(new Error(msg.message));
                        pendingDownloadRef.current = null;
                    }
                    setError(msg.message);
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
        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, [markDownloaded]);

    const setEnabled = useCallback((v: boolean) => setEnabledState(v), []);
    const setSelectedModelId = useCallback((id: string) => setSelectedModelIdState(id), []);
    const setLanguage = useCallback((lang: TranscriptionLanguage) => setLanguageState(lang), []);

    const downloadModel = useCallback(
        (modelId: string): Promise<void> => {
            if (!workerRef.current) return Promise.reject(new Error("Worker not ready"));
            // Reject any in-flight download before starting a new one
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
                // Fetch file sizes in parallel
                const modelDtype = TRANSCRIPTION_MODELS.find(m => m.model_id === modelId)?.dtype;
                fetchModelFileSizes(modelId)
                    .then(fileSizes => {
                        sendToWorker({ type: "load", modelId, fileSizes, dtype: modelDtype });
                    })
                    .catch(err => {
                        console.error("Failed to fetch file sizes, continuing without size info:", err);
                        sendToWorker({ type: "load", modelId, dtype: modelDtype });
                    });
            });
        },
        [sendToWorker]
    );

    const handleInterimBlob = useCallback(
        async (blob: Blob) => {
            if (isResamplingRef.current) return;
            isResamplingRef.current = true;
            try {
                const full = await resampleAudioTo16kHz(blob);
                const maxSamples = INTERIM_WINDOW_SECONDS * TARGET_SAMPLE_RATE;
                const audio = full.length > maxSamples ? full.slice(-maxSamples) : full;
                sendToWorker({ type: "transcribe", audio, language: languageRef.current, interim: true });
            } catch {
                // ignore interim errors; final run will retry
            } finally {
                isResamplingRef.current = false;
            }
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
        // Ensure worker has the selected model loaded (cache hit is fast)
        if (loadedModelIdRef.current !== selectedModelId) {
            sendToWorker({ type: "load", modelId: selectedModelId });
            loadedModelIdRef.current = selectedModelId;
        }
        try {
            await startAudioRecording(handleInterimBlob);
            setStatus("recording");
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
    }, [status, recordingState, enabled, downloadedModels, selectedModelId, startAudioRecording, handleInterimBlob, sendToWorker]);

    const stopAndTranscribe = useCallback(async () => {
        if (recordingState !== "recording") return;
        const blob = await stopRecording();
        if (!blob) return;
        setStatus("transcribing");
        try {
            const audio = await resampleAudioTo16kHz(blob);
            sendToWorker({ type: "transcribe", audio, language: languageRef.current, interim: false });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setStatus("error");
        }
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
