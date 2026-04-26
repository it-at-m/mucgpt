# Transcription Extension: Silero VAD

Deferred follow-up to the Whisper WebGPU optimization (features A–E). This doc captures the plan so it can be picked up without re-deriving it.

## Goal

Replace time-based interim polling with Voice Activity Detection. Transcribe speech segments only — not silence, not growing buffers.

## Reference

`huggingface/transformers.js-examples/moonshine-web/src/worker.js` — directly adaptable pattern.

## Model

- `onnx-community/silero-vad`
- ~1.5 MB, `dtype: "fp32"`
- Load via `AutoModel.from_pretrained` with `config: { model_type: "custom" }`

## Audio pipeline rewrite

Current: `MediaRecorder` → webm/opus blobs every 1s → `decodeAudioData` → resample → worker.

Needed: raw Float32 PCM at 16 kHz in ~100 ms chunks, streamed to worker.

Replace `useAudioRecorder` with an `AudioWorklet`-based recorder:

- `getUserMedia({ audio: true })`
- `AudioContext({ sampleRate: 16000 })`
- `MediaStreamSource` → `AudioWorkletNode`
- Worklet emits `Float32Array` frames (e.g. 1536 samples ≈ 96 ms at 16 kHz) via `port.postMessage`
- Main thread forwards each frame to the transcription worker with `postMessage({ type: "audio-frame", buffer }, [buffer.buffer])` (transferable)

Keep `MediaRecorder` path only if we still want a fallback for browsers without `AudioWorklet` — all evergreen browsers support it, so likely drop.

## Worker state

```ts
const SAMPLE_RATE = 16000;
const MAX_BUFFER_DURATION = 30; // seconds
const SPEECH_THRESHOLD = 0.3;
const EXIT_THRESHOLD = 0.1;
const MIN_SILENCE_DURATION_SAMPLES = 0.4 * SAMPLE_RATE; // 400 ms
const MIN_SPEECH_DURATION_SAMPLES = 0.25 * SAMPLE_RATE; // 250 ms
const SPEECH_PAD_SAMPLES = 0.1 * SAMPLE_RATE; // 100 ms
const MAX_NUM_PREV_BUFFERS = 4; // ~400 ms lookback

const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let bufferPointer = 0;
let isRecording = false;
let postSpeechSamples = 0;
let prevBuffers: Float32Array[] = []; // FIFO lookback for speech onset
let vadState = new Tensor("float32", new Float32Array(2 * 1 * 128), [2, 1, 128]);
const sr = new Tensor("int64", [SAMPLE_RATE], []);
```

## Flow per frame

1. Run Silero VAD on incoming frame. Speech if `prob > SPEECH_THRESHOLD`, or (already recording and `prob >= EXIT_THRESHOLD`).
2. If not recording and not speech → push frame into `prevBuffers` FIFO (cap `MAX_NUM_PREV_BUFFERS`). Discard oldest.
3. If recording or new speech → append frame to `BUFFER`.
4. On speech start: emit `recording_start` status; reset `postSpeechSamples`.
5. On continuing silence after speech:
    - If `postSpeechSamples < MIN_SILENCE_DURATION_SAMPLES` → keep buffering (short pause).
    - If segment shorter than `MIN_SPEECH_DURATION_SAMPLES` → discard (likely noise).
    - Else → build `paddedBuffer = [...prevBuffers, BUFFER[0..pointer + SPEECH_PAD_SAMPLES]]`, dispatch to Whisper, reset.
6. Buffer overflow (speech longer than `MAX_BUFFER_DURATION`): flush current segment, keep tail as new segment start.

## Transcription dispatch

Chain Whisper calls via `inferenceChain = inferenceChain.then(() => transcriber(paddedBuffer))` — transformers.js forbids concurrent inference on a single pipeline. VAD and Whisper share the chain.

Emit each completed segment as `{ type: "segment", text, start, end }`. Main thread concatenates segments into the live transcript.

## UI/context changes

`TranscriptionSettingsContext`:

- Drop `handleInterimBlob` + `resampleAudioTo16kHz`.
- Worker message handler learns `"segment"` type — append to `transcript` instead of replace.
- `stopAndTranscribe` becomes "stop audio stream + flush pending segment." No final full-buffer transcription needed — VAD already segmented everything.

`MicrophoneButton`: no change.

## Tradeoffs

- **Pro**: silence is free, no re-transcription, natural segment boundaries, lower total compute.
- **Con**: no live token-streaming inside a segment (unless combined with TextStreamer — compatible, just more wiring). Segments arrive after pauses, so very long unbroken speech shows no feedback until pause.
- **Mitigation**: hard-cap segments at e.g. 10 s — force flush even without pause. Combine with TextStreamer inside each segment for token-level interim.

## Tuning knobs

Silero thresholds are the main tuning surface. Start with Moonshine defaults (above). Expose `SPEECH_THRESHOLD`, `MIN_SILENCE_DURATION_SAMPLES` in `TranscriptionSettingsDialog` if users report too-aggressive or too-lax segmentation.

## Browser support

- `AudioWorklet`: all evergreen browsers.
- Silero VAD via ONNX Runtime Web: WASM works everywhere; WebGPU not needed (VAD too small to benefit).
- Keep VAD on WASM even when Whisper runs on WebGPU — avoids GPU contention on small repeated inferences.

## Out of scope here

- Diarization (who spoke).
- Punctuation restoration between VAD segments — Whisper already emits punctuation per segment; cross-segment punctuation stays rough.
- Server-side VAD path.
