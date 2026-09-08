/* eslint-disable @typescript-eslint/no-explicit-any */

export type WorkerInMessage =
    | {
          type: "load";
          requestId: number;
          modelId: string;
          fileSizes?: Record<string, number>;
          dtype?: Record<string, string> | string;
          webgpu_only?: boolean;
          language?: string;
      }
    | { type: "set-language"; language: string | undefined }
    | { type: "start-recording"; sessionId: number }
    | { type: "audio-frame"; sessionId: number; buffer: Float32Array }
    | { type: "stop-recording"; sessionId: number }
    | { type: "abort" };

export type WorkerOutMessage =
    | { type: "progress"; progress: number; downloadedBytes?: number; totalBytes?: number }
    | { type: "ready"; requestId: number; modelId: string }
    | { type: "segment"; sessionId: number; text: string }
    | { type: "recording_start"; sessionId: number }
    | { type: "complete"; sessionId: number }
    | { type: "auto_stop"; sessionId: number }
    | { type: "error"; message: string; messageKey?: string; requestId?: number; sessionId?: number };

const SAMPLE_RATE = 16000;
const MAX_BUFFER_DURATION = 30;
const SPEECH_THRESHOLD = 0.3;
const EXIT_THRESHOLD = 0.1;
const MIN_SILENCE_DURATION_SAMPLES = Math.floor(0.4 * SAMPLE_RATE);
const MIN_SPEECH_DURATION_SAMPLES = Math.floor(0.25 * SAMPLE_RATE);
const SPEECH_PAD_SAMPLES = Math.floor(0.1 * SAMPLE_RATE);
const MAX_NUM_PREV_BUFFERS = 4;
const MAX_QUEUE_FRAMES = Math.ceil((MAX_BUFFER_DURATION * SAMPLE_RATE) / 512); // ~937 (30 s)
const AUTO_STOP_SILENCE_MS = 2000;
const VAD_MODEL_ID = "onnx-community/silero-vad";

const isDev = import.meta.env.DEV;
const log = isDev ? console.log.bind(console) : () => {};
const warn = isDev ? console.warn.bind(console) : () => {};

// Persistent audio buffer for the current speech segment
const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let bufferPointer = 0;
let isRecording = false;
let postSpeechSamples = 0;
let prevBuffers: Float32Array[] = []; // pre-speech lookback for context padding

// Model state
let transcriber: any = null;
let vadModel: any = null;
let vadState: any = null; // Float32[2, 1, 128] — Silero v5 combined LSTM state
let srTensor: any = null;
let TensorCtor: any = null;

let loadedModelId: string | null = null;
let loadingModelId: string | null = null;
let isLoading = false;
let queuedLoad: Extract<WorkerInMessage, { type: "load" }> | null = null;
let hasWebGPU = false;
let currentLanguage: string | undefined = undefined;
let inferenceChain: Promise<void> = Promise.resolve();

// Serialise VAD processing: frames must be processed one at a time to keep
// the LSTM hidden states consistent.
let frameQueue: Float32Array[] = [];
let isProcessingFrame = false;
let isStopPending = false;
let activeSessionId: number | null = null;
let frameProcessingPromise: Promise<void> = Promise.resolve();
const failedSessions = new Set<number>();

// Auto-stop: fire after AUTO_STOP_SILENCE_MS of silence following speech.
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
let hasSpeechOccurred = false;

function scheduleAutoStop(sessionId: number): void {
    if (autoStopTimer !== null) clearTimeout(autoStopTimer);
    if (!hasSpeechOccurred) return;
    autoStopTimer = setTimeout(() => {
        autoStopTimer = null;
        self.postMessage({ type: "auto_stop", sessionId } satisfies WorkerOutMessage);
    }, AUTO_STOP_SILENCE_MS);
}

function cancelAutoStop(): void {
    if (autoStopTimer !== null) {
        clearTimeout(autoStopTimer);
        autoStopTimer = null;
    }
}

function detectWebGPU(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}

function wasmSafeDtype(dtype: Record<string, string> | string): Record<string, string> | string {
    if (typeof dtype === "string") return dtype === "q4f16" ? "q4" : dtype;
    return Object.fromEntries(Object.entries(dtype).map(([k, v]) => [k, v === "q4f16" ? "q4" : v]));
}

async function loadModel(request: Extract<WorkerInMessage, { type: "load" }>) {
    const { requestId, modelId, fileSizes, dtype: modelDtype, webgpu_only: webgpuOnly, language } = request;
    log("[transcription-worker] loadModel called", { modelId, fileSizes, modelDtype, language });
    if (language !== undefined) currentLanguage = language;

    if (!modelId) {
        console.error("[transcription-worker] loadModel aborted: missing modelId");
        self.postMessage({ type: "error", requestId, message: "Missing modelId" } satisfies WorkerOutMessage);
        return;
    }
    if (transcriber && vadModel && loadedModelId === modelId) {
        log("[transcription-worker] model already loaded, posting ready", { loadedModelId });
        self.postMessage({ type: "ready", requestId, modelId } satisfies WorkerOutMessage);
        return;
    }
    if (isLoading) {
        // Keep only the newest request. Its response must not be confused with
        // the model currently being loaded.
        queuedLoad = request;
        return;
    }

    log("[transcription-worker] starting model load, clearing previous state");
    await transcriber?.dispose?.();
    await vadModel?.dispose?.();
    transcriber = null;
    vadModel = null;
    loadedModelId = null;
    loadingModelId = modelId;
    isLoading = true;

    try {
        log("[transcription-worker] importing @huggingface/transformers");
        const { pipeline, AutoModel, Tensor, env } = await import("@huggingface/transformers");
        TensorCtor = Tensor;
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        log("[transcription-worker] transformers imported, env configured", {
            allowLocalModels: env.allowLocalModels,
            useBrowserCache: env.useBrowserCache
        });

        hasWebGPU = detectWebGPU();
        log("[transcription-worker] WebGPU detection result:", hasWebGPU);

        if (webgpuOnly && !hasWebGPU) {
            self.postMessage({
                type: "error",
                requestId,
                message: "This model requires WebGPU, which is not available in your browser. Try Chrome/Edge 113+ or select Whisper Small.",
                messageKey: "transcriptionSettings.webgpu_only_error"
            } satisfies WorkerOutMessage);
            return;
        }

        const device = hasWebGPU ? "webgpu" : "wasm";
        const baseDtype =
            modelDtype !== undefined
                ? modelDtype
                : hasWebGPU
                  ? { encoder_model: "fp32", decoder_model_merged: "q4" }
                  : { encoder_model: "fp32", decoder_model_merged: "q8" };
        const dtype = hasWebGPU ? baseDtype : wasmSafeDtype(baseDtype);
        log("[transcription-worker] device and dtype resolved", { device, dtype });

        const fileProgress = new Map<string, number>();

        const postCombined = () => {
            let downloadedBytes = 0;
            let knownTotalBytes = 0;
            fileProgress.forEach((percent, file) => {
                const fileSize = fileSizes?.[file] ?? 0;
                downloadedBytes += (fileSize * percent) / 100;
                knownTotalBytes += fileSize;
            });

            if (knownTotalBytes === 0) {
                const values = [...fileProgress.values()];
                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : -1;
                self.postMessage({ type: "progress", progress: avg } satisfies WorkerOutMessage);
            } else {
                const progress = Math.min(99, Math.round((downloadedBytes / knownTotalBytes) * 100));
                self.postMessage({
                    type: "progress",
                    progress,
                    downloadedBytes: Math.round(downloadedBytes / 1024 / 1024),
                    totalBytes: Math.round(knownTotalBytes / 1024 / 1024)
                } satisfies WorkerOutMessage);
            }
        };

        log("[transcription-worker] loading Whisper pipeline", { modelId, device, dtype });
        transcriber = await (pipeline as any)("automatic-speech-recognition", modelId, {
            device,
            dtype,
            progress_callback: (info: { status: string; file?: string; progress?: number }) => {
                if (!info.file) return;
                if (info.status === "initiate" || info.status === "download") {
                    log(`[transcription-worker] whisper download initiate: ${info.file}`);
                    fileProgress.set(info.file, 0);
                    postCombined();
                } else if (info.status === "progress" && info.progress !== undefined) {
                    fileProgress.set(info.file, info.progress);
                    postCombined();
                } else if (info.status === "done") {
                    log(`[transcription-worker] whisper file done: ${info.file}`);
                    fileProgress.set(info.file, 100);
                    postCombined();
                } else {
                    log(`[transcription-worker] whisper progress callback status="${info.status}" file="${info.file}"`);
                }
            }
        });
        log("[transcription-worker] Whisper pipeline loaded successfully");

        // Warmup: compile shaders / prime WASM JIT with a silent buffer.
        log("[transcription-worker] running warmup inference");
        try {
            await transcriber(new Float32Array(SAMPLE_RATE), { language: currentLanguage ?? "en" });
            log("[transcription-worker] warmup complete");
        } catch (warmupErr) {
            warn("[transcription-worker] warmup failed (non-fatal):", warmupErr);
        }

        // VAD is tiny (~1.5 MB) and always runs on WASM to avoid GPU contention
        // with small repeated inferences.
        log("[transcription-worker] loading VAD model", { VAD_MODEL_ID });
        vadModel = await (AutoModel as any).from_pretrained(VAD_MODEL_ID, {
            config: { model_type: "custom" },
            dtype: "fp32",
            device: "wasm"
        });
        log("[transcription-worker] VAD model loaded successfully");

        // onnx-community/silero-vad v5 uses a single combined state tensor [2, 1, 128]
        vadState = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);
        srTensor = new Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), [1]);
        log("[transcription-worker] VAD tensors initialised", { sampleRate: SAMPLE_RATE });

        loadedModelId = modelId;
        log("[transcription-worker] init complete, posting ready", { loadedModelId });
        self.postMessage({ type: "ready", requestId, modelId } satisfies WorkerOutMessage);
    } catch (err) {
        console.error("[transcription-worker] loadModel failed:", err);
        self.postMessage({ type: "error", requestId, message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
    } finally {
        isLoading = false;
        loadingModelId = null;
        const nextLoad = queuedLoad;
        queuedLoad = null;
        if (nextLoad && nextLoad.requestId !== requestId) void loadModel(nextLoad);
    }
}

async function runVAD(frame: Float32Array): Promise<number> {
    const input = new TensorCtor("float32", frame, [1, frame.length]);
    const result = await vadModel({ input, sr: srTensor, state: vadState });
    vadState = result.stateN;
    return result.output.data[0] as number;
}

function buildPaddedBuffer(): Float32Array {
    const padEnd = Math.min(bufferPointer + SPEECH_PAD_SAMPLES, BUFFER.length);
    const speechData = BUFFER.slice(0, padEnd);
    const lookbackLen = prevBuffers.reduce((acc, b) => acc + b.length, 0);
    const paddedBuffer = new Float32Array(lookbackLen + speechData.length);
    let offset = 0;
    for (const pb of prevBuffers) {
        paddedBuffer.set(pb, offset);
        offset += pb.length;
    }
    paddedBuffer.set(speechData, offset);
    return paddedBuffer;
}

function dispatchSegmentToWhisper(sessionId: number, audio: Float32Array): void {
    const language = currentLanguage;
    inferenceChain = inferenceChain
        .then(async () => {
            if (activeSessionId !== sessionId) return;
            const result = await transcriber(audio, { language, task: "transcribe" });
            if (activeSessionId !== sessionId) return;
            const text = (result as { text: string }).text?.trim() ?? "";
            if (text) {
                self.postMessage({ type: "segment", sessionId, text } satisfies WorkerOutMessage);
            }
        })
        .catch((err: unknown) => {
            failedSessions.add(sessionId);
            self.postMessage({ type: "error", sessionId, message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
        });
}

async function processAudioFrame(sessionId: number, frame: Float32Array): Promise<void> {
    if (activeSessionId !== sessionId || isStopPending || !vadModel || !transcriber) return;

    const prob = await runVAD(frame);

    // Double-check after async VAD call — stop may have arrived during inference.
    if (activeSessionId !== sessionId || isStopPending) return;

    const isSpeech = prob > SPEECH_THRESHOLD || (isRecording && prob >= EXIT_THRESHOLD);

    if (!isRecording && !isSpeech) {
        prevBuffers.push(frame.slice());
        if (prevBuffers.length > MAX_NUM_PREV_BUFFERS) prevBuffers.shift();
        return;
    }

    if (!isRecording && isSpeech) {
        isRecording = true;
        postSpeechSamples = 0;
        hasSpeechOccurred = true;
        cancelAutoStop();
        self.postMessage({ type: "recording_start", sessionId } satisfies WorkerOutMessage);
    }

    if (!isSpeech) {
        postSpeechSamples += frame.length;
    } else {
        postSpeechSamples = 0;
    }

    // Append frame to accumulation buffer (clamp to available space)
    const available = BUFFER.length - bufferPointer;
    const toCopy = Math.min(frame.length, available);
    BUFFER.set(frame.subarray(0, toCopy), bufferPointer);
    bufferPointer += toCopy;

    const isBufferFull = bufferPointer >= BUFFER.length;
    const silenceThresholdReached = postSpeechSamples >= MIN_SILENCE_DURATION_SAMPLES;

    if (isBufferFull) {
        // Mid-speech overflow: flush current segment and keep a short tail so the
        // next segment has some context (avoids cut-off words at boundaries).
        if (bufferPointer >= MIN_SPEECH_DURATION_SAMPLES) {
            dispatchSegmentToWhisper(sessionId, buildPaddedBuffer());
        }
        const tailSize = SPEECH_PAD_SAMPLES;
        BUFFER.copyWithin(0, BUFFER.length - tailSize);
        bufferPointer = tailSize;
        postSpeechSamples = 0;
        prevBuffers = [];
    } else if (silenceThresholdReached) {
        if (bufferPointer >= MIN_SPEECH_DURATION_SAMPLES) {
            dispatchSegmentToWhisper(sessionId, buildPaddedBuffer());
        }
        bufferPointer = 0;
        isRecording = false;
        postSpeechSamples = 0;
        prevBuffers = [];
        scheduleAutoStop(sessionId);
    }
}

async function drainFrameQueue(sessionId: number): Promise<void> {
    while (frameQueue.length > 0 && activeSessionId === sessionId && !isStopPending) {
        // Suspend drain until models are ready; frames stay in queue.
        // loadModel() will restart the drain once it posts "ready".
        if (!vadModel || !transcriber) {
            isProcessingFrame = false;
            return;
        }
        const frame = frameQueue.shift()!;
        await processAudioFrame(sessionId, frame);
    }
    isProcessingFrame = false;
}

function startFrameDrain(sessionId: number): void {
    if (isProcessingFrame || activeSessionId !== sessionId || isStopPending || frameQueue.length === 0) return;
    isProcessingFrame = true;
    frameProcessingPromise = drainFrameQueue(sessionId)
        .catch((err: unknown) => {
            failedSessions.add(sessionId);
            self.postMessage({ type: "error", sessionId, message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
        })
        .finally(() => {
            isProcessingFrame = false;
            if (activeSessionId !== null) startFrameDrain(activeSessionId);
        });
}

function enqueueFrame(sessionId: number, frame: Float32Array): void {
    if (activeSessionId !== sessionId || isStopPending) return;
    frameQueue.push(frame);
    // Evict oldest frames to cap memory at ~30 s while the model is loading.
    while (frameQueue.length > MAX_QUEUE_FRAMES) frameQueue.shift();
    startFrameDrain(sessionId);
}

function startRecording(sessionId: number): void {
    cancelAutoStop();
    activeSessionId = sessionId;
    isStopPending = false;
    hasSpeechOccurred = false;
    failedSessions.delete(sessionId);
    frameQueue = [];
    bufferPointer = 0;
    isRecording = false;
    postSpeechSamples = 0;
    prevBuffers = [];
    if (vadState) vadState.data.fill(0);
}

function handleStopRecording(sessionId: number): void {
    if (activeSessionId !== sessionId) return;
    cancelAutoStop();
    hasSpeechOccurred = false;
    isStopPending = true;
    frameQueue = [];

    // Flush whatever speech is buffered before the stop signal arrived.
    if (isRecording && bufferPointer >= MIN_SPEECH_DURATION_SAMPLES) {
        dispatchSegmentToWhisper(sessionId, buildPaddedBuffer());
    }

    bufferPointer = 0;
    isRecording = false;
    postSpeechSamples = 0;
    prevBuffers = [];

    // Reset VAD LSTM state so the next recording starts clean.
    if (vadState) vadState.data.fill(0);

    // Wait for both a VAD call already in flight and all queued Whisper calls.
    void Promise.all([frameProcessingPromise, inferenceChain]).then(() => {
        if (activeSessionId !== sessionId) return;
        if (!failedSessions.has(sessionId)) self.postMessage({ type: "complete", sessionId } satisfies WorkerOutMessage);
    });
}

self.addEventListener("message", (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data;
    log("[transcription-worker] received message type:", msg.type);
    switch (msg.type) {
        case "load":
            void loadModel(msg);
            break;
        case "set-language":
            currentLanguage = msg.language;
            break;
        case "start-recording":
            startRecording(msg.sessionId);
            break;
        case "audio-frame":
            enqueueFrame(msg.sessionId, msg.buffer);
            break;
        case "stop-recording":
            handleStopRecording(msg.sessionId);
            break;
        case "abort":
            break;
    }
});
