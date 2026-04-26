/* eslint-disable @typescript-eslint/no-explicit-any */

export type WorkerInMessage =
    | { type: "load"; modelId: string; fileSizes?: Record<string, number> }
    | { type: "transcribe"; audio: Float32Array; language?: string; interim?: boolean }
    | { type: "abort" };

export type WorkerOutMessage =
    | { type: "progress"; progress: number; downloadedBytes?: number; totalBytes?: number }
    | { type: "ready" }
    | { type: "chunk"; text: string }
    | { type: "complete"; text: string }
    | { type: "error"; message: string };

const WHISPER_SAMPLE_RATE = 16000;

let transcriber: any = null;
let loadedModelId: string | null = null;
let isLoading = false;
let isWhisper = false;
let hasWebGPU = false;

let pendingTranscription: { audio: Float32Array; language?: string; interim: boolean } | null = null;
let isTranscribing = false;

function detectWebGPU(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}

function isWhisperModel(modelId: string): boolean {
    return /whisper/i.test(modelId);
}

async function loadModel(modelId: string, fileSizes?: Record<string, number>) {
    if (!modelId) {
        self.postMessage({ type: "error", message: "Missing modelId" } satisfies WorkerOutMessage);
        return;
    }
    if (transcriber && loadedModelId === modelId) {
        self.postMessage({ type: "ready" } satisfies WorkerOutMessage);
        return;
    }
    if (isLoading) return;
    transcriber = null;
    loadedModelId = null;
    isLoading = true;

    try {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        hasWebGPU = detectWebGPU();
        isWhisper = isWhisperModel(modelId);

        const device = hasWebGPU ? "webgpu" : "wasm";
        const dtype = isWhisper
            ? hasWebGPU
                ? { encoder_model: "fp32", decoder_model_merged: "q4" }
                : { encoder_model: "fp32", decoder_model_merged: "q8" }
            : hasWebGPU
              ? "fp32"
              : "q4";

        const totalBytes = fileSizes ? Object.values(fileSizes).reduce((a, b) => a + b, 0) : 0;
        const fileProgress = new Map<string, number>();

        const postCombined = () => {
            if (totalBytes === 0) {
                const values = [...fileProgress.values()];
                const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : -1;
                self.postMessage({ type: "progress", progress: avg } satisfies WorkerOutMessage);
            } else {
                let downloadedBytes = 0;
                fileProgress.forEach((percent, file) => {
                    const fileSize = fileSizes?.[file] ?? 0;
                    downloadedBytes += (fileSize * percent) / 100;
                });
                const progress = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
                self.postMessage({
                    type: "progress",
                    progress,
                    downloadedBytes: Math.round(downloadedBytes / 1024 / 1024),
                    totalBytes: Math.round(totalBytes / 1024 / 1024)
                } satisfies WorkerOutMessage);
            }
        };

        transcriber = await (pipeline as any)("automatic-speech-recognition", modelId, {
            device,
            dtype,
            progress_callback: (info: { status: string; file?: string; progress?: number }) => {
                if (!info.file) return;
                if (info.status === "initiate" || info.status === "download") {
                    fileProgress.set(info.file, 0);
                    postCombined();
                } else if (info.status === "progress" && info.progress !== undefined) {
                    fileProgress.set(info.file, info.progress);
                    postCombined();
                } else if (info.status === "done") {
                    fileProgress.set(info.file, 100);
                    postCombined();
                }
            }
        });

        // Warmup: compile shaders + prime caches with a 1-second silent buffer.
        // First real transcription then skips cold-start cost.
        try {
            await transcriber(new Float32Array(WHISPER_SAMPLE_RATE));
        } catch {
            // warmup failures are non-fatal
        }

        loadedModelId = modelId;
        self.postMessage({ type: "ready" } satisfies WorkerOutMessage);
    } catch (err) {
        self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
    } finally {
        isLoading = false;
    }
}

async function runTranscription(audio: Float32Array, language: string | undefined, interim: boolean) {
    isTranscribing = true;
    try {
        const kwargs: Record<string, unknown> = {
            language,
            task: "transcribe"
        };

        // Stream interim token updates for Whisper models — user sees text appear
        // as it's generated instead of waiting for full decode.
        if (isWhisper && interim && transcriber?.tokenizer) {
            try {
                const { TextStreamer } = await import("@huggingface/transformers");
                let streamed = "";
                const streamer = new TextStreamer(transcriber.tokenizer, {
                    skip_prompt: true,
                    skip_special_tokens: true,
                    callback_function: (delta: string) => {
                        streamed += delta;
                        const text = streamed.trim();
                        if (text) {
                            self.postMessage({ type: "chunk", text } satisfies WorkerOutMessage);
                        }
                    }
                });
                kwargs.streamer = streamer;
            } catch {
                // streamer optional — fall back to non-streaming
            }
        }

        const result = await (transcriber as any)(audio, kwargs);
        const text = (result as { text: string }).text?.trim() ?? "";
        self.postMessage((interim ? { type: "chunk", text } : { type: "complete", text }) satisfies WorkerOutMessage);
    } catch (err) {
        self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOutMessage);
    } finally {
        isTranscribing = false;
        if (pendingTranscription) {
            const next = pendingTranscription;
            pendingTranscription = null;
            await runTranscription(next.audio, next.language, next.interim);
        }
    }
}

async function transcribe(audio: Float32Array, language: string | undefined, interim: boolean) {
    if (!transcriber) {
        self.postMessage({ type: "error", message: "Model not loaded" } satisfies WorkerOutMessage);
        return;
    }

    if (isTranscribing) {
        pendingTranscription = { audio, language, interim };
        return;
    }
    await runTranscription(audio, language, interim);
}

self.addEventListener("message", (event: MessageEvent<WorkerInMessage>) => {
    const msg = event.data;
    switch (msg.type) {
        case "load":
            loadModel(msg.modelId, msg.fileSizes);
            break;
        case "transcribe":
            transcribe(msg.audio, msg.language, msg.interim ?? false);
            break;
        case "abort":
            break;
    }
});
