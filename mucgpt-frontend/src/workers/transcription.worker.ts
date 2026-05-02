/* eslint-disable @typescript-eslint/no-explicit-any */

export type WorkerInMessage =
    | { type: "load"; modelId: string; fileSizes?: Record<string, number>; dtype?: Record<string, string> | string }
    | { type: "set-language"; language: string | undefined }
    | { type: "audio-frame"; buffer: Float32Array }
    | { type: "stop-recording" }
    | { type: "abort" };

export type WorkerOutMessage =
    | { type: "progress"; progress: number; downloadedBytes?: number; totalBytes?: number }
    | { type: "ready" }
    | { type: "segment"; text: string }
    | { type: "recording_start" }
    | { type: "complete" }
    | { type: "error"; message: string };

const SAMPLE_RATE = 16000;
const MAX_BUFFER_DURATION = 30;
const SPEECH_THRESHOLD = 0.3;
const EXIT_THRESHOLD = 0.1;
const MIN_SILENCE_DURATION_SAMPLES = Math.floor(0.4 * SAMPLE_RATE);
const MIN_SPEECH_DURATION_SAMPLES = Math.floor(0.25 * SAMPLE_RATE);
const SPEECH_PAD_SAMPLES = Math.floor(0.1 * SAMPLE_RATE);
const MAX_NUM_PREV_BUFFERS = 4;
const VAD_MODEL_ID = "onnx-community/silero-vad";

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
let isLoading = false;
let hasWebGPU = false;
let currentLanguage: string | undefined = undefined;
let inferenceChain: Promise<void> = Promise.resolve();

// Serialise VAD processing: frames must be processed one at a time to keep
// the LSTM hidden states consistent.
let frameQueue: Float32Array[] = [];
let isProcessingFrame = false;
let isStopPending = false;

function detectWebGPU(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}

function wasmSafeDtype(dtype: Record<string, string> | string): Record<string, string> | string {
    if (typeof dtype === "string") return dtype === "q4f16" ? "q4" : dtype;
    return Object.fromEntries(Object.entries(dtype).map(([k, v]) => [k, v === "q4f16" ? "q4" : v]));
}

async function loadModel(modelId: string, fileSizes?: Record<string, number>, modelDtype?: Record<string, string> | string) {
    console.log("[transcription-worker] loadModel called", { modelId, fileSizes, modelDtype });

    if (!modelId) {
        console.error("[transcription-worker] loadModel aborted: missing modelId");
        self.postMessage({ type: "error", message: "Missing modelId" } satisfies WorkerOutMessage);
        return;
    }
    if (transcriber && vadModel && loadedModelId === modelId) {
        console.log("[transcription-worker] model already loaded, posting ready", { loadedModelId });
        self.postMessage({ type: "ready" } satisfies WorkerOutMessage);
        return;
    }
    if (isLoading) {
        console.warn("[transcription-worker] loadModel called while already loading — ignoring");
        return;
    }

    console.log("[transcription-worker] starting model load, clearing previous state");
    transcriber = null;
    vadModel = null;
    loadedModelId = null;
    isLoading = true;

    try {
        console.log("[transcription-worker] importing @huggingface/transformers");
        const { pipeline, AutoModel, Tensor, env } = await import("@huggingface/transformers");
        TensorCtor = Tensor;
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        console.log("[transcription-worker] transformers imported, env configured", {
            allowLocalModels: env.allowLocalModels,
            useBrowserCache: env.useBrowserCache
        });

        hasWebGPU = detectWebGPU();
        console.log("[transcription-worker] WebGPU detection result:", hasWebGPU);

        const device = hasWebGPU ? "webgpu" : "wasm";
        const baseDtype =
            modelDtype !== undefined
                ? modelDtype
                : hasWebGPU
                  ? { encoder_model: "fp32", decoder_model_merged: "q4" }
                  : { encoder_model: "fp32", decoder_model_merged: "q8" };
        const dtype = hasWebGPU ? baseDtype : wasmSafeDtype(baseDtype);
        console.log("[transcription-worker] device and dtype resolved", { device, dtype });

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

        console.log("[transcription-worker] loading Whisper pipeline", { modelId, device, dtype });
        transcriber = await (pipeline as any)("automatic-speech-recognition", modelId, {
            device,
            dtype,
            progress_callback: (info: { status: string; file?: string; progress?: number }) => {
                if (!info.file) return;
                if (info.status === "initiate" || info.status === "download") {
                    console.log(`[transcription-worker] whisper download initiate: ${info.file}`);
                    fileProgress.set(info.file, 0);
                    postCombined();
                } else if (info.status === "progress" && info.progress !== undefined) {
                    fileProgress.set(info.file, info.progress);
                    postCombined();
                } else if (info.status === "done") {
                    console.log(`[transcription-worker] whisper file done: ${info.file}`);
                    fileProgress.set(info.file, 100);
                    postCombined();
                } else {
                    console.log(`[transcription-worker] whisper progress callback status="${info.status}" file="${info.file}"`);
                }
            }
        });
        console.log("[transcription-worker] Whisper pipeline loaded successfully");

        // Warmup: compile shaders / prime WASM JIT with a silent buffer.
        console.log("[transcription-worker] running warmup inference");
        try {
            await transcriber(new Float32Array(SAMPLE_RATE));
            console.log("[transcription-worker] warmup complete");
        } catch (warmupErr) {
            console.warn("[transcription-worker] warmup failed (non-fatal):", warmupErr);
        }

        // VAD is tiny (~1.5 MB) and always runs on WASM to avoid GPU contention
        // with small repeated inferences.
        console.log("[transcription-worker] loading VAD model", { VAD_MODEL_ID });
        vadModel = await (AutoModel as any).from_pretrained(VAD_MODEL_ID, {
            config: { model_type: "custom" },
            dtype: "fp32",
            device: "wasm"
        });
        console.log("[transcription-worker] VAD model loaded successfully");

        // onnx-community/silero-vad v5 uses a single combined state tensor [2, 1, 128]
        vadState = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);
        srTensor = new Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), [1]);
        console.log("[transcription-worker] VAD tensors initialised", { sampleRate: SAMPLE_RATE });

        loadedModelId = modelId;
        console.log("[transcription-worker] init complete, posting ready", { loadedModelId });
        self.postMessage({ type: "ready" } satisfies WorkerOutMessage);
    } catch (err) {
        console.error("[transcription-worker] loadModel failed:", err);
        self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
    } finally {
        isLoading = false;
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

function dispatchSegmentToWhisper(audio: Float32Array): void {
    const language = currentLanguage;
    inferenceChain = inferenceChain
        .then(async () => {
            const result = await transcriber(audio, { language, task: "transcribe" });
            const text = (result as { text: string }).text?.trim() ?? "";
            if (text) {
                self.postMessage({ type: "segment", text } satisfies WorkerOutMessage);
            }
        })
        .catch((err: unknown) => {
            self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
        });
}

async function processAudioFrame(frame: Float32Array): Promise<void> {
    if (isStopPending || !vadModel || !transcriber) return;

    const prob = await runVAD(frame);

    // Double-check after async VAD call — stop may have arrived during inference.
    if (isStopPending) return;

    const isSpeech = prob > SPEECH_THRESHOLD || (isRecording && prob >= EXIT_THRESHOLD);

    if (!isRecording && !isSpeech) {
        prevBuffers.push(frame.slice());
        if (prevBuffers.length > MAX_NUM_PREV_BUFFERS) prevBuffers.shift();
        return;
    }

    if (!isRecording && isSpeech) {
        isRecording = true;
        postSpeechSamples = 0;
        self.postMessage({ type: "recording_start" } satisfies WorkerOutMessage);
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
            dispatchSegmentToWhisper(buildPaddedBuffer());
        }
        const tailSize = SPEECH_PAD_SAMPLES;
        BUFFER.copyWithin(0, BUFFER.length - tailSize);
        bufferPointer = tailSize;
        postSpeechSamples = 0;
        prevBuffers = [];
    } else if (silenceThresholdReached) {
        if (bufferPointer >= MIN_SPEECH_DURATION_SAMPLES) {
            dispatchSegmentToWhisper(buildPaddedBuffer());
        }
        bufferPointer = 0;
        isRecording = false;
        postSpeechSamples = 0;
        prevBuffers = [];
    }
}

async function drainFrameQueue(): Promise<void> {
    while (frameQueue.length > 0 && !isStopPending) {
        const frame = frameQueue.shift()!;
        await processAudioFrame(frame);
    }
    isProcessingFrame = false;
}

function enqueueFrame(frame: Float32Array): void {
    isStopPending = false;
    frameQueue.push(frame);
    if (!isProcessingFrame) {
        isProcessingFrame = true;
        drainFrameQueue();
    }
}

function handleStopRecording(): void {
    isStopPending = true;
    frameQueue = [];
    isProcessingFrame = false;

    // Flush whatever speech is buffered before the stop signal arrived.
    if (isRecording && bufferPointer >= MIN_SPEECH_DURATION_SAMPLES) {
        dispatchSegmentToWhisper(buildPaddedBuffer());
    }

    bufferPointer = 0;
    isRecording = false;
    postSpeechSamples = 0;
    prevBuffers = [];

    // Reset VAD LSTM state so the next recording starts clean.
    if (vadState) vadState.data.fill(0);

    // Signal completion only after all queued Whisper calls have resolved.
    inferenceChain = inferenceChain
        .then(() => {
            self.postMessage({ type: "complete" } satisfies WorkerOutMessage);
        })
        .catch((err: unknown) => {
            self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
        });
}

self.addEventListener("message", (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data;
    console.log("[transcription-worker] received message type:", msg.type);
    switch (msg.type) {
        case "load":
            loadModel(msg.modelId, msg.fileSizes, msg.dtype);
            break;
        case "set-language":
            currentLanguage = msg.language;
            break;
        case "audio-frame":
            enqueueFrame(msg.buffer);
            break;
        case "stop-recording":
            handleStopRecording();
            break;
        case "abort":
            break;
    }
});
