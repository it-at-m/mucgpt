import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording";

export interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    startRecording: (onFrame: (frame: Float32Array) => void) => Promise<void>;
    stopRecording: () => void;
}

// Inlined AudioWorklet processor — runs in the audio rendering thread.
// Accumulates 128-sample blocks from the Web Audio pipeline into 1536-sample
// frames (~96 ms at 16 kHz) and forwards them via port.postMessage.
const PCM_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._frameSize = 1536;
        this._buffer = new Float32Array(this._frameSize);
        this._pointer = 0;
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

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;

            // Request 16 kHz directly — the browser resamples from the device
            // rate, so no manual resampling step is needed downstream.
            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioCtx;

            const blob = new Blob([PCM_PROCESSOR_CODE], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            try {
                await audioCtx.audioWorklet.addModule(url);
            } finally {
                URL.revokeObjectURL(url);
            }

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
