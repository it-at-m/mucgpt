/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeNemoMel } from "./nemoMel";

interface MelCaseMeta {
    samples: number;
    totalFrames: number;
    validFrames: number;
}

const N_MELS = 128;
const MAX_ABS_DIFF = 5e-4;
const MEAN_ABS_DIFF = 5e-5;
const meta = JSON.parse(readFileSync(new URL("./fixtures/mel_meta.json", import.meta.url), "utf8")) as { cases: MelCaseMeta[] };

function loadF32(name: string): Float32Array {
    const file = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
    const copy = new ArrayBuffer(file.byteLength);
    new Uint8Array(copy).set(file);
    return new Float32Array(copy);
}

describe("computeNemoMel", () => {
    for (const melCase of meta.cases) {
        it(`matches the nemo128.onnx reference for ${melCase.samples} samples`, () => {
            const pcm = loadF32(`mel_pcm_${melCase.samples}.f32`);
            const expected = loadF32(`mel_expected_${melCase.samples}.f32`);
            expect(pcm.length).toBe(melCase.samples);

            const { features, totalFrames, validFrames } = computeNemoMel(pcm);
            expect(totalFrames).toBe(melCase.totalFrames);
            expect(validFrames).toBe(melCase.validFrames);
            expect(totalFrames).toBe(Math.floor(melCase.samples / 160) + 1);
            expect(features.length).toBe(N_MELS * totalFrames);
            expect(expected.length).toBe(features.length);

            let maxDiff = 0;
            let sumDiff = 0;
            let worst = "";
            for (let channel = 0; channel < N_MELS; channel++) {
                for (let frame = 0; frame < totalFrames; frame++) {
                    const index = channel * totalFrames + frame;
                    const diff = Math.abs(expected[index] - features[index]);
                    sumDiff += diff;
                    if (diff > maxDiff) {
                        maxDiff = diff;
                        worst = `channel ${channel}, frame ${frame}: expected ${expected[index]}, actual ${features[index]}`;
                    }
                }
            }
            expect(maxDiff, `max abs diff ${maxDiff} >= ${MAX_ABS_DIFF} at ${worst}`).toBeLessThan(MAX_ABS_DIFF);
            expect(sumDiff / features.length, `mean abs diff ${sumDiff / features.length} >= ${MEAN_ABS_DIFF}`).toBeLessThan(MEAN_ABS_DIFF);

            // Frames beyond the normalised range must be exactly zero (there are none for the
            // fixture cases, where the reference normalises over all totalFrames frames).
            for (let channel = 0; channel < N_MELS; channel++) {
                for (let frame = validFrames; frame < totalFrames; frame++) {
                    expect(features[channel * totalFrames + frame], `invalid frame not zeroed at channel ${channel}, frame ${frame}`).toBe(0);
                }
            }
        });
    }
});
