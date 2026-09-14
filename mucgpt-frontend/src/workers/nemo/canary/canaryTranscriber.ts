import type { NemoTranscriber, NemoVocab, OrtSessionLike, OrtValue } from "../types";
import { computeNemoMel } from "../nemoMel";
import { nemoDetokenize } from "../vocab";

/**
 * Greedy AED decoder for istupakov-lineage canary-180m-flash ONNX exports
 * (https://huggingface.co/istupakov/canary-180m-flash-onnx). The fused decoder
 * keeps its own memory: `decoder_mems` starts zero-length and is fed back
 * verbatim from `decoder_hidden_states` on every step.
 */

/** ISO-639-1 languages the canary-180m-flash checkpoint was trained to transcribe. */
export const CANARY_SUPPORTED_LANGUAGES = ["en", "de", "fr", "es"] as const;

const DEFAULT_LANGUAGE = "en";
const DEFAULT_MAX_SEQUENCE_LENGTH = 1024;
const DECODER_LAYERS = 6;
const DECODER_DIM = 1024;
const MEL_CHANNELS = 128;

/** Resolves a mandatory task token id, throwing when the vocabulary lacks it. */
function requiredTokenId(vocab: NemoVocab, token: string): number {
    const id = vocab.tokenToId.get(token);
    if (id === undefined) throw new Error(`Canary vocabulary is missing required token "${token}"`);
    return id;
}

/** Maps an ISO language to Canary's `<|lang|>` control token, validating support. */
function canaryLanguageToken(language: string): string {
    if (!(CANARY_SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
        throw new Error(`Language "${language}" is not supported by Canary (${CANARY_SUPPORTED_LANGUAGES.join(", ")})`);
    }
    return `<|${language}|>`;
}

/**
 * Builds the fixed 10-token decoder prompt for transcribing with (or without)
 * punctuation and capitalization. Source and target language are both set to
 * `language` (canary expresses the task purely via these language tags).
 *
 * @throws when `language` is not in {@link CANARY_SUPPORTED_LANGUAGES} or a
 * required task token is missing from the vocabulary.
 */
export function canaryPromptIds(vocab: NemoVocab, language: string, pnc = true): number[] {
    const languageId = requiredTokenId(vocab, canaryLanguageToken(language));
    return [
        requiredTokenId(vocab, " "),
        requiredTokenId(vocab, "<|startofcontext|>"),
        requiredTokenId(vocab, "<|startoftranscript|>"),
        requiredTokenId(vocab, "<|emo:undefined|>"),
        languageId,
        languageId,
        requiredTokenId(vocab, pnc ? "<|pnc|>" : "<|nopnc|>"),
        requiredTokenId(vocab, "<|noitn|>"),
        requiredTokenId(vocab, "<|notimestamp|>"),
        requiredTokenId(vocab, "<|nodiarize|>")
    ];
}

/** Builds an int64 OrtValue from plain numbers (decoder `input_ids` feed). */
function int64Tensor(values: readonly number[], dims: readonly number[]): OrtValue {
    const data = new BigInt64Array(values.length);
    for (let i = 0; i < values.length; i++) data[i] = BigInt(values[i]);
    return { dims, data };
}

/** Index of the highest value in the flat logits vector. */
function argmax(values: Float32Array): number {
    let bestIndex = 0;
    let bestValue = values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] > bestValue) {
            bestValue = values[i];
            bestIndex = i;
        }
    }
    return bestIndex;
}

/**
 * Creates a {@link NemoTranscriber} around one canary encoder and one canary
 * decoder session. Sessions stay owned by the caller; `dispose()` is a no-op.
 *
 * @param options.maxSequenceLength hard stop for prompt + generated tokens
 * (default 1024); generation is additionally capped at ~30 tokens/s of audio.
 */
export function createCanaryTranscriber(
    deps: { encoder: OrtSessionLike; decoder: OrtSessionLike; vocab: NemoVocab },
    options?: { maxSequenceLength?: number }
): NemoTranscriber {
    const { encoder, decoder, vocab } = deps;
    const maxSequenceLength = options?.maxSequenceLength ?? DEFAULT_MAX_SEQUENCE_LENGTH;
    const eosId = requiredTokenId(vocab, "<|endoftext|>");
    return {
        async transcribe(audio: Float32Array, language?: string): Promise<string> {
            const prompt = canaryPromptIds(vocab, language ?? DEFAULT_LANGUAGE);
            const mel = computeNemoMel(audio);
            if (mel.validFrames < 2) return "";
            const encoderOutputs = await encoder.run({
                audio_signal: { dims: [1, MEL_CHANNELS, mel.totalFrames], data: mel.features },
                length: int64Tensor([mel.validFrames], [1])
            });
            const embeddings = encoderOutputs.encoder_embeddings;
            const mask = encoderOutputs.encoder_mask;
            if (!embeddings || !mask) throw new Error("Canary encoder did not return 'encoder_embeddings' and 'encoder_mask'");
            let decoderMems: OrtValue = { dims: [DECODER_LAYERS, 1, 0, DECODER_DIM], data: new Float32Array(0) };
            const tokens = prompt.slice();
            // ~30 tokens/s heuristic from sherpa-onnx (mel hop 160 → 100 frames/s).
            const tokenCap = Math.floor((mel.totalFrames / 100) * 30) + 1;
            while (tokens.length < maxSequenceLength && tokens.length - prompt.length < tokenCap) {
                const inputIds = decoderMems.dims[2] === 0 ? tokens : [tokens[tokens.length - 1]];
                const outputs = await decoder.run({
                    input_ids: int64Tensor(inputIds, [1, inputIds.length]),
                    encoder_embeddings: embeddings,
                    encoder_mask: mask,
                    decoder_mems: decoderMems
                });
                const logits = outputs.logits;
                const hiddenStates = outputs.decoder_hidden_states;
                if (!logits || !hiddenStates) throw new Error("Canary decoder did not return 'logits' and 'decoder_hidden_states'");
                // Logits are already log-softmaxed log-probs, so argmax decodes greedily.
                const bestId = argmax(logits.data as Float32Array);
                if (bestId === eosId) break;
                tokens.push(bestId);
                decoderMems = hiddenStates;
            }
            return nemoDetokenize(tokens.slice(prompt.length), vocab).trim();
        },
        async dispose(): Promise<void> {
            // Sessions are owned by the caller and stay open.
        }
    };
}
