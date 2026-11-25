/**
 * Streaming playback for a phonon-tts `SpeechStream`: schedules PCM chunks
 * into an `AudioContext` gaplessly as they are generated (the pattern from
 * the phonon-tts browser guide) and resolves once everything was played or
 * the abort signal fired.
 */
export async function playSpeechStream(
    stream: AsyncIterable<Float32Array> & {
        readonly sampleRate: number;
        /** Cancels generation and discards unread chunks. */
        cancel(): void;
    },
    options: { signal: AbortSignal }
): Promise<void> {
    // The speak action originates from a user click, so the context may start
    // immediately; resume() covers transiently suspended contexts.
    const ctx = new AudioContext({ sampleRate: stream.sampleRate });
    await ctx.resume().catch(() => undefined);

    const sources: AudioBufferSourceNode[] = [];
    let stopped = false;
    /** End time of the last scheduled sample in ctx time. */
    let playCursor = ctx.currentTime;

    const stopAll = () => {
        stopped = true;
        for (const source of sources) {
            try {
                source.stop();
            } catch {
                // A source that never started cannot be stopped.
            }
        }
        void ctx.close().catch(() => undefined);
    };
    options.signal.addEventListener("abort", stopAll, { once: true });

    try {
        for await (const pcm of stream) {
            if (stopped || options.signal.aborted) break;
            const buffer = ctx.createBuffer(1, pcm.length, stream.sampleRate);
            buffer.getChannelData(0).set(pcm);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            // Never schedule in the past when a chunk arrives late.
            playCursor = Math.max(playCursor, ctx.currentTime);
            source.start(playCursor);
            playCursor += buffer.duration;
            sources.push(source);
        }

        // Let the already-scheduled audio drain before reporting "done" —
        // unless a stop came in, which closed the context above.
        if (!stopped && !options.signal.aborted) {
            const remainingMs = Math.max(0, (playCursor - ctx.currentTime) * 1000);
            await new Promise(resolve => setTimeout(resolve, remainingMs + 50));
        }
    } finally {
        options.signal.removeEventListener("abort", stopAll);
        if (!stopped) void ctx.close().catch(() => undefined);
        // Harmless after a full iteration (no unread chunks); essential when
        // we broke out early so the worker stops generating.
        stream.cancel();
    }
}
