import type { PhononTTS } from "phonon-tts";
import type { TtsModel } from "../../config/ttsModels";

/** Aggregated model-download progress, in the shape the UI already knows from transcription. */
export interface TtsLoadProgress {
    /** 0..100, or -1 when no file reported a total size (indeterminate). */
    progress: number;
    downloadedBytes: number;
    totalBytes: number;
}

/**
 * Module-level phonon-tts instance state. The package keeps the model in a
 * dedicated Web Worker (~65 MB weights + WASM runtime), so exactly one
 * instance lives per page and is reused across answers.
 */
let instance: PhononTTS | null = null;
let instanceModelId: string | null = null;
let loadPromise: Promise<PhononTTS> | null = null;
/** Per-file byte counters of the load currently in flight (weights, tokenizer, config, voice). */
const progressByFile = new Map<string, { loaded: number; total: number | null }>();

/** Combines the per-file counters into one aggregate, mirroring the transcription worker's approach. */
function combinedProgress(): TtsLoadProgress {
    let loaded = 0;
    let total = 0;
    let anyTotalKnown = false;
    for (const file of progressByFile.values()) {
        loaded += file.loaded;
        if (file.total !== null) {
            anyTotalKnown = true;
            total += file.total;
        }
    }
    if (!anyTotalKnown || total === 0) return { progress: -1, downloadedBytes: loaded, totalBytes: 0 };
    return {
        progress: Math.min(99, Math.round((loaded / total) * 100)),
        downloadedBytes: loaded,
        totalBytes: total
    };
}

/**
 * Loads (or reuses) the phonon-tts instance for the configured checkpoint.
 * Files are cached in the browser Cache API by the package itself, so a later
 * session loads from disk; that cached load is fast but still reported via
 * `onProgress`.
 */
export async function loadTts(model: TtsModel, onProgress: (progress: TtsLoadProgress) => void): Promise<PhononTTS> {
    if (instance && instanceModelId === model.model_id) return instance;
    if (loadPromise) return loadPromise;

    // Phonon checkpoints cannot be loaded from gated repos in the browser
    // (no token): the model id must point to a public, permissively licensed
    // repo — enforced by the registry (`ttsModels.ts`).
    const { PhononTTS: Runtime } = await import("phonon-tts");
    progressByFile.clear();
    const load = Runtime.load({
        lang: model.lang,
        model: `hf://${model.model_id}@${model.revision}`,
        // WebGPU when the browser hands out a hardware adapter (q8 weights),
        // CPU otherwise — the package falls back on its own.
        device: "auto",
        onProgress: progress => {
            progressByFile.set(progress.file, { loaded: progress.loaded, total: progress.total });
            onProgress(combinedProgress());
        }
    })
        .then(loaded => {
            instance = loaded;
            instanceModelId = model.model_id;
            return loaded;
        })
        .catch((err: unknown) => {
            loadPromise = null;
            throw err;
        });
    loadPromise = load;
    return load;
}

/** The loaded instance for the model id, if any. */
export function getLoadedTts(modelId: string): PhononTTS | null {
    return instance && instanceModelId === modelId ? instance : null;
}

/** Disposes the instance (stops its worker and frees model memory). */
export async function disposeTts(): Promise<void> {
    const current = instance;
    instance = null;
    instanceModelId = null;
    loadPromise = null;
    await current?.dispose();
}
