/**
 * Browser-side validation harness for the PARAKEET TDT runtime: exercises the
 * shared transcriber with real ort-web WASM sessions against the
 * efederici/parakeet-tdt-0.6b-v3-onnx-int4 bundle (int4 MatMulNBits encoder +
 * int8 fused decoder_joint). Serves three QA purposes that the node spike
 * cannot: WASM MatMulNBits support on the pinned ort-web build, WASM heap
 * behaviour, and the dispose/reload cycle. Not wired into the app.
 *
 * Build (bundle the harness, keep ort-web external):
 *
 *   npx esbuild src/workers/nemo/spike/parakeetBrowserHarness.ts --bundle \
 *     --external:onnxruntime-web --format=esm \
 *     --outfile=<serve-dir>/parakeetBrowserHarness.js
 *
 * Serve <serve-dir> plus ort-web's *.mjs/*.wasm dist files and the model
 * files, then drive it from Playwright via the exported `parakeetQa` helper
 * (see the temp-dir index.html wiring).
 */
import * as ort from "onnxruntime-web";
import { createParakeetTranscriber } from "../parakeet/parakeetTranscriber";
import type { NemoVocab, OrtSessionLike, OrtValue } from "../types";
import { parseNemoVocab } from "../vocab";

/** Result string/timing summary emitted for the Playwright runner to assert on. */
export interface ParakeetQaResult {
    transcript: string;
    decodeSeconds: number;
    heapUsedMb?: number;
}

export interface ParakeetQaInput {
    encoderUrl: string;
    decoderUrl: string;
    vocabUrl: string;
    /** 16 kHz mono float32 PCM, sent from the runner as a plain JSON array. */
    pcm: number[];
}

/** Adapts structural OrtValue feeds into ort-web Tensors for session.run. */
/** Adapts structural OrtValue feeds into ort-web Tensors for session.run. */
function toTensors(feeds: Record<string, OrtValue>): Record<string, ort.Tensor> {
    const tensors: Record<string, ort.Tensor> = {};
    for (const [name, value] of Object.entries(feeds)) {
        const { data } = value;
        tensors[name] = new ort.Tensor(data as Float32Array, [...value.dims]);
    }
    return tensors;
}

/** Wraps one ort-web session into the structural OrtSessionLike contract. */
/** Wraps one ort-web session into the structural OrtSessionLike contract. */
function toSessionLike(session: ort.InferenceSession): OrtSessionLike {
    return {
        inputNames: session.inputNames,
        outputNames: session.outputNames,
        async run(feeds: Record<string, OrtValue>): Promise<Record<string, OrtValue>> {
            const result = await session.run(toTensors(feeds));
            const out: Record<string, OrtValue> = {};
            for (const [name, tensor] of Object.entries(result)) {
                out[name] = {
                    dims: tensor.dims,
                    data: tensor.data as Float32Array | BigInt64Array | Int32Array | Uint8Array | Int8Array
                };
            }
            return out;
        }
    };
}

/** Fetches a model file with byte/timing logs so browser-side stalls are attributable. */
async function fetchBuffer(url: string): Promise<Uint8Array> {
    const startedAt = performance.now();
    console.log(`[harness] fetching ${url}…`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`fetch failed for ${url}: ${response.status}`);
    const buffer = new Uint8Array(await response.arrayBuffer());
    console.log(`[harness] fetched ${url}: ${buffer.length}B in ${((performance.now() - startedAt) / 1000).toFixed(2)}s`);
    return buffer;
}

/** Graph optimization levels ort-web accepts; "disabled" isolates optimizer-time stalls. */
export type OptimizationLevel = "disabled" | "basic" | "all";

/** Session-create options for the WASM execution provider at the given optimization level. */
const sessionOptions = (level: OptimizationLevel) => ({
    executionProviders: ["wasm"] as const,
    graphOptimizationLevel: level
});

/** Creates exactly one WASM session and releases it; QA bisect probe for single models. */
export async function probeSession(url: string, level: OptimizationLevel = "all"): Promise<{ inputNames: string[]; createSeconds: number }> {
    const startedAt = performance.now();
    const session = await ort.InferenceSession.create(await fetchBuffer(url), sessionOptions(level));
    const createSeconds = (performance.now() - startedAt) / 1000;
    console.log(`[harness] session for ${url} created in ${createSeconds.toFixed(2)}s (inputs: ${session.inputNames.join(", ")})`);
    await session.release();
    return { inputNames: [...session.inputNames], createSeconds };
}

/** Loads one encoder/decoder_joint pair of real WASM sessions from URL bytes. */
export async function loadSessions(
    encoderUrl: string,
    decoderUrl: string,
    level: OptimizationLevel = "all"
): Promise<{ encoder: ort.InferenceSession; decoderJoint: ort.InferenceSession }> {
    console.log(`[harness] creating encoder session (WASM, int4 MatMulNBits, optimize=${level})…`);
    const encoder = await ort.InferenceSession.create(await fetchBuffer(encoderUrl), sessionOptions(level));
    console.log(`[harness] encoder ready (${encoder.inputNames.length} inputs); creating decoder_joint session…`);
    let decoderJoint: ort.InferenceSession;
    try {
        decoderJoint = await ort.InferenceSession.create(await fetchBuffer(decoderUrl), sessionOptions(level));
    } catch (err) {
        await encoder.release();
        throw err;
    }
    console.log(`[harness] decoder_joint ready; sessions up`);
    return { encoder, decoderJoint };
}

/** Runs one full transcription against real WASM sessions and releases them. */
export async function runTranscription(input: ParakeetQaInput, level: OptimizationLevel = "all"): Promise<ParakeetQaResult> {
    const sessionStartedAt = performance.now();
    const { encoder, decoderJoint } = await loadSessions(input.encoderUrl, input.decoderUrl, level);
    const sessionSeconds = (performance.now() - sessionStartedAt) / 1000;
    console.log(`[harness] sessions created in ${sessionSeconds.toFixed(2)}s`);

    const vocabResponse = await fetch(input.vocabUrl);
    if (!vocabResponse.ok) throw new Error(`vocab fetch failed: ${vocabResponse.status}`);
    const vocab: NemoVocab = parseNemoVocab(await vocabResponse.text());
    console.log(`[harness] vocab: ${vocab.idToToken.length} tokens, blank="${vocab.idToToken[vocab.idToToken.length - 1]}"`);

    const pcm = new Float32Array(input.pcm);
    let transcriber: ReturnType<typeof createParakeetTranscriber> | null = null;
    try {
        transcriber = createParakeetTranscriber({
            encoder: toSessionLike(encoder),
            decoderJoint: toSessionLike(decoderJoint),
            vocab
        });
        const decodeStartedAt = performance.now();
        const transcript = await transcriber.transcribe(pcm);
        const decodeSeconds = (performance.now() - decodeStartedAt) / 1000;
        console.log(`[harness] decode ${decodeSeconds.toFixed(2)}s, transcript="${transcript}"`);
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        return { transcript, decodeSeconds, heapUsedMb: memory ? memory.usedJSHeapSize / (1024 * 1024) : undefined };
    } finally {
        await transcriber?.dispose();
        await encoder.release();
        await decoderJoint.release();
    }
}

/** Configure ort-web like the production worker does (bundled binaries, single thread without COOP headers). */
export function configureOrtWeb(wasmPaths: string, numThreads = 1): void {
    ort.env.wasm.wasmPaths = wasmPaths;
    ort.env.wasm.numThreads = numThreads;
}

/** Minimal command surface for the Playwright runner. */
export const parakeetQa = { configureOrtWeb, loadSessions, probeSession, runTranscription };
