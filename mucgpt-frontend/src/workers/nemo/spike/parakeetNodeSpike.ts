/**
 * Node-side end-to-end validation spike: runs the shared PARAKEET TDT
 * transcriber (src/workers/nemo/parakeet) against the real parakeet-tdt-0.6b-v3
 * ONNX exports (efederici int4 encoder + int8 fused decoder_joint) via
 * onnxruntime-node. Not wired into the app — bundle on demand:
 *
 *   npx esbuild src/workers/nemo/spike/parakeetNodeSpike.ts --bundle --platform=node \
 *     --format=cjs --external:onnxruntime-node --outfile=parakeet-spike.cjs
 *   node parakeet-spike.cjs <encoder.onnx> <decoder_joint.onnx> <vocab.txt> <audio.wav> [...]
 *
 * The model detects the language itself — clips are listed without language tags.
 * Set PARAKEET_SPIKE_DEBUG=1 for verbose per-step diagnostics (token id, duration
 * step, LSTM state norms) for the first 15 decode steps.
 */
import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-node";
import { computeNemoMel } from "../nemoMel";
import { createParakeetTranscriber } from "../parakeet/parakeetTranscriber";
import type { NemoVocab, OrtSessionLike, OrtValue } from "../types";
import { nemoDetokenize, parseNemoVocab } from "../vocab";
import { int64Tensor, loadWavAsPcm16k, toSessionLike } from "./spikeUtils";

const MEL_CHANNELS = 128;

/** Replicates the transcriber's TDT decode loop with verbose per-step diagnostics. */
async function debugDecode(encoder: OrtSessionLike, decoderJoint: OrtSessionLike, vocab: NemoVocab, pcm: Float32Array): Promise<void> {
    const mel = computeNemoMel(pcm);
    console.log(`[debug] mel: totalFrames=${mel.totalFrames} validFrames=${mel.validFrames} features=${mel.features.length}`);
    const encoderOutputs = await encoder.run({
        audio_signal: { dims: [1, MEL_CHANNELS, mel.totalFrames], data: mel.features },
        length: int64Tensor([mel.validFrames], [1])
    });
    const raw = encoderOutputs.outputs;
    const lengths = encoderOutputs.encoded_lengths;
    if (!raw || !lengths) throw new Error("encoder did not return outputs/encoded_lengths");
    console.log(`[debug] encoder outputs dims=${JSON.stringify(raw.dims)} lengths=${Array.from(lengths.data as BigInt64Array)}`);
    const hidden = raw.dims[1];
    const frameCount = raw.dims[2];
    const encoderData = raw.data as Float32Array;
    const frames = new Float32Array(frameCount * hidden);
    for (let c = 0; c < hidden; c++) {
        for (let t = 0; t < frameCount; t++) frames[t * hidden + c] = encoderData[c * frameCount + t];
    }
    const nFrames = Math.min(Number((lengths.data as BigInt64Array)[0]), frameCount);

    const vocabCount = vocab.idToToken.length;
    const blank = vocabCount - 1;
    let h: Float32Array<ArrayBuffer> = new Float32Array(2 * 640);
    let c2: Float32Array<ArrayBuffer> = new Float32Array(2 * 640);
    const tokens: number[] = [];
    let t = 0;
    let emitted = 0;
    let steps = 0;
    while (t < nFrames && steps < 100) {
        steps++;
        const feeds: Record<string, OrtValue> = {
            encoder_outputs: {
                dims: [1, hidden, 1],
                data: frames.slice(t * hidden, (t + 1) * hidden)
            },
            targets: {
                dims: [1, 1],
                data: new Int32Array([tokens.length > 0 ? tokens[tokens.length - 1] : blank])
            },
            target_length: int64Tensor([1], [1]),
            input_states_1: { dims: [2, 1, 640], data: h },
            input_states_2: { dims: [2, 1, 640], data: c2 }
        };
        const result = await decoderJoint.run(feeds);
        const flat = (result.outputs.data as Float32Array).length > 0 ? (result.outputs.data as Float32Array) : undefined;
        if (!flat) throw new Error("joint output missing");
        const tokenIndex = flat.slice(0, vocabCount).reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
        const durationIndex = flat.slice(vocabCount).reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
        console.log(
            `[debug] step=${steps} t=${t} token=${tokenIndex}("${vocab.idToToken[tokenIndex]}") duration=${durationIndex} ` +
                `stateNorms=${Math.hypot(...h.slice(0, 4)).toFixed(3)}`
        );
        if (tokenIndex !== blank) {
            h = result.output_states_1.data as Float32Array<ArrayBuffer>;
            c2 = result.output_states_2.data as Float32Array<ArrayBuffer>;
            tokens.push(tokenIndex);
            emitted++;
        }
        if (durationIndex > 0) {
            t += durationIndex;
            emitted = 0;
        } else if (tokenIndex === blank || emitted >= 5) {
            t += 1;
            emitted = 0;
        }
    }
    console.log(`[debug] ${steps}-step TDT transcript: "${nemoDetokenize(tokens, vocab).trim()}"`);
}

/** CLI entry point: see module doc for usage. */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        console.error("Usage: node parakeet-spike.cjs <encoder.onnx> <decoder_joint.onnx> <vocab.txt> <audio.wav> [...]");
        process.exit(1);
    }
    const [encoderPath, decoderPath, vocabPath, ...audioArgs] = args;

    const vocab = parseNemoVocab(readFileSync(vocabPath, "utf8"));
    console.log(`[spike] vocab: ${vocab.idToToken.length} tokens, blank="${vocab.idToToken[vocab.idToToken.length - 1]}"`);
    console.log(`[spike] vocab file bytes: ${readFileSync(vocabPath).length}`);
    console.log(`[spike] loading encoder: ${encoderPath}`);
    const encoderSession = await ort.InferenceSession.create(encoderPath, { executionProviders: ["cpu"], graphOptimizationLevel: "all" });
    console.log(`[spike]   inputs=${JSON.stringify(encoderSession.inputNames)} outputs=${JSON.stringify(encoderSession.outputNames)}`);
    console.log(`[spike] loading decoder_joint: ${decoderPath}`);
    const decoderSession = await ort.InferenceSession.create(decoderPath, { executionProviders: ["cpu"], graphOptimizationLevel: "all" });
    console.log(`[spike]   inputs=${JSON.stringify(decoderSession.inputNames)} outputs=${JSON.stringify(decoderSession.outputNames)}`);

    const transcriber = createParakeetTranscriber({
        encoder: toSessionLike(encoderSession),
        decoderJoint: toSessionLike(decoderSession),
        vocab
    });

    for (const wavPath of audioArgs) {
        const { pcm, durationSeconds, info } = loadWavAsPcm16k(wavPath);
        console.log(
            `[spike] ${wavPath}: format=${info.audioFormat} channels=${info.channels} rate=${info.sampleRate} ` +
                `bits=${info.bitsPerSample} → ${durationSeconds.toFixed(2)} s @ 16 kHz (${pcm.length} samples)`
        );

        if (process.env.PARAKEET_SPIKE_DEBUG === "1") {
            await debugDecode(toSessionLike(encoderSession), toSessionLike(decoderSession), vocab, pcm);
            continue;
        }

        const startedAt = performance.now();
        const transcript = await transcriber.transcribe(pcm);
        const elapsedSeconds = (performance.now() - startedAt) / 1000;
        const rssMb = process.memoryUsage().rss / (1024 * 1024);
        console.log(
            `[result] duration=${durationSeconds.toFixed(2)}s elapsed=${elapsedSeconds.toFixed(2)}s ` +
                `rtf=${(elapsedSeconds / durationSeconds).toFixed(3)} rss=${rssMb.toFixed(0)}MB`
        );
        console.log(`[result] transcript: ${transcript}`);
    }
}

main().catch((error: unknown) => {
    console.error("[spike] FAILED:", error);
    process.exit(1);
});
