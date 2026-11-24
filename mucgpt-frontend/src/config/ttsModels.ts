/**
 * Read-aloud (TTS) models known to this frontend build.
 *
 * Mirrors the transcription registry pattern (`transcriptionModels.ts`): the
 * deployment announces a single model id via the core service `/config`
 * endpoint; unknown ids disable the feature instead of silently running
 * another model. For the browser-locally running runtime the id must point to
 * a *public, permissively licensed* Hugging Face checkpoint — the browser has
 * no token, so gated repos (e.g. the CC BY-NC Phonon 40m family) cannot be
 * loaded client-side at all.
 */

/** Text-normalization language of the model, passed to the phonon-tts runtime. */
export type TtsLanguage = "en" | "fr" | "de" | "es" | "pt";

/** A read-aloud model offered by this build, agnostic of the runtime that executes it. */
export interface TtsModel {
    model_id: string;
    label: string;
    size_hint?: string;
    /** Normalization language (`lang` in phonon-tts); must match the model's trained language. */
    lang: TtsLanguage;
    /** Immutable HuggingFace revision (commit) the checkpoint files are pinned to. */
    revision: string;
    /**
     * Fixed pre-approved voice. Unset means the checkpoint's default voice —
     * pinned via `revision`, so it is stable for a release.
     */
    voice?: string;
}

/**
 * Model choices known to this frontend build, in display order. The
 * configured deployment model must be one of these.
 */
export const TTS_MODELS: TtsModel[] = [
    // gradium/phonon-31m-en is the only license-clean Phonon checkpoint
    // (Apache 2.0 weights/tokenizer/voices, runtime MIT OR Apache-2.0). English
    // only — the German sibling phonon-40m-de is CC BY-NC 4.0 and gated, i.e.
    // off-limits for a legally-commercial public institution and unloadable in
    // a browser. Revision 8f7a37c… is the commit that added the LICENSE file
    // (mid-Nov 2026) and pins the default voice (Reuben). Runs in-browser via
    // `phonon-tts` (WASM SIMD; WebGPU used automatically when `device: "auto"`
    // gets a hardware adapter and q8 weights).
    {
        model_id: "gradium/phonon-31m-en",
        label: "Phonon 31M (English)",
        size_hint: "~65 MB",
        lang: "en",
        revision: "8f7a37c94a4c58b04c8287300c53f11d2e208eae"
    }
];

/**
 * Looks up the loaded read-aloud configuration for a configured model id.
 */
export function findTtsModel(modelId: string): TtsModel | undefined {
    return TTS_MODELS.find(m => m.model_id === modelId);
}
