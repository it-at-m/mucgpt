/**
 * Node-side end-to-end validation spike: runs the shared CANARY AED transcriber
 * (src/workers/nemo/canary) against the real istupakov canary-180m-flash ONNX
 * int8 exports via onnxruntime-node. Not wired into the app — bundle on demand:
 *
 *   npx esbuild src/workers/nemo/spike/canaryNodeSpike.ts --bundle --platform=node \
 *     --format=cjs --external:onnxruntime-node --outfile=canary-spike.cjs
 *   node canary-spike.cjs <encoder.onnx> <decoder.onnx> <vocab.txt> <audio.wav>=<lang> [...]
 *
 * Set CANARY_SPIKE_DEBUG=1 to replicate the decode loop with verbose per-step
 * diagnostics (logits dims, last-position vs flat argmax token ids).
 */
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-node";
import { canaryPromptIds, createCanaryTranscriber } from "../canary/canaryTranscriber";
import { computeNemoMel } from "../nemoMel";
import type { OrtSessionLike, OrtValue } from "../types";
import { nemoDetokenize, parseNemoVocab } from "../vocab";
import { int64Tensor, loadWavAsPcm16k, toSessionLike } from "./spikeUtils";

const MEL_CHANNELS = 128;
const DECODER_LAYERS = 6;
const DECODER_DIM = 1024;

/** Index of the highest value in values[offset; offset+length). */
function argmaxOf(values: Float32Array, offset: number, length: number): number {
    let bestIndex = offset;
    let bestValue = values[offset];
    for (let i = offset + 1; i < offset + length; i++) {
        if (values[i] > bestValue) {
            bestValue = values[i];
            bestIndex = i;
        }
    }
    return bestIndex - offset;
}

/** Runs one clip through the transcriber and prints transcript/timing for the spike report. */
async function debugDecode(
    encoder: OrtSessionLike,
    decoder: OrtSessionLike,
    vocab: ReturnType<typeof parseNemoVocab>,
    pcm: Float32Array,
    language: string
): Promise<void> {
    const prompt = canaryPromptIds(vocab, language);
    console.log(`[debug] prompt ids: ${prompt.join(", ")}`);
    const mel = computeNemoMel(pcm);
    console.log(`[debug] mel: totalFrames=${mel.totalFrames} validFrames=${mel.validFrames} features=${mel.features.length}`);
    const encoderOutputs = await encoder.run({
        audio_signal: { dims: [1, MEL_CHANNELS, mel.totalFrames], data: mel.features },
        length: int64Tensor([mel.validFrames], [1])
    });
    const embeddings = encoderOutputs.encoder_embeddings;
    const mask = encoderOutputs.encoder_mask;
    if (!embeddings || !mask) throw new Error("encoder did not return encoder_embeddings/encoder_mask");
    console.log(`[debug] encoder_embeddings dims=${JSON.stringify(embeddings.dims)} encoder_mask dims=${JSON.stringify(mask.dims)}`);
    let decoderMems: OrtValue = { dims: [DECODER_LAYERS, 1, 0, DECODER_DIM], data: new Float32Array(0) };
    const tokens = prompt.slice();
    for (let step = 0; step < 30; step++) {
        const inputIds = decoderMems.dims[2] === 0 ? tokens : [tokens[tokens.length - 1]];
        const outputs = await decoder.run({
            input_ids: int64Tensor(inputIds, [1, inputIds.length]),
            encoder_embeddings: embeddings,
            encoder_mask: mask,
            decoder_mems: decoderMems
        });
        const logits = outputs.logits;
        const hiddenStates = outputs.decoder_hidden_states;
        if (!logits || !hiddenStates) throw new Error("decoder did not return logits/decoder_hidden_states");
        const data = logits.data as Float32Array;
        let offset = 0;
        let viewLength = data.length;
        if (logits.dims.length === 3) {
            offset = (logits.dims[1] - 1) * logits.dims[2];
            viewLength = logits.dims[2];
        } else if (logits.dims.length === 2) {
            viewLength = logits.dims[1];
        }
        const lastPosId = argmaxOf(data, offset, viewLength);
        const flatId = argmaxOf(data, 0, data.length);
        console.log(
            `[debug] step=${step} logits dims=${JSON.stringify(logits.dims)} hidden dims=${JSON.stringify(hiddenStates.dims)} ` +
                `lastPos=${lastPosId}("${vocab.idToToken[lastPosId]}") flat=${flatId}("${vocab.idToToken[flatId]}")`
        );
        tokens.push(lastPosId);
        decoderMems = hiddenStates;
    }
    console.log(`[debug] 30-step greedy transcript: "${nemoDetokenize(tokens.slice(prompt.length), vocab).trim()}"`);
}

/** CLI entry point: see module doc for usage. */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        console.error("Usage: node canary-spike.cjs <encoder.onnx> <decoder.onnx> <vocab.txt> <audio.wav>=<lang> [...]");
        process.exit(1);
    }
    const [encoderPath, decoderPath, vocabPath, ...audioArgs] = args;

    const vocab = parseNemoVocab(readFileSync(vocabPath, "utf8"));
    console.log(`[spike] vocab: ${vocab.idToToken.length} tokens`);

    console.log(`[spike] loading encoder: ${encoderPath}`);
    const encoderSession = await ort.InferenceSession.create(encoderPath, { executionProviders: ["cpu"], graphOptimizationLevel: "all" });
    console.log(`[spike]   inputs=${JSON.stringify(encoderSession.inputNames)} outputs=${JSON.stringify(encoderSession.outputNames)}`);
    console.log(`[spike] loading decoder: ${decoderPath}`);
    const decoderSession = await ort.InferenceSession.create(decoderPath, { executionProviders: ["cpu"], graphOptimizationLevel: "all" });
    console.log(`[spike]   inputs=${JSON.stringify(decoderSession.inputNames)} outputs=${JSON.stringify(decoderSession.outputNames)}`);

    const encoder = toSessionLike(encoderSession);
    const decoder = toSessionLike(decoderSession);
    const transcriber = createCanaryTranscriber({ encoder, decoder, vocab }, { maxSequenceLength: 1024 });

    for (const audioArg of audioArgs) {
        const separator = audioArg.lastIndexOf("=");
        if (separator <= 0) throw new Error(`Audio argument "${audioArg}" must look like <path>=<language>`);
        const wavPath = audioArg.slice(0, separator);
        const language = audioArg.slice(separator + 1);

        const { pcm, durationSeconds, info } = loadWavAsPcm16k(wavPath);
        console.log(
            `[spike] ${wavPath}: format=${info.audioFormat} channels=${info.channels} rate=${info.sampleRate} ` +
                `bits=${info.bitsPerSample} → ${durationSeconds.toFixed(2)} s @ 16 kHz (${pcm.length} samples), language=${language}`
        );

        if (process.env.CANARY_SPIKE_DEBUG === "1") {
            await debugDecode(encoder, decoder, vocab, pcm, language);
            continue;
        }

        const startedAt = performance.now();
        const transcript = await transcriber.transcribe(pcm, language);
        const elapsedSeconds = (performance.now() - startedAt) / 1000;
        const rssMb = process.memoryUsage().rss / (1024 * 1024);
        console.log(
            `[result] lang=${language} duration=${durationSeconds.toFixed(2)}s elapsed=${elapsedSeconds.toFixed(2)}s ` +
                `rtf=${(elapsedSeconds / durationSeconds).toFixed(3)} rss=${rssMb.toFixed(0)}MB`
        );
        console.log(`[result] transcript: ${transcript}`);
    }
}

main().catch((error: unknown) => {
    console.error("[spike] FAILED:", error);
    process.exit(1);
});
