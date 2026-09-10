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
    /** ISO-639-1 language codes this model transcribes well; unset = all supported locales */
    languages?: string[];
    /** Defaults to "transformers" (@huggingface/transformers ASR pipeline). */
    runtime?: TranscriptionRuntime;
    /** ONNX files for NeMo runtime entries, resolved against the HF resolve endpoint. */
    files?: NemoModelFiles;
    /** Repo tree path used to list file sizes for the download progress display (default "onnx"). */
    file_tree?: string;
}

/** Model choices offered in the transcription settings dialog, in display order. */
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
        },
        file_tree: "main"
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
        },
        file_tree: "main"
    }
];

/** Model preselected for first-time users (the lightest, most compatible option). */
export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].model_id;
