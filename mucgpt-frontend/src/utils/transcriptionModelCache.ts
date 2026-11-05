import type { TranscriptionModel } from "../config/transcriptionModels";
import { MODEL_CACHE_NAME } from "../workers/nemo/sessions";

/** Browser Cache Storage bucket used by @huggingface/transformers (Whisper + VAD). */
export const TRANSFORMERS_CACHE_NAME = "transformers-cache";

/** Cache Storage bucket holding per-model verification markers ("this model was once loaded successfully"). */
export const MODEL_VERIFICATION_CACHE_NAME = "mucgpt-transcription-meta-v1";

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

/**
 * ONNX weight files a Transformers (Whisper) registry entry needs, derived from
 * its dtype configuration — the same name scheme @huggingface/transformers uses
 * (`onnx/<layer>_<dtype>.onnx`, a string dtype applies to every layer). An empty
 * result means the required set is unknown and any repo entry counts as present.
 */
function requiredTransformersFiles(model: TranscriptionModel): string[] {
    const dtype = model.dtype;
    if (!dtype) return [];
    const layers =
        typeof dtype === "string"
            ? [
                  ["encoder_model", dtype],
                  ["decoder_model_merged", dtype]
              ]
            : Object.entries(dtype);
    return layers.map(([layer, quantization]) => `onnx/${layer}_${quantization}.onnx`);
}

/**
 * Deterministic verification-marker key. It encodes the model id plus the runtime
 * and dtype from the registry, so changing a model's configuration invalidates
 * the marker instead of falsely reporting a stale download as ready.
 */
export function modelVerificationKey(model: TranscriptionModel): string {
    const runtime = model.runtime ?? "transformers";
    const dtype = model.dtype ? JSON.stringify(model.dtype) : "default";
    const encoded = encodeURIComponent(`${model.model_id}|${runtime}|${dtype}`);
    return `${location.origin}/__mucgpt__/transcription/verified/${encoded}`;
}

/** True when both Cache Storage buckets are usable (secure context). */
async function cachesAvailable(): Promise<boolean> {
    return typeof caches !== "undefined";
}

/** True when every required model file of the given model is present in its cache bucket. */
export async function hasModelFiles(model: TranscriptionModel): Promise<boolean> {
    if (!(await cachesAvailable())) return false;
    try {
        if (model.files) {
            const nemoCache = await caches.open(MODEL_CACHE_NAME);
            for (const url of Object.values(model.files)) {
                if (!(await nemoCache.match(url))) return false;
            }
            return true;
        }
        const transformersCache = await caches.open(TRANSFORMERS_CACHE_NAME);
        // A partially evicted cache (e.g. a delete that failed halfway) must not
        // count as downloaded: require every ONNX weight derived from the dtype.
        const required = requiredTransformersFiles(model);
        if (required.length > 0) {
            for (const file of required) {
                if (!(await transformersCache.match(`https://huggingface.co/${model.model_id}/resolve/main/${file}`))) return false;
            }
            return true;
        }
        const keys = await transformersCache.keys();
        return keys.some(request => isModelCacheKey(request.url, model.model_id));
    } catch {
        return false;
    }
}

/**
 * Contains all model files and was successfully loaded at least once. Only a
 * completed load proves the cached bytes are intact, so this marker is the
 * authoritative "downloaded and healthy" signal — cache presence alone can
 * neither detect partial eviction nor corruption.
 */
export async function isModelVerified(model: TranscriptionModel): Promise<boolean> {
    if (!(await cachesAvailable())) return false;
    try {
        const cache = await caches.open(MODEL_VERIFICATION_CACHE_NAME);
        return (await cache.match(modelVerificationKey(model))) !== undefined;
    } catch {
        return false;
    }
}

/** Marks the model as loaded successfully (called when the worker posts `ready`). */
export async function markModelVerified(model: TranscriptionModel): Promise<void> {
    if (!(await cachesAvailable())) return;
    const cache = await caches.open(MODEL_VERIFICATION_CACHE_NAME);
    await cache.put(new Request(modelVerificationKey(model)), new Response("ok"));
}

/** Invalidates the verification marker (e.g. after a failed load), keeping cached files for reuse. */
export async function clearModelVerification(model: TranscriptionModel): Promise<void> {
    if (!(await cachesAvailable())) return;
    const cache = await caches.open(MODEL_VERIFICATION_CACHE_NAME);
    await cache.delete(modelVerificationKey(model));
}

/**
 * True when the model can be loaded immediately: verified marker and all model
 * files are present. VAD artifacts (shared, tiny) may be absent; transformers.js
 * re-fetches them transparently.
 */
export async function isModelDownloaded(model: TranscriptionModel): Promise<boolean> {
    return (await isModelVerified(model)) && (await hasModelFiles(model));
}

/** Removes every cached file and the verification marker of a single model. */
export async function deleteModelFromCache(model: TranscriptionModel): Promise<void> {
    if (!(await cachesAvailable())) return;
    const fileUrls = model.files ? Object.values(model.files) : [];
    if (fileUrls.length > 0) {
        const nemoCache = await caches.open(MODEL_CACHE_NAME);
        await Promise.allSettled(fileUrls.map(url => nemoCache.delete(url)));
    }

    const transformersCache = await caches.open(TRANSFORMERS_CACHE_NAME);
    const keys = await transformersCache.keys();
    // allSettled: a single failing delete must not strand the other files or —
    // worse — skip the marker cleanup below, which would present a half-deleted
    // cache as a verified download on the next visit.
    await Promise.allSettled(keys.filter(request => isModelCacheKey(request.url, model.model_id)).map(request => transformersCache.delete(request)));

    await clearModelVerification(model);
}
