import type { TranscriptionModel } from "../config/transcriptionModels";
import { MODEL_CACHE_NAME } from "../workers/nemo/sessions";

/** Browser Cache Storage bucket used by @huggingface/transformers (Whisper + VAD). */
export const TRANSFORMERS_CACHE_NAME = "transformers-cache";

/** Escapes regex metacharacters so a literal string can be embedded in a RegExp. */
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when a Cache Storage request URL belongs to the given HuggingFace repo.
 * Matches the exact `/<modelId>/resolve/` path segment so that model ids sharing a
 * prefix (e.g. `whisper-large-v3-turbo` vs `whisper-large-v3-turbo-german-ONNX`)
 * do not collide.
 */
export function isModelCacheKey(url: string, modelId: string): boolean {
    return new RegExp(`/${escapeRegExp(modelId)}/resolve/`).test(url);
}

/** Removes every cached file of a single model from both Cache Storage buckets. */
export async function deleteModelFromCache(model: TranscriptionModel): Promise<void> {
    const fileUrls = model.files ? Object.values(model.files) : [];
    if (fileUrls.length > 0) {
        const nemoCache = await caches.open(MODEL_CACHE_NAME);
        await Promise.all(fileUrls.map(url => nemoCache.delete(url)));
    }

    const transformersCache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const keys = await transformersCache.keys();
    await Promise.all(keys.filter(request => isModelCacheKey(request.url, model.model_id)).map(request => transformersCache.delete(request)));
}

/**
 * Removes the cached files of all known transcription models. Shared artifacts
 * (VAD, onnxruntime WASM) are left untouched so they need not be re-downloaded.
 */
export async function clearModelCaches(models: TranscriptionModel[]): Promise<void> {
    await Promise.all(models.map(model => deleteModelFromCache(model)));
}
