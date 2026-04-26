import { useCallback, useRef, useState } from "react";

export type RecordingState = "idle" | "recording";

export interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    startRecording: (onInterimBlob?: (blob: Blob) => void) => Promise<void>;
    stopRecording: () => Promise<Blob | null>;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [recordingState, setRecordingState] = useState<RecordingState>("idle");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
    const mimeTypeRef = useRef<string>("");

    const startRecording = useCallback(
        async (onInterimBlob?: (blob: Blob) => void) => {
            if (recordingState === "recording") return;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                  ? "audio/webm"
                  : "";
            mimeTypeRef.current = mimeType;

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                    // Provide accumulated blob for live transcription — wait for ≥3 chunks (~3s) so Whisper
                    // has enough audio context to avoid hallucinations on very short inputs
                    if (onInterimBlob && chunksRef.current.length >= 3) {
                        const accumulated = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
                        onInterimBlob(accumulated);
                    }
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
                stream.getTracks().forEach(track => track.stop());
                streamRef.current = null;
                resolveRef.current?.(blob);
                resolveRef.current = null;
            };

            recorder.start(1000); // emit data every 1 second; ≥3 chunks required before first transcription
            setRecordingState("recording");
        },
        [recordingState]
    );

    const stopRecording = useCallback((): Promise<Blob | null> => {
        return new Promise(resolve => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recordingState !== "recording") {
                resolve(null);
                return;
            }
            resolveRef.current = resolve;
            recorder.stop();
            setRecordingState("idle");
        });
    }, [recordingState]);

    return { recordingState, startRecording, stopRecording };
}
