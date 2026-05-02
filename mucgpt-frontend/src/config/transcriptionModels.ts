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
        size_hint: "~560 MB",
        dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" }
    },
    {
        model_id: "onnx-community/whisper-large-v3-turbo",
        label: "Whisper Large v3 Turbo",
        size_hint: "~560 MB",
        dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" }
    },
    {
        model_id: "onnx-community/whisper-small",
        label: "Whisper Small",
        size_hint: "~220 MB",
        dtype: { encoder_model: "q4", decoder_model_merged: "int8" }
    }
];

export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].model_id;
