import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording";

export interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    /**
     * Starts the capture pipeline. Rejects with the signal's reason (a standard
     * AbortError by default) when `signal` is aborted before or while the setup
     * runs — the stream, context and worklet are then fully torn down, no frame
     * is ever forwarded, and `recordingState` stays `idle`.
     */
    startRecording: (onFrame: (frame: Float32Array) => void, signal?: AbortSignal) => Promise<void>;
    stopRecording: () => void;
}

/** Standard rejection reason for an aborted start (falls back to the spec's default). */
export function abortReason(signal: AbortSignal): unknown {
    return signal.reason ?? new DOMException("The pending microphone start was aborted.", "AbortError");
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

    /** Closes worklet, source, stream and audio context. Idempotent; all refs are nulled. */
    const closeCapturePipeline = useCallback(() => {
        workletNodeRef.current?.port.close();
        workletNodeRef.current?.disconnect();
        workletNodeRef.current = null;
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        // Fire-and-forget teardown: a rejection here (e.g. a repeated close on a
        // deviating browser) must not become an unhandled rejection.
        audioContextRef.current?.close().catch(() => undefined);
        audioContextRef.current = null;
    }, []);

    const stopRecording = useCallback(() => {
        closeCapturePipeline();
        setRecordingState("idle");
    }, [closeCapturePipeline]);

    const startRecording = useCallback(
        async (onFrame: (frame: Float32Array) => void, signal?: AbortSignal) => {
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
            // The caller may have lost interest while the permission dialog was
            // open — release the mic immediately instead of building a pipeline
            // for a page that has already moved on.
            if (signal?.aborted) {
                stream.getTracks().forEach(t => t.stop());
                throw abortReason(signal);
            }

            // Use the browser's native context rate and resample explicitly in the
            // worklet so VAD and Whisper always receive 16 kHz audio.
            const audioCtx = new AudioContext();
            const blob = new Blob([PCM_PROCESSOR_CODE], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            try {
                await audioCtx.audioWorklet.addModule(url);
                URL.revokeObjectURL(url);

                // Every step below bails out into the shared cleanup when the
                // start was cancelled in the meantime — a partially built
                // pipeline (stream, context, source or worklet) must never leak.
                if (signal?.aborted) throw abortReason(signal);

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
                    // An abort landing between the last check and the connect must
                    // not let a stray frame reach the (possibly unmounted) consumer.
                    if (signal?.aborted) return;
                    onFrame(event.data);
                };

                if (signal?.aborted) throw abortReason(signal);

                source.connect(workletNode);
            } catch (err) {
                URL.revokeObjectURL(url);
                // The local `stream` also covers aborts that happened before the
                // ref assignment; closeCapturePipeline covers everything after.
                stream.getTracks().forEach(t => t.stop());
                closeCapturePipeline();
                // Cleanup must never replace the original cause: the context may
                // already be closing via closeCapturePipeline (and close() on a
                // closing context rejects in some browsers), so swallow any
                // rejection from this cleanup close.
                await audioCtx.close().catch(() => undefined);
                throw err;
            }
            setRecordingState("recording");
        },
        [recordingState]
    );

    useEffect(() => {
        return () => {
            if (recordingState === "recording") stopRecording();
        };
    }, [recordingState, stopRecording]);

    return { recordingState, startRecording, stopRecording };
}
