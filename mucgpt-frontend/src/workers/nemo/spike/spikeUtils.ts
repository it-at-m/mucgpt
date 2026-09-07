import { readFileSync } from "node:fs";
import * as ort from "onnxruntime-node";
import type { OrtSessionLike, OrtValue } from "../types";

const TARGET_SAMPLE_RATE = 16000;

/** Ships an OrtValue-style feed into an onnxruntime Tensor. */
export function toTensor(value: OrtValue): ort.Tensor {
    const { data } = value;
    if (data instanceof Float32Array) return new ort.Tensor(data, [...value.dims]);
    if (data instanceof BigInt64Array) return new ort.Tensor(data, [...value.dims]);
    if (data instanceof Int32Array) return new ort.Tensor(data, [...value.dims]);
    if (data instanceof Uint8Array) return new ort.Tensor(data, [...value.dims]);
    if (data instanceof Int8Array) return new ort.Tensor(data, [...value.dims]);
    throw new Error("Unsupported OrtValue data type");
}

/** Unwraps an onnxruntime output tensor into the structural OrtValue shape. */
export function toOrtValue(tensor: ort.Tensor): OrtValue {
    const { data } = tensor;
    if (
        data instanceof Float32Array ||
        data instanceof BigInt64Array ||
        data instanceof Int32Array ||
        data instanceof Uint8Array ||
        data instanceof Int8Array
    ) {
        return { dims: tensor.dims, data };
    }
    throw new Error(`Unsupported tensor output type: ${tensor.type}`);
}

/** Adapter letting the shared transcriber code run on onnxruntime-node sessions. */
export function toSessionLike(session: ort.InferenceSession): OrtSessionLike {
    return {
        inputNames: session.inputNames,
        outputNames: session.outputNames,
        async run(feeds: Record<string, OrtValue>): Promise<Record<string, OrtValue>> {
            const ortFeeds: Record<string, ort.Tensor> = {};
            for (const [name, value] of Object.entries(feeds)) ortFeeds[name] = toTensor(value);
            const outputs = await session.run(ortFeeds);
            const result: Record<string, OrtValue> = {};
            for (const [name, tensor] of Object.entries(outputs)) result[name] = toOrtValue(tensor);
            return result;
        }
    };
}

export interface WavInfo {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    dataOffset: number;
    dataLength: number;
}

/** Minimal RIFF header parser for PCM16 / PCM float32 mono WAV files. */
export function parseWav(buffer: Buffer): WavInfo {
    if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("Not a RIFF/WAVE file");
    }
    let offset = 12;
    let fmt: Omit<WavInfo, "dataOffset" | "dataLength"> | undefined;
    let data: { offset: number; length: number } | undefined;
    while (offset + 8 <= buffer.length) {
        const chunkId = buffer.toString("ascii", offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (chunkId === "fmt " && chunkSize >= 16) {
            fmt = {
                audioFormat: buffer.readUInt16LE(body),
                channels: buffer.readUInt16LE(body + 2),
                sampleRate: buffer.readUInt32LE(body + 4),
                bitsPerSample: buffer.readUInt16LE(body + 14)
            };
        } else if (chunkId === "data") {
            data = { offset: body, length: Math.min(chunkSize, buffer.length - body) };
        }
        offset = body + chunkSize + (chunkSize % 2);
    }
    if (!fmt || !data) throw new Error("WAV file is missing fmt or data chunk");
    return { ...fmt, dataOffset: data.offset, dataLength: data.length };
}

/** Decodes the audio chunk of a parsed WAV into mono float32 samples. */
export function decodeWavMono(buffer: Buffer, wav: WavInfo): Float32Array {
    if (!((wav.audioFormat === 1 && wav.bitsPerSample === 16) || (wav.audioFormat === 3 && wav.bitsPerSample === 32))) {
        throw new Error(`Unsupported WAV encoding: format ${wav.audioFormat}, ${wav.bitsPerSample} bits`);
    }
    const bytesPerSample = wav.bitsPerSample / 8;
    const stride = wav.channels * bytesPerSample;
    const frames = Math.floor(wav.dataLength / stride);
    const raw = buffer.subarray(wav.dataOffset, wav.dataOffset + wav.dataLength);
    const chunk = new ArrayBuffer(raw.byteLength);
    new Uint8Array(chunk).set(raw);
    const view = new DataView(chunk);
    const mono = new Float32Array(frames);
    for (let frame = 0; frame < frames; frame++) {
        let sum = 0;
        for (let channel = 0; channel < wav.channels; channel++) {
            const at = frame * stride + channel * bytesPerSample;
            sum += wav.audioFormat === 3 ? view.getFloat32(at, true) : view.getInt16(at, true) / 32768;
        }
        mono[frame] = sum / wav.channels;
    }
    return mono;
}

/** Linear-interpolation resampler; only used to normalise SAPI 22 kHz output for tests. */
export function resampleTo16k(pcm: Float32Array, sourceRate: number): Float32Array {
    if (sourceRate === TARGET_SAMPLE_RATE) return pcm;
    const step = sourceRate / TARGET_SAMPLE_RATE;
    const outLength = Math.floor(pcm.length / step);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        const position = i * step;
        const index = Math.floor(position);
        const next = Math.min(index + 1, pcm.length - 1);
        const frac = position - index;
        out[i] = pcm[index] * (1 - frac) + pcm[next] * frac;
    }
    return out;
}

/** Loads and normalises any supported WAV file to 16 kHz mono float32. */
export function loadWavAsPcm16k(path: string): { pcm: Float32Array; durationSeconds: number; info: WavInfo } {
    const buffer = readFileSync(path);
    const info = parseWav(buffer);
    const mono = decodeWavMono(buffer, info);
    return { pcm: resampleTo16k(mono, info.sampleRate), durationSeconds: mono.length / info.sampleRate, info };
}

/** Builds an int64 OrtValue from plain numbers. */
export function int64Tensor(values: readonly number[], dims: readonly number[]): OrtValue {
    const data = new BigInt64Array(values.length);
    for (let i = 0; i < values.length; i++) data[i] = BigInt(values[i]);
    return { dims, data };
}
