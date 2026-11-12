/** Which worker runtime loads and decodes the model. */
export type TranscriptionRuntime = "transformers" | "canary" | "parakeet";

/** Model files of a NeMo runtime entry, fetched directly (no transformers.js pipeline). */
export interface NemoModelFiles {
    encoder: string;
    decoder: string;
    vocab: string;
}

/** A transcription model offered to the user, agnostic of the runtime that executes it. */
export interface TranscriptionModel {
    model_id: string;
    label: string;
    size_hint?: string;
    /** If true the worker will refuse to load this model without WebGPU */
    webgpu_only?: boolean;
    /** Override dtype used when loading via @huggingface/transformers pipeline */
    dtype?: Record<string, string> | string;
    /** Graph optimization level for NeMo ONNX session creation (default "all"). */
    graph_optimization?: "disabled" | "basic" | "all";
    /** ISO-639-1 language codes this model transcribes well; unset = all supported locales */
    languages?: string[];
    /** Defaults to "transformers" (@huggingface/transformers ASR pipeline). */
    runtime?: TranscriptionRuntime;
    /** ONNX files for NeMo runtime entries, resolved against the HF resolve endpoint. */
    files?: NemoModelFiles;
    /** Repo tree path used to list file sizes for the download progress display (default "onnx"). */
    file_tree?: string;
}

/** Model choices known to this frontend build, in display order. The configured deployment model must be one of these. */
export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
    // Disabled: onnxruntime-web >=1.20 removed Module.MountedFiles, which was the WASM API used to
    // mount .onnx_data external-data files. This repo has no quantised encoder variants, so
    // transformers.js falls back to fp32 + external data → "Module.MountedFiles is not available".
    // Re-enable once the model exposes an encoder_model_q4.onnx (single-file, no external data)
    // or once @huggingface/transformers handles the new ort-web externalData session option.
    // {
    //     model_id: "willopcbeta/unsloth-whisper-large-v3-turbo-ONNX",
    //     label: "Unsloth Whisper Large v3 Turbo",
    //     size_hint: "~560 MB",
    //     dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" }
    // },
    {
        model_id: "onnx-community/whisper-small",
        label: "Whisper Small",
        size_hint: "~220 MB",
        dtype: { encoder_model: "q4", decoder_model_merged: "int8" }
    },
    // Reference (xenova/whisper-web, experimental-webgpu): encoder=fp16 + decoder=q4 on WebGPU
    // only (fp16 decoder is broken in ort-web; WASM causes "Array buffer allocation failed" OOM
    // because the Worker heap can't sustain the ~1 GB peak). webgpu_only=true makes the worker
    // reject the load with a human-readable error instead of crashing.
    {
        model_id: "onnx-community/whisper-large-v3-turbo",
        label: "Whisper Large v3 Turbo",
        size_hint: "~560 MB",
        webgpu_only: true,
        dtype: { encoder_model: "fp16", decoder_model_merged: "q4" }
    },
    // primeline German fine-tune of whisper-large-v3-turbo — markedly better German WER,
    // same architecture/dtypes as the generic turbo entry above (fp16 encoder is broken on
    // ort-web wasm, hence webgpu_only like its sibling).
    {
        model_id: "onnx-community/whisper-large-v3-turbo-german-ONNX",
        label: "Whisper Large v3 Turbo German",
        size_hint: "~1.5 GB",
        webgpu_only: true,
        dtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
        languages: ["de"]
    },
    // primeline distil-whisper German — the only high-quality German option without WebGPU:
    // q4 encoder + q8 decoder both run on ort-web WASM (single-file ONNX, no external data).
    {
        model_id: "flackzz/distil-whisper-large-v3-german_timestamped-ONNX",
        label: "Distil-Whisper Large v3 German",
        size_hint: "~520 MB",
        dtype: { encoder_model: "q4", decoder_model_merged: "q8" },
        languages: ["de"]
    },
    // NVIDIA Canary 180M Flash (istupakov ONNX export, int8): 182M-param multilingual AED model,
    // ~20× realtime on desktop CPU in the node spike with transcripts identical to the Python
    // onnx-asr reference. 128-mel frontend + task-token prompt handled by our own decoder
    // (src/workers/nemo/canary). Ukrainian locale (UK) is not supported → falls back visually
    // to the language hint; the worker surfaces an error if it is forced.
    {
        model_id: "istupakov/canary-180m-flash-onnx",
        label: "NVIDIA Canary 180M Flash",
        size_hint: "~210 MB",
        runtime: "canary",
        languages: ["en", "de", "fr", "es"],
        files: {
            encoder: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/encoder-model.int8.onnx",
            decoder: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/decoder-model.int8.onnx",
            vocab: "https://huggingface.co/istupakov/canary-180m-flash-onnx/resolve/main/vocab.txt"
        }
    },
    // NVIDIA Parakeet TDT 0.6B v3: 25 languages with automatic language detection
    // (covers all MUCGPT locales incl. Ukrainian). int4 encoder (MatMulNBits) +
    // int8 fused decoder_joint via our TDT decoder (src/workers/nemo/parakeet).
    // Browser-validated on ort-web WASM: session create ~1.3 s, ~0.63 RTF single-threaded,
    // dispose/reload clean (see src/workers/nemo/spike/parakeetBrowserHarness.ts).
    {
        model_id: "efederici/parakeet-tdt-0.6b-v3-onnx-int4",
        label: "NVIDIA Parakeet TDT 0.6B v3",
        size_hint: "~390 MB",
        runtime: "parakeet",
        files: {
            encoder: "https://huggingface.co/efederici/parakeet-tdt-0.6b-v3-onnx-int4/resolve/main/encoder-model.int4.onnx",
            decoder: "https://huggingface.co/efederici/parakeet-tdt-0.6b-v3-onnx-int4/resolve/main/decoder_joint-model.int8.onnx",
            vocab: "https://huggingface.co/efederici/parakeet-tdt-0.6b-v3-onnx-int4/resolve/main/vocab.txt"
        }
    },
    // NVIDIA Parakeet Ultra (moondream post-train of Parakeet TDT 0.6B v3, CC-BY-4.0):
    // same architecture/tokenizer/25 languages but better than v3 on every benchmark
    // (FLEURS de 3.61 vs 4.13, uk 4.75 vs 5.94) plus punctuation/capitalization output.
    // Olicorne browser export in the istupakov nemo-conformer-tdt layout, single files
    // (no external data): w4a8 MatMulNBits encoder (383 MB) + int8 decoder_joint
    // (decoder int8 = fp32 accuracy on this model) + vocab ≈ 402 MB total, no fp16 →
    // WASM without shader-f16. Spike-validated (see issue #1450): node + browser WASM
    // end-to-end, correct transcript with punctuation; single-threaded ort-web WASM
    // decodes ~RTF 1.0 (11 s jfk.wav, ~394 MB JS heap) — slower than v3 int4 (~0.63)
    // but still realtime-class; sessions create in ~2.3 s. The export bans <unk>
    // tokens in the decoder.
    {
        model_id: "Olicorne/parakeet-tdt-0.6b-v3-ultra-onnx",
        label: "NVIDIA Parakeet Ultra",
        size_hint: "~410 MB",
        runtime: "parakeet",
        files: {
            encoder: "https://huggingface.co/Olicorne/parakeet-tdt-0.6b-v3-ultra-onnx/resolve/main/w4a8/encoder-model.w4a8.onnx",
            decoder: "https://huggingface.co/Olicorne/parakeet-tdt-0.6b-v3-ultra-onnx/resolve/main/int8/decoder_joint-model.int8.onnx",
            vocab: "https://huggingface.co/Olicorne/parakeet-tdt-0.6b-v3-ultra-onnx/resolve/main/vocab.txt"
        }
    },
    // NVIDIA Parakeet Redux (moondream's ternary 1.58-bit quantization of
    // Parakeet TDT 0.6B v3, CC-BY-4.0): same architecture/tokenizer, 25 languages
    // with automatic language detection. mrfakename/eschmidbauer browser export
    // (istupakov nemo-conformer-tdt layout, single files): ternary encoder
    // (344 MB) + int8 decoder_joint (18 MB) + vocab ≈ 365 MB download. Accuracy
    // vs Parakeet v3 (FLEURS): better multilingual average (10.56 vs 11.62) but
    // worse German (5.42 vs 4.13), French (7.71 vs 4.81), Ukrainian (7.06 vs
    // 5.94) and clearly weaker in background noise — positioned as the small
    // low-end tier. WEBGPU NOTE: the mrfakename model card says the encoder
    // "runs on WebGPU"; our spike (issue #1450) disproves a hard dependency —
    // the ternary graph runs end-to-end on ort-web WASM (single-threaded, ~RTF
    // 1.1, correct transcript) and on onnxruntime-node CPU. WebGPU would likely
    // be faster where available, but WASM works. graph_optimization "basic" is
    // required: at "all" ort-web's optimizer takes ~15 s on this graph (0.7 s
    // at "basic") with identical inference speed.
    {
        model_id: "mrfakename/parakeet-redux-ONNX",
        label: "NVIDIA Parakeet Redux",
        size_hint: "~365 MB",
        graph_optimization: "basic",
        runtime: "parakeet",
        files: {
            encoder: "https://huggingface.co/mrfakename/parakeet-redux-ONNX/resolve/main/encoder-model.onnx",
            decoder: "https://huggingface.co/mrfakename/parakeet-redux-ONNX/resolve/main/decoder_joint-model.int8.onnx",
            vocab: "https://huggingface.co/mrfakename/parakeet-redux-ONNX/resolve/main/vocab.txt"
        }
    }
];

/**
 * Looks up the loaded transcription configuration for a configured model id.
 */
export function findTranscriptionModel(modelId: string): TranscriptionModel | undefined {
    return TRANSCRIPTION_MODELS.find(m => m.model_id === modelId);
}
