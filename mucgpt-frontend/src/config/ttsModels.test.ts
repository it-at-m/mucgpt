import { describe, expect, it } from "vitest";
import { TTS_MODELS, findTtsModel } from "./ttsModels";

describe("ttsModels", () => {
    it("ships the Apache-2.0 English Phonon checkpoint pinned to a revision", () => {
        expect(TTS_MODELS).toHaveLength(1);
        const model = TTS_MODELS[0];
        expect(model.model_id).toBe("gradium/phonon-31m-en");
        expect(model.lang).toBe("en");
        expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
    });

    it("resolves the configured id and rejects unknown ids", () => {
        expect(findTtsModel("gradium/phonon-31m-en")).toBe(TTS_MODELS[0]);
        // The CC BY-NC German model must never resolve: it is not in the registry.
        expect(findTtsModel("gradium/phonon-40m-de")).toBeUndefined();
        expect(findTtsModel("")).toBeUndefined();
    });
});
