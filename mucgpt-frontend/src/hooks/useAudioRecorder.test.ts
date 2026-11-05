// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";

/** Minimal MediaStream/MediaStreamTrack double. */
class FakeTrack {
    stopped = false;
    stop(): void {
        this.stopped = true;
    }
}
class FakeStream {
    tracks: FakeTrack[] = [new FakeTrack()];
    getTracks(): FakeTrack[] {
        return this.tracks;
    }
}

/** Minimal AudioContext double (jsdom has no Web Audio); addModule can be held open or failed per start. */
class FakeAudioWorklet {
    static holdNext = false;
    static failNext = false;
    resolveModule: (() => void) | null = null;
    addModule = vi.fn(() => {
        if (FakeAudioWorklet.failNext) {
            FakeAudioWorklet.failNext = false;
            return Promise.reject(new Error("load failed"));
        }
        if (FakeAudioWorklet.holdNext) return new Promise<void>(resolve => (this.resolveModule = resolve));
        return Promise.resolve();
    });
}
class FakeWorkletNode {
    static last: FakeWorkletNode | null = null;
    port = {
        onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null,
        close: vi.fn(),
        postMessage: vi.fn()
    };
    disconnect = vi.fn();
    constructor() {
        FakeWorkletNode.last = this;
    }
}
class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    audioWorklet = new FakeAudioWorklet();
    closed = false;
    createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
    close = vi.fn(async () => {
        this.closed = true;
    });
    constructor() {
        FakeAudioContext.instances.push(this);
    }
}

let getUserMediaMock: ReturnType<typeof vi.fn>;
let lastStream: FakeStream;
const realCreateObjectURL = URL.createObjectURL;
const realRevokeObjectURL = URL.revokeObjectURL;

function stubWebAudio(): void {
    lastStream = new FakeStream();
    getUserMediaMock = vi.fn().mockResolvedValue(lastStream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: getUserMediaMock } });
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("AudioWorkletNode", FakeWorkletNode);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
}

afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    FakeAudioContext.instances = [];
    FakeWorkletNode.last = null;
    FakeAudioWorklet.holdNext = false;
    FakeAudioWorklet.failNext = false;
});

/** Lets the async chain run to its next suspension point. */
const settle = () => act(async () => {});

describe("useAudioRecorder", () => {
    it("releases the mic and rejects when aborted during the permission prompt", async () => {
        stubWebAudio();
        const hook = renderHook(() => useAudioRecorder());
        const controller = new AbortController();
        let resolveGUM!: (stream: FakeStream) => void;
        getUserMediaMock.mockReturnValue(new Promise<FakeStream>(resolve => (resolveGUM = resolve)));

        const start = hook.result.current.startRecording(vi.fn(), controller.signal);
        // Attach the rejection expectation before the chain can reject (inside
        // the act below) — a later attachment trips Node's "rejection handled
        // asynchronously" detection.
        const rejection = expect(start).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await act(async () => resolveGUM(lastStream));
        await rejection;
        // The mic was released immediately — no pipeline was ever built.
        expect(lastStream.tracks[0].stopped).toBe(true);
        expect(FakeAudioContext.instances).toHaveLength(0);
        expect(hook.result.current.recordingState).toBe("idle");
    });

    it("tears down stream and context when aborted during the worklet module load", async () => {
        stubWebAudio();
        FakeAudioWorklet.holdNext = true;
        const hook = renderHook(() => useAudioRecorder());
        const controller = new AbortController();

        const start = hook.result.current.startRecording(vi.fn(), controller.signal);
        await settle();
        const ctx = FakeAudioContext.instances[0]!;

        controller.abort();
        ctx.audioWorklet.resolveModule!();
        await expect(start).rejects.toMatchObject({ name: "AbortError" });

        // The abort landed at the check after addModule: no worklet exists, the
        // partially built pipeline (stream + context) is gone.
        expect(FakeWorkletNode.last).toBeNull();
        expect(ctx.closed).toBe(true);
        expect(lastStream.tracks[0].stopped).toBe(true);
        expect(hook.result.current.recordingState).toBe("idle");
    });

    it("stops forwarding frames once the start is aborted after it succeeded", async () => {
        stubWebAudio();
        const hook = renderHook(() => useAudioRecorder());
        const onFrame = vi.fn();
        const controller = new AbortController();

        await act(async () => {
            await hook.result.current.startRecording(onFrame, controller.signal);
        });
        expect(hook.result.current.recordingState).toBe("recording");

        const worklet = FakeWorkletNode.last!;
        worklet.port.onmessage!({ data: new Float32Array(4) } as MessageEvent<Float32Array>);
        expect(onFrame).toHaveBeenCalledTimes(1);

        controller.abort();
        worklet.port.onmessage!({ data: new Float32Array(4) } as MessageEvent<Float32Array>);
        expect(onFrame).toHaveBeenCalledTimes(1); // the late frame never reached the consumer
    });

    it("keeps the plain start/stop flow working without a signal", async () => {
        stubWebAudio();
        const hook = renderHook(() => useAudioRecorder());
        const onFrame = vi.fn();

        await act(async () => {
            await hook.result.current.startRecording(onFrame);
        });
        expect(hook.result.current.recordingState).toBe("recording");
        expect(FakeWorkletNode.last!.port.onmessage).not.toBeNull();

        await act(async () => {
            hook.result.current.stopRecording();
        });
        expect(hook.result.current.recordingState).toBe("idle");
        expect(FakeAudioContext.instances[0]!.closed).toBe(true);
        expect(FakeWorkletNode.last!.port.close).toHaveBeenCalled();
    });

    it("cleans up the stream and context when the worklet module fails to load", async () => {
        stubWebAudio();
        FakeAudioWorklet.failNext = true;
        const hook = renderHook(() => useAudioRecorder());

        const start = hook.result.current.startRecording(vi.fn());
        let failure: unknown;
        await act(async () => {
            failure = await start.catch(error => error);
        });

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toBe("load failed");
        expect(lastStream.tracks[0].stopped).toBe(true);
        expect(FakeAudioContext.instances[0]!.closed).toBe(true);
        expect(hook.result.current.recordingState).toBe("idle");
    });
});
