import { computeNemoMel } from "../nemoMel";
import type { NemoTranscriber, NemoVocab, OrtSessionLike, OrtValue } from "../types";
import { nemoDetokenize } from "../vocab";

export interface ParakeetTranscriberOptions {
    /** Force one-frame advance once this many tokens were emitted at the same encoder frame (sherpa-onnx parity: 5). */
    maxTokensPerFrame?: number;
    /** Hard cap on decoder_joint invocations per utterance; guards against non-terminating decodes. */
    maxTotalSteps?: number;
    /** Prediction-network LSTM depth and width; v3 exports carry a 2-layer, 640-unit LSTM. */
    lstmLayers?: number;
    hiddenSize?: number;
}

const DEFAULT_MAX_TOKENS_PER_FRAME = 5;
const DEFAULT_MAX_TOTAL_STEPS = 100_000;
const DEFAULT_LSTM_LAYERS = 2;
const DEFAULT_PREDICTION_HIDDEN = 640;

interface EncodedFrames {
    /** [frameCount, hidden], transposed from the channels-first encoder output. */
    frames: Float32Array;
    hidden: number;
    nFrames: number;
}

function int64Scalar(value: number): OrtValue {
    return { dims: [1], data: new BigInt64Array([BigInt(value)]) };
}

function float32Data(value: OrtValue, name: string): Float32Array {
    if (!(value.data instanceof Float32Array)) throw new Error(`parakeet: output "${name}" is not float32`);
    return value.data;
}

function int64Data(value: OrtValue, name: string): BigInt64Array {
    if (!(value.data instanceof BigInt64Array)) throw new Error(`parakeet: output "${name}" is not int64`);
    return value.data;
}

/** Squeezes the fused joint output (all leading dims singleton) down to its flat logit vector. */
function squeezedFloat32(value: OrtValue, name: string): Float32Array {
    const data = float32Data(value, name);
    const lastDim = value.dims[value.dims.length - 1];
    if (data.length !== lastDim) throw new Error(`parakeet: joint output "${name}" has non-singleton leading dims [${value.dims.join(", ")}]`);
    return data;
}

function pickOutput(result: Record<string, OrtValue>, outputNames: readonly string[], name: string, index: number): OrtValue {
    const value = result[name] ?? (index < outputNames.length ? result[outputNames[index]] : undefined);
    if (!value) throw new Error(`parakeet: ONNX output "${name}" missing`);
    return value;
}

function argmax(data: Float32Array, start: number, end: number): number {
    let best = start;
    for (let i = start + 1; i < end; i++) {
        if (data[i] > data[best]) best = i;
    }
    return best;
}

async function encode(encoder: OrtSessionLike, features: Float32Array, totalFrames: number, validFrames: number): Promise<EncodedFrames> {
    const result = await encoder.run({
        audio_signal: { dims: [1, 128, totalFrames], data: features },
        length: int64Scalar(validFrames)
    });
    const raw = pickOutput(result, encoder.outputNames, "outputs", 0);
    const data = float32Data(raw, "outputs");
    if (raw.dims.length !== 3) throw new Error(`parakeet: encoder output "outputs" must be rank 3 [B, C, T], got [${raw.dims.join(", ")}]`);
    const hidden = raw.dims[1];
    const frameCount = raw.dims[2];
    if (hidden <= 0 || frameCount <= 0 || data.length !== hidden * frameCount) {
        throw new Error(`parakeet: encoder output dims [${raw.dims.join(", ")}] do not match ${data.length} values`);
    }
    const lengths = int64Data(pickOutput(result, encoder.outputNames, "encoded_lengths", 1), "encoded_lengths");
    if (lengths.length === 0) throw new Error(`parakeet: encoder output "encoded_lengths" is empty`);
    const frames = new Float32Array(frameCount * hidden);
    for (let c = 0; c < hidden; c++) {
        for (let t = 0; t < frameCount; t++) frames[t * hidden + c] = data[c * frameCount + t];
    }
    return { frames, hidden, nFrames: Math.min(Number(lengths[0]), frameCount) };
}

/**
 * Greedy Token-and-Duration Transducer decoding for istupakov-lineage
 * parakeet-tdt-0.6b-v3 ONNX exports: a channels-first encoder ([1, 1024, T']
 * plus `encoded_lengths`) and a fused `decoder_joint` graph whose flat output
 * packs [tokenLogits (vocab incl. trailing <blk>), durationLogits] behind
 * singleton leading dims. The duration argmax index is the frame advance; the
 * prediction-network LSTM state is committed only on token emissions, so blank
 * steps never advance it.
 */
export function createParakeetTranscriber(
    deps: { encoder: OrtSessionLike; decoderJoint: OrtSessionLike; vocab: NemoVocab },
    options?: ParakeetTranscriberOptions
): NemoTranscriber {
    const { encoder, decoderJoint, vocab } = deps;
    const maxTokensPerFrame = options?.maxTokensPerFrame ?? DEFAULT_MAX_TOKENS_PER_FRAME;
    const maxTotalSteps = options?.maxTotalSteps ?? DEFAULT_MAX_TOTAL_STEPS;
    const lstmLayers = options?.lstmLayers ?? DEFAULT_LSTM_LAYERS;
    const predictionHidden = options?.hiddenSize ?? DEFAULT_PREDICTION_HIDDEN;

    const vocabCount = vocab.idToToken.length;
    if (vocabCount === 0) throw new Error("parakeet: vocabulary is empty");
    const blankId = vocabCount - 1;
    const stateDims = [lstmLayers, 1, predictionHidden];
    const zeroState = (): OrtValue => ({ dims: stateDims, data: new Float32Array(lstmLayers * predictionHidden) });
    const targetLength = int64Scalar(1);
    const targetsData = new BigInt64Array(1);

    const transcribe = async (audio: Float32Array): Promise<string> => {
        const { features, totalFrames, validFrames } = computeNemoMel(audio);
        if (validFrames < 2) return "";
        const encoded = await encode(encoder, features, totalFrames, validFrames);
        const frameDims = [1, 1, 1, encoded.hidden];

        const tokens: number[] = [];
        let hState = zeroState();
        let cState = zeroState();
        let prevTokenId = blankId;
        let t = 0;
        let emittedThisFrame = 0;
        let steps = 0;

        while (t < encoded.nFrames) {
            if (++steps > maxTotalSteps) break;
            targetsData[0] = BigInt(prevTokenId);
            const result = await decoderJoint.run({
                encoder_outputs: { dims: frameDims, data: encoded.frames.subarray(t * encoded.hidden, (t + 1) * encoded.hidden) },
                targets: { dims: [1, 1], data: targetsData },
                target_length: targetLength,
                input_states_1: hState,
                input_states_2: cState
            });
            const logits = squeezedFloat32(pickOutput(result, decoderJoint.outputNames, "outputs", 0), "outputs");
            if (logits.length <= vocabCount) {
                throw new Error(`parakeet: fused joint output has ${logits.length} logits, no room for durations beside ${vocabCount} vocab entries`);
            }
            const token = argmax(logits, 0, vocabCount);
            const advance = argmax(logits, vocabCount, logits.length) - vocabCount;

            if (token !== blankId) {
                hState = pickOutput(result, decoderJoint.outputNames, "output_states_1", 1);
                cState = pickOutput(result, decoderJoint.outputNames, "output_states_2", 2);
                tokens.push(token);
                prevTokenId = token;
                emittedThisFrame++;
            }
            if (advance > 0) {
                t += advance;
                emittedThisFrame = 0;
            } else if (token === blankId || emittedThisFrame >= maxTokensPerFrame) {
                t += 1;
                emittedThisFrame = 0;
            }
        }

        return nemoDetokenize(tokens, vocab).trim();
    };

    return {
        transcribe,
        async dispose() {
            // Sessions and vocab are owned by the caller.
        }
    };
}
