export interface TranscriptionModel {
    model_id: string;
    label: string;
    size_hint?: string;
}

export const TRANSCRIPTION_MODELS: TranscriptionModel[] = [
    { model_id: "willopcbeta/unsloth-whisper-large-v3-turbo-ONNX", label: "Unsloth Whisper Large v3 Turbo", size_hint: "~350 MB" },
    { model_id: "onnx-community/whisper-large-v3-turbo", label: "Whisper Large v3 Turbo", size_hint: "~700 MB" },
    { model_id: "onnx-community/whisper-small", label: "Whisper Small", size_hint: "~120 MB" },
    { model_id: "onnx-community/cohere-transcribe-03-2026-ONNX", label: "Cohere Transcribe" },
    { model_id: "onnx-community/granite-4.0-1b-speech-ONNX", label: "IBM Granite 4.0 Speech" },
    { model_id: "onnx-community/Voxtral-Mini-3B-2507-ONNX", label: "Voxtral Mini" },
    { model_id: "ysdede/parakeet-tdt-0.6b-v2-onnx-tfjs4", label: "Parakeet TDT 0.6B v2" }
];

export const DEFAULT_TRANSCRIPTION_MODEL = TRANSCRIPTION_MODELS[0].model_id;
