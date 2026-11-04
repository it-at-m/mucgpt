import { describe, expect, it } from "vitest";
import { FALLBACK_TRANSCRIPTION_MODEL, TRANSCRIPTION_MODELS, findTranscriptionModel } from "./transcriptionModels";

describe("TRANSCRIPTION_MODELS", () => {
    it("contains unique model ids", () => {
        const ids = TRANSCRIPTION_MODELS.map(m => m.model_id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("has a non-empty list with the fallback present", () => {
        expect(TRANSCRIPTION_MODELS.length).toBeGreaterThan(0);
        expect(TRANSCRIPTION_MODELS.map(m => m.model_id)).toContain(FALLBACK_TRANSCRIPTION_MODEL);
    });

    it("labels and size hints are set for every model", () => {
        for (const model of TRANSCRIPTION_MODELS) {
            expect(model.label.trim().length).toBeGreaterThan(0);
            expect(model.size_hint?.trim().length).toBeGreaterThan(0);
        }
    });

    it("webgpu_only models are marked explicitly and not the fallback", () => {
        const webgpuOnly = TRANSCRIPTION_MODELS.filter(m => m.webgpu_only);
        expect(webgpuOnly.length).toBeGreaterThan(0);
        for (const model of webgpuOnly) {
            expect(model.model_id).not.toBe(FALLBACK_TRANSCRIPTION_MODEL);
        }
    });

    it("german-tuned whisper entries declare German-only coverage (English unvalidated)", () => {
        const turboGerman = TRANSCRIPTION_MODELS.find(m => m.model_id === "onnx-community/whisper-large-v3-turbo-german-ONNX");
        const distilGerman = TRANSCRIPTION_MODELS.find(m => m.model_id === "flackzz/distil-whisper-large-v3-german_timestamped-ONNX");
        expect(turboGerman).toBeDefined();
        expect(distilGerman).toBeDefined();
        expect(turboGerman?.languages).toEqual(["de"]);
        expect(distilGerman?.languages).toEqual(["de"]);
        expect(turboGerman?.webgpu_only).toBe(true);
        expect(distilGerman?.webgpu_only).toBeUndefined();
    });

    it("nemo runtime entries carry their ONNX file list and tree path", () => {
        const canary = TRANSCRIPTION_MODELS.find(m => m.model_id === "istupakov/canary-180m-flash-onnx");
        expect(canary).toBeDefined();
        expect(canary?.runtime).toBe("canary");
        expect(canary?.webgpu_only).toBeUndefined();
        expect(canary?.files?.encoder).toMatch(/^https:\/\/huggingface\.co\/.+\.onnx$/);
        expect(canary?.files?.decoder).toMatch(/^https:\/\/huggingface\.co\/.+\.onnx$/);
        expect(canary?.files?.vocab).toMatch(/^https:\/\/huggingface\.co\/.+vocab\.txt$/);
        expect(canary?.languages).toEqual(["en", "de", "fr", "es"]);
    });

    it("german-tuned entries avoid fp16 decoder (broken in ort-web) and use single-file dtypes", () => {
        for (const model of TRANSCRIPTION_MODELS) {
            const dtype = model.dtype;
            if (typeof dtype === "object" && dtype.decoder_model_merged) {
                expect(dtype.decoder_model_merged).not.toBe("fp16");
                expect(dtype.decoder_model_merged).not.toBe("q4f16");
            }
        }
    });
});

describe("findTranscriptionModel", () => {
    it("finds entries by their exact id", () => {
        const model = findTranscriptionModel("istupakov/canary-180m-flash-onnx");
        expect(model?.model_id).toBe("istupakov/canary-180m-flash-onnx");
        expect(model?.label).toBe("NVIDIA Canary 180M Flash");
    });

    it("resolves the fallback id", () => {
        expect(findTranscriptionModel(FALLBACK_TRANSCRIPTION_MODEL)).toBeDefined();
    });

    it("returns undefined for unknown ids (including prefix collisions)", () => {
        expect(findTranscriptionModel("does/not-exist")).toBeUndefined();
        expect(findTranscriptionModel("onnx-community/whisper-large-v3-turbo-german-ONNX-exist")).toBeUndefined();
    });
});
