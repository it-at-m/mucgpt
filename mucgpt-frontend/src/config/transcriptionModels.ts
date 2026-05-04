export interface TranscriptionModel {
    model_id: string;
    label: string;
    size_hint?: string;
    /** If true the worker will refuse to load this model without WebGPU */
    webgpu_only?: boolean;
    /** Override dtype used when loading via @huggingface/transformers pipeline */
    dtype?: Record<string, string> | string;
}

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
    }
];

export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].model_id;
