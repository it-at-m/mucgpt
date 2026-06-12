import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording";

export interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    startRecording: (onFrame: (frame: Float32Array) => void) => Promise<void>;
    stopRecording: () => void;
}

// Inlined AudioWorklet processor — runs in the audio rendering thread.
// Accumulates 128-sample blocks from the Web Audio pipeline into 512-sample
// frames (32 ms at 16 kHz) and forwards them via port.postMessage.
// 512 is the canonical chunk size required by onnx-community/silero-vad; using
// larger multiples (e.g. 1536) causes the model's internal feature extractor to
// produce a 5-D tensor [1,1,1,128,N] for the LSTM instead of the required 3-D
// [N,1,128], crashing with "Input X must have 3 dimensions only".
const PCM_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._frameSize = 512;
        this._targetSampleRate = 16000;
        this._sourceSampleRate = sampleRate;
        this._sourceStep = this._sourceSampleRate / this._targetSampleRate;
        this._sourceOffset = 0;
        this._lastSample = 0;
        this._buffer = new Float32Array(this._frameSize);
        this._pointer = 0;
    }

    _emitSample(sample) {
        this._buffer[this._pointer] = sample;
        this._pointer += 1;

        if (this._pointer >= this._frameSize) {
            const frame = this._buffer.slice();
            this.port.postMessage(frame, [frame.buffer]);
            this._pointer = 0;
        }
    }

    _emitNativeRate(mono) {
        let offset = 0;
        while (offset < mono.length) {
            const remaining = this._frameSize - this._pointer;
            const toCopy = Math.min(remaining, mono.length - offset);
            this._buffer.set(mono.subarray(offset, offset + toCopy), this._pointer);
            this._pointer += toCopy;
            offset += toCopy;

            if (this._pointer >= this._frameSize) {
                const frame = this._buffer.slice();
                this.port.postMessage(frame, [frame.buffer]);
                this._pointer = 0;
            }
        }
    }

    _emitResampled(mono) {
        while (this._sourceOffset < mono.length) {
            const index = Math.floor(this._sourceOffset);
            const fraction = this._sourceOffset - index;
            const current = mono[index] ?? this._lastSample;
            const next = index + 1 < mono.length ? mono[index + 1] : current;
            this._emitSample(current + (next - current) * fraction);
            this._sourceOffset += this._sourceStep;
        }

        this._sourceOffset -= mono.length;
        if (mono.length > 0) this._lastSample = mono[mono.length - 1];
    }

    process(inputs) {
        const channelData = inputs[0];
        if (!channelData || channelData.length === 0) return true;

        // Downmix to mono when the source is stereo.
        let mono;
        if (channelData.length === 1) {
            mono = channelData[0];
        } else {
            mono = new Float32Array(channelData[0].length);
            const scale = 1 / channelData.length;
            for (const ch of channelData) {
                for (let i = 0; i < ch.length; i++) mono[i] += ch[i] * scale;
            }
        }

        if (this._sourceSampleRate === this._targetSampleRate) this._emitNativeRate(mono);
        else this._emitResampled(mono);
        return true;
    }
}
registerProcessor("pcm-processor", PCMProcessor);
`;

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [recordingState, setRecordingState] = useState<RecordingState>("idle");
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(
        async (onFrame: (frame: Float32Array) => void) => {
            if (recordingState === "recording") return;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });

            // Use the browser's native context rate and resample explicitly in the
            // worklet so VAD and Whisper always receive 16 kHz audio.
            const audioCtx = new AudioContext();
            const blob = new Blob([PCM_PROCESSOR_CODE], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            try {
                await audioCtx.audioWorklet.addModule(url);
            } catch (err) {
                URL.revokeObjectURL(url);
                stream.getTracks().forEach(t => t.stop());
                await audioCtx.close();
                throw err;
            }
            URL.revokeObjectURL(url);

            streamRef.current = stream;
            audioContextRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // numberOfOutputs: 0 marks this as a pure sink — no audio is routed
            // to speakers and the node stays alive as long as it has an input.
            const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor", {
                numberOfOutputs: 0
            });
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
                onFrame(event.data);
            };

            source.connect(workletNode);
            setRecordingState("recording");
        },
        [recordingState]
    );

    const stopRecording = useCallback(() => {
        workletNodeRef.current?.port.close();
        workletNodeRef.current?.disconnect();
        workletNodeRef.current = null;
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
        setRecordingState("idle");
    }, []);

    return { recordingState, startRecording, stopRecording };
}
