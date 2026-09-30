import type { OrtSessionLike, OrtValue } from "./types";

const MODEL_CACHE_NAME = "mucgpt-nemo-models-v1";

type OrtModule = {
    Tensor: new (data: Float32Array | BigInt64Array | Int32Array | Uint8Array | Int8Array, dims?: readonly number[]) => unknown;
    InferenceSession: {
        create(
            uri: ArrayBuffer | string,
            options?: Record<string, unknown>
        ): Promise<{
            inputNames: readonly string[];
            outputNames: readonly string[];
            run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>;
            /** ort-web >= 1.22 API: frees the WASM-side session resources. */
            release(): Promise<void>;
        }>;
    };
    env: {
        wasm: { wasmPaths?: string; numThreads?: number };
    };
};

let ortPromise: Promise<OrtModule> | null = null;

async function getOrt(): Promise<OrtModule> {
    if (!ortPromise) {
        ortPromise = import("onnxruntime-web") as unknown as Promise<OrtModule>;
    }
    return ortPromise;
}

/** Fetches model bytes with per-byte progress; backed by the browser Cache API so models download once. */
export async function fetchModelBytes(url: string, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
    const cache = await caches.open(MODEL_CACHE_NAME);
    let response = await cache.match(url);
    if (!response) {
        response = await fetch(url);
        if (!response.ok || !response.body) {
            throw new Error(`Model download failed (${response.status}): ${url}`);
        }
        const totalHeader = Number(response.headers.get("content-length") ?? 0);
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loaded = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            onProgress?.(loaded, totalHeader);
        }
        const bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        const cached = new Response(bytes.buffer, { headers: { "content-type": "application/octet-stream" } });
        await cache.put(url, cached);
        return bytes.buffer;
    }
    return response.arrayBuffer();
}

/** Small text assets (e.g. vocab.txt) through the same cache as the model binaries. */
export async function fetchTextCached(url: string): Promise<string> {
    const bytes = await fetchModelBytes(url);
    return new TextDecoder().decode(bytes);
}

/** Adapts a raw ort-web session to the structural OrtSessionLike contract, disposing via release(). */
function wrapSession(ort: OrtModule, session: Awaited<ReturnType<OrtModule["InferenceSession"]["create"]>>): OrtSessionLike {
    return {
        inputNames: session.inputNames,
        outputNames: session.outputNames,
        async run(feeds: Record<string, OrtValue>) {
            const ortFeeds: Record<string, unknown> = {};
            for (const [name, value] of Object.entries(feeds)) {
                ortFeeds[name] = new ort.Tensor(value.data, value.dims);
            }
            const rawOutputs = await session.run(ortFeeds);
            const outputs: Record<string, OrtValue> = {};
            for (const [name, tensor] of Object.entries(rawOutputs)) {
                const t = tensor as { dims: readonly number[]; data: OrtValue["data"] };
                outputs[name] = { dims: t.dims, data: t.data };
            }
            return outputs;
        },
        async dispose() {
            // The pinned ort-web build exposes release(), not dispose().
            await session.release();
        }
    };
}

/**
 * Creates an onnxruntime-web inference session from a model URL, downloading
 * through the Cache API-backed loader and wrapping the session in the
 * runtime-agnostic {@link OrtSessionLike} shape. Runs on the WASM execution
 * provider. The caller owns the session and should `dispose()` it.
 */
export async function createOrtSessionFromUrl(url: string, onProgress?: (loaded: number, total: number) => void): Promise<OrtSessionLike> {
    const ort = await getOrt();
    const bytes = await fetchModelBytes(url, onProgress);
    const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all"
    });
    return wrapSession(ort, session);
}
