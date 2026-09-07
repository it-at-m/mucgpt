/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { CANARY_SUPPORTED_LANGUAGES, canaryPromptIds, createCanaryTranscriber } from "./canary/canaryTranscriber";
import { createParakeetTranscriber } from "./parakeet/parakeetTranscriber";
import type { NemoVocab, OrtSessionLike, OrtValue } from "./types";

function makeVocab(): NemoVocab {
    const specials = [
        "<unk>",
        "<|nospeech|>",
        "<pad>",
        "<|endoftext|>",
        "<|startoftranscript|>",
        "<|pnc|>",
        "<|nopnc|>",
        "<|startofcontext|>",
        "<|itn|>",
        "<|noitn|>",
        "<|notimestamp|>",
        "<|nodiarize|>",
        "<|emo:undefined|>",
        "<|en|>",
        "<|de|>",
        "<|fr|>",
        "<|es|>"
    ];
    const pieces = [" ", "▁Hallo", ",", "▁Welt", "!"];
    // parseNemoVocab maps ▁ → space; mirror that for hand-built vocabs.
    const idToToken = [...specials, ...pieces].map(token => token.replaceAll("▁", " "));
    const tokenToId = new Map(idToToken.map((token, id) => [token, id]));
    return { idToToken, tokenToId };
}

// 3200 samples ≈ 20 valid mel frames → passes the ≥2-frame guard.
const ONE_FIFTH_SECOND = new Float32Array(3200).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * i) / 16000));

function sessionFromScript(
    script: Array<(feeds: Record<string, OrtValue>) => Record<string, OrtValue>>
): OrtSessionLike & { calls: Record<string, OrtValue>[] } {
    let step = 0;
    return {
        inputNames: [],
        outputNames: [],
        calls: [],
        async run(feeds) {
            if (step >= script.length) throw new Error(`mock session overrun at step ${step}`);
            this.calls.push(Object.fromEntries(Object.entries(feeds).map(([k, v]) => [k, { dims: v.dims, data: v.data.slice() }])) as Record<string, OrtValue>);
            return script[step++](feeds);
        }
    };
}

function logits(value: number, vocabCount: number): OrtValue {
    const data = new Float32Array(vocabCount).fill(-1);
    data[value] = 0;
    return { dims: [1, 1, vocabCount], data };
}

describe("canary transcriber (mock sessions)", () => {
    const vocab = makeVocab();
    const eos = vocab.tokenToId.get("<|endoftext|>")!;
    const hallo = vocab.tokenToId.get(" Hallo")!;
    const comma = vocab.tokenToId.get(",")!;
    const promptLength = 10;

    it("builds the exact 10-token prompt with source and target language", () => {
        const prompt = canaryPromptIds(vocab, "de");
        expect(prompt).toHaveLength(promptLength);
        expect(prompt).toEqual([
            vocab.tokenToId.get(" ")!,
            vocab.tokenToId.get("<|startofcontext|>")!,
            vocab.tokenToId.get("<|startoftranscript|>")!,
            vocab.tokenToId.get("<|emo:undefined|>")!,
            vocab.tokenToId.get("<|de|>")!,
            vocab.tokenToId.get("<|de|>")!,
            vocab.tokenToId.get("<|pnc|>")!,
            vocab.tokenToId.get("<|noitn|>")!,
            vocab.tokenToId.get("<|notimestamp|>")!,
            vocab.tokenToId.get("<|nodiarize|>")!
        ]);
    });

    it("rejects unsupported languages", () => {
        expect(() => canaryPromptIds(vocab, "uk")).toThrow(/not supported by Canary/);
        expect([...CANARY_SUPPORTED_LANGUAGES]).toEqual(["en", "de", "fr", "es"]);
    });

    it("feeds the full prompt first, then one token per step, stopping at EOS", async () => {
        const encoder = sessionFromScript([
            () => ({
                encoder_embeddings: { dims: [1, 3, 4], data: new Float32Array(12).fill(0.5) },
                encoder_mask: { dims: [1, 3], data: new BigInt64Array([1n, 1n, 0n]) }
            })
        ]);
        const hiddenStates = (fedTokens: number): OrtValue => ({
            dims: [6, 1, fedTokens, 1024],
            data: new Float32Array(6 * fedTokens * 1024)
        });
        const decoder = sessionFromScript([
            // Step 1: full prompt, mems empty → emit "▁Hallo"
            feeds => {
                expect(feeds.input_ids.dims).toEqual([1, promptLength]);
                expect(feeds.decoder_mems.dims).toEqual([6, 1, 0, 1024]);
                return { logits: logits(hallo, vocab.idToToken.length), decoder_hidden_states: hiddenStates(promptLength) };
            },
            // Step 2: newest token only, mems carry the prompt hidden states → emit ","
            feeds => {
                const ids = feeds.input_ids.data as BigInt64Array;
                expect(feeds.input_ids.dims).toEqual([1, 1]);
                expect(ids[0]).toBe(BigInt(hallo));
                expect(feeds.decoder_mems.dims).toEqual([6, 1, promptLength, 1024]);
                return { logits: logits(comma, vocab.idToToken.length), decoder_hidden_states: hiddenStates(promptLength + 1) };
            },
            // Step 3: EOS terminates without appending
            feeds => {
                const ids = feeds.input_ids.data as BigInt64Array;
                expect(ids[0]).toBe(BigInt(comma));
                expect(feeds.decoder_mems.dims).toEqual([6, 1, promptLength + 1, 1024]);
                return { logits: logits(eos, vocab.idToToken.length), decoder_hidden_states: hiddenStates(promptLength + 2) };
            }
        ]);

        const transcriber = createCanaryTranscriber({ encoder, decoder, vocab });
        await expect(transcriber.transcribe(ONE_FIFTH_SECOND, "de")).resolves.toBe("Hallo,");
        expect(encoder.calls).toHaveLength(1);
        expect(decoder.calls).toHaveLength(3);
    });

    it("returns empty text for audio shorter than two mel frames", async () => {
        const encoder = sessionFromScript([]);
        const decoder = sessionFromScript([]);
        const transcriber = createCanaryTranscriber({ encoder, decoder, vocab });
        await expect(transcriber.transcribe(new Float32Array(100), "en")).resolves.toBe("");
        expect(encoder.calls).toHaveLength(0);
    });
});

describe("parakeet transcriber (mock sessions)", () => {
    // Vocab with trailing <blk>: token logits span [0, 5), duration logits follow.
    // ▁ already mapped to spaces, as parseNemoVocab does.
    const idToToken = ["<unk>", " Hallo", ",", " Welt", "<blk>"];
    const vocab: NemoVocab = { idToToken, tokenToId: new Map(idToToken.map((token, id) => [token, id])) };
    const vocabCount = idToToken.length;
    const blank = vocabCount - 1;
    const hidden = 4;
    const nFrames = 3;

    function encoderSession(): OrtSessionLike {
        // Channels-first [1, hidden, nFrames]
        const data = new Float32Array(hidden * nFrames).fill(0.25);
        return {
            inputNames: [],
            outputNames: [],
            async run() {
                return {
                    outputs: { dims: [1, hidden, nFrames], data },
                    encoded_lengths: { dims: [1], data: new BigInt64Array([BigInt(nFrames)]) }
                };
            }
        };
    }

    it("advances frames on duration steps and commits LSTM state only on emitted tokens", async () => {
        const hallo = 1;
        const comma = 2;
        const welt = 3;
        const jointOutput = (token: number, duration: number, nextState: number): Record<string, OrtValue> => {
            const data = new Float32Array(vocabCount + 5).fill(-1);
            data[token] = 0;
            data[vocabCount + duration] = 0;
            const state = { dims: [2, 1, 640], data: new Float32Array(2 * 640).fill(nextState) };
            return { outputs: { dims: [1, 1, 1, vocabCount + 5], data }, output_states_1: state, output_states_2: state };
        };

        const decoderJoint = sessionFromScript([
            feeds => {
                expect((feeds.targets.data as Int32Array)[0]).toBe(blank);
                expect(feeds.encoder_outputs.dims).toEqual([1, hidden, 1]);
                return jointOutput(hallo, 0, 1);
            },
            feeds => {
                expect((feeds.targets.data as Int32Array)[0]).toBe(hallo);
                return jointOutput(comma, 0, 2);
            },
            feeds => {
                expect((feeds.targets.data as Int32Array)[0]).toBe(comma);
                // Blank with duration 2 jumps from frame 0 to frame 2.
                return jointOutput(blank, 2, 3);
            },
            feeds => {
                expect((feeds.targets.data as Int32Array)[0]).toBe(comma);
                return jointOutput(welt, 0, 4);
            },
            feeds => {
                expect((feeds.targets.data as Int32Array)[0]).toBe(welt);
                // Blank with duration 0 must force a +1 frame advance.
                return jointOutput(blank, 0, 5);
            }
        ]);

        const transcriber = createParakeetTranscriber({ encoder: encoderSession(), decoderJoint, vocab });
        await expect(transcriber.transcribe(ONE_FIFTH_SECOND)).resolves.toBe("Hallo, Welt");
        expect(decoderJoint.calls).toHaveLength(5);
    });

    it("returns empty text for audio shorter than two mel frames", async () => {
        const decoderJoint = sessionFromScript([]);
        const transcriber = createParakeetTranscriber({ encoder: encoderSession(), decoderJoint, vocab });
        await expect(transcriber.transcribe(new Float32Array(100))).resolves.toBe("");
        expect(decoderJoint.calls).toHaveLength(0);
    });
});
