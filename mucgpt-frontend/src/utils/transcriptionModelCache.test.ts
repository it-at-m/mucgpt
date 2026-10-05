import { describe, expect, it } from "vitest";
import { isModelCacheKey } from "./transcriptionModelCache";

const turbo = "onnx-community/whisper-large-v3-turbo";
const turboGerman = "onnx-community/whisper-large-v3-turbo-german-ONNX";

describe("isModelCacheKey", () => {
    it("matches files of the exact HuggingFace repo", () => {
        expect(isModelCacheKey(`https://huggingface.co/${turbo}/resolve/main/onnx/encoder_model_q4.onnx`, turbo)).toBe(true);
        expect(isModelCacheKey(`https://huggingface.co/${turboGerman}/resolve/main/onnx/encoder_model_q4.onnx`, turboGerman)).toBe(true);
    });

    it("does not match repos that only share a prefix", () => {
        expect(isModelCacheKey(`https://huggingface.co/${turboGerman}/resolve/main/onnx/encoder_model_q4.onnx`, turbo)).toBe(false);
        expect(isModelCacheKey(`https://huggingface.co/${turbo}/resolve/main/onnx/encoder_model_q4.onnx`, turboGerman)).toBe(false);
    });

    it("ignores unrelated hosts and models", () => {
        expect(isModelCacheKey("https://example.com/some-model/resolve/main/a.onnx", "some/model")).toBe(false);
        expect(isModelCacheKey("https://huggingface.co/onnx-community/silero-vad/resolve/main/onnx/model.onnx", turbo)).toBe(false);
    });
});
