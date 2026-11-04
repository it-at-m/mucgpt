import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    hasModelFiles,
    isModelDownloaded,
    isModelVerified,
    markModelVerified,
    clearModelVerification,
    deleteModelFromCache,
    isModelCacheKey,
    modelVerificationKey
} from "./transcriptionModelCache";
import type { TranscriptionModel } from "../config/transcriptionModels";
import { MODEL_CACHE_NAME } from "../workers/nemo/sessions";

const turbo: TranscriptionModel = {
    model_id: "onnx-community/whisper-small",
    label: "Whisper Small",
    dtype: { encoder_model: "q4", decoder_model_merged: "int8" }
};

const canary: TranscriptionModel = {
    model_id: "istupakov/canary-180m-flash-onnx",
    label: "NVIDIA Canary 180M Flash",
    runtime: "canary",
    files: {
        encoder: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/encoder-model.int8.onnx",
        decoder: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/decoder-model.int8.onnx",
        vocab: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/vocab.txt"
    }
};

/** Minimal Cache double keyed by URL string, backed by a plain map that survives across opens. */
function createFakeCacheStore() {
    const stores = new Map<string, Map<string, Request>>();
    const open = vi.fn(async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name)!;
        return {
            match: async (request: RequestInfo | URL) => {
                const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
                return entries.has(url) ? new Response("cached") : undefined;
            },
            put: async (request: RequestInfo | URL, response: Response) => {
                const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
                entries.set(url, new Request(url));
                void response;
            },
            delete: async (request: RequestInfo | URL) => {
                const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
                return entries.delete(url);
            },
            keys: async () => [...entries.values()]
        };
    });
    return { open, stores };
}

let store: ReturnType<typeof createFakeCacheStore>;

beforeEach(() => {
    store = createFakeCacheStore();
    vi.stubGlobal("caches", { open: store.open });
    vi.stubGlobal("location", { origin: "https://mucgpt.test" });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("isModelCacheKey", () => {
    it("matches files of the exact HuggingFace repo", () => {
        expect(
            isModelCacheKey(
                `https://huggingface.co/onnx-community/whisper-large-v3-turbo/resolve/main/onnx/encoder_model_q4.onnx`,
                "onnx-community/whisper-large-v3-turbo"
            )
        ).toBe(true);
    });

    it("does not match repos that only share a prefix", () => {
        expect(
            isModelCacheKey(
                "https://huggingface.co/onnx-community/whisper-large-v3-turbo-german-ONNX/resolve/main/a.onnx",
                "onnx-community/whisper-large-v3-turbo"
            )
        ).toBe(false);
    });

    it("ignores unrelated hosts and models", () => {
        expect(isModelCacheKey("https://example.com/some-model/resolve/main/a.onnx", "some/model")).toBe(false);
        expect(isModelCacheKey("https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx", turbo.model_id)).toBe(false);
    });
});

describe("hasModelFiles / isModelVerified", () => {
    it("reports missing files for transformers models when the cache is empty", async () => {
        expect(await hasModelFiles(turbo)).toBe(false);
    });

    it("detects a transformers model by any cached repo entry", async () => {
        const cache = await (caches as unknown as { open: (name: string) => Promise<Cache> }).open("transformers-cache");
        await cache.put(`https://huggingface.co/${turbo.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("ok"));
        expect(await hasModelFiles(turbo)).toBe(true);
    });

    it("requires every NeMo file to be cached", async () => {
        const cache = await (caches as unknown as { open: (name: string) => Promise<Cache> }).open(MODEL_CACHE_NAME);
        await cache.put(canary.files!.encoder, new Response("ok"));
        await cache.put(canary.files!.decoder, new Response("ok"));
        expect(await hasModelFiles(canary)).toBe(false);
        await cache.put(canary.files!.vocab, new Response("ok"));
        expect(await hasModelFiles(canary)).toBe(true);
    });

    it("verification marker starts unset and can be written and cleared", async () => {
        expect(await isModelVerified(turbo)).toBe(false);
        await markModelVerified(turbo);
        expect(await isModelVerified(turbo)).toBe(true);
        await clearModelVerification(turbo);
        expect(await isModelVerified(turbo)).toBe(false);
    });

    it("isModelDownloaded requires marker and files", async () => {
        await markModelVerified(canary); // files missing -> not downloaded
        expect(await isModelDownloaded(canary)).toBe(false);
        const cache = await (caches as unknown as { open: (name: string) => Promise<Cache> }).open(MODEL_CACHE_NAME);
        await cache.put(canary.files!.encoder, new Response("ok"));
        await cache.put(canary.files!.decoder, new Response("ok"));
        await cache.put(canary.files!.vocab, new Response("ok"));
        expect(await isModelDownloaded(canary)).toBe(true);
        await clearModelVerification(canary); // files present but unverified -> not downloaded
        expect(await isModelDownloaded(canary)).toBe(false);
    });
});

describe("modelVerificationKey", () => {
    it("differs between model ids and between configurations of the same model", () => {
        const variant: TranscriptionModel = { ...turbo, dtype: { encoder_model: "q8", decoder_model_merged: "int8" } };
        const runtimeVariant: TranscriptionModel = { ...turbo, runtime: "canary" };
        const key = modelVerificationKey(turbo);
        expect(key).not.toBe(modelVerificationKey(variant));
        expect(key).not.toBe(modelVerificationKey(runtimeVariant));
        expect(key).toContain(encodeURIComponent(turbo.model_id));
    });
});

describe("deleteModelFromCache", () => {
    it("removes files, transformers entries and the verification marker", async () => {
        await markModelVerified(turbo);
        const transformersCache = await (caches as unknown as { open: (name: string) => Promise<Cache> }).open("transformers-cache");
        await transformersCache.put(`https://huggingface.co/${turbo.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("ok"));
        await transformersCache.put("https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx", new Response("ok"));

        await deleteModelFromCache(turbo);

        expect(await hasModelFiles(turbo)).toBe(false);
        expect(await isModelVerified(turbo)).toBe(false);
        // Shared artifacts of other repos survive
        expect(await hasModelFiles({ ...turbo, model_id: "onnx-community/silero-vad" } as TranscriptionModel)).toBe(true);
    });

    it("removes NeMo files and the marker", async () => {
        await markModelVerified(canary);
        const nemoCache = await (caches as unknown as { open: (name: string) => Promise<Cache> }).open(MODEL_CACHE_NAME);
        for (const url of Object.values(canary.files!)) await nemoCache.put(url, new Response("ok"));

        await deleteModelFromCache(canary);

        expect(await hasModelFiles(canary)).toBe(false);
        expect(await isModelVerified(canary)).toBe(false);
    });
});
