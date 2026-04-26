export interface TranscriptionModel {
    model_id: string;
    label: string;
    size_hint?: string;
    /** Override dtype used when loading via @huggingface/transformers pipeline */
    dtype?: Record<string, string> | string;
}

export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
    {
        model_id: "willopcbeta/unsloth-whisper-large-v3-turbo-ONNX",
        label: "Unsloth Whisper Large v3 Turbo",
        size_hint: "~350 MB",
        // fp32 encoder uses external .onnx_data files that ONNX Runtime Web (WASM) cannot load;
        // use q8 encoder to stay within a single self-contained file.
        dtype: { encoder_model: "q8", decoder_model_merged: "q4" }
    },
    { model_id: "onnx-community/whisper-large-v3-turbo", label: "Whisper Large v3 Turbo", size_hint: "~700 MB" },
    { model_id: "onnx-community/whisper-small", label: "Whisper Small", size_hint: "~120 MB" }
];

export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].model_id;
