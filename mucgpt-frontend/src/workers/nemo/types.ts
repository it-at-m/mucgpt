/**
 * Minimal structural subset of the ONNX Runtime API used by the NeMo transcriber
 * runtimes. Declared here so the decode loops are runtime-agnostic: the browser
 * wiring passes ort-web sessions, node-side spike/validation passes
 * onnxruntime-node sessions. Data types are inferred from the TypedArray
 * constructor (Float32Array → float32, BigInt64Array → int64, …).
 */
export interface OrtValue {
    dims: readonly number[];
    data: Float32Array | BigInt64Array | Int32Array | Uint8Array | Int8Array;
}

export interface OrtSessionLike {
    inputNames: readonly string[];
    outputNames: readonly string[];
    run(feeds: Record<string, OrtValue>): Promise<Record<string, OrtValue>>;
    /** Releases WASM/GPU resources of the underlying session; optional so tests can use plain mocks. */
    dispose?(): Promise<void>;
}

export interface NemoVocab {
    /** Token string for every id (▁ already replaced by a space). */
    idToToken: string[];
    tokenToId: Map<string, number>;
}

/** A loaded ASR model that turns 16 kHz mono PCM into text for one utterance (≤ ~40 s). */
export interface NemoTranscriber {
    transcribe(audio: Float32Array, language?: string): Promise<string>;
    dispose(): Promise<void>;
}
