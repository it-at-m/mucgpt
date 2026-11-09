// @vitest-environment jsdom
import { useContext } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptionProvider, TranscriptionContext, type ITranscription, type TranscriptionModelState } from "./TranscriptionContext";
import type { WorkerInMessage, WorkerOutMessage } from "../../workers/transcription.worker";
import type { TranscriptionModel } from "../../config/transcriptionModels";
import { markModelVerified, isModelDownloaded } from "../../utils/transcriptionModelCache";
import { LOAD_WATCHDOG_MS } from "./TranscriptionContext";

const stableT = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

/** Mutable so tests can simulate an interface language switch mid-flight. */
const i18nMock = vi.hoisted(() => ({
    language: "DE",
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: i18nMock.t,
        i18n: { language: i18nMock.language }
    })
}));

const stableRecorder = { recordingState: "idle", startRecording: vi.fn(), stopRecording: vi.fn() };
vi.mock("../../hooks/useAudioRecorder", () => ({
    useAudioRecorder: () => stableRecorder,
    // The provider imports this helper from the hook module — the factory replaces
    // the whole module, so it must be provided here as well.
    abortReason: (signal: AbortSignal) => signal.reason ?? new DOMException("aborted", "AbortError")
}));

vi.mock("../../utils/modelSizeUtils", () => ({ fetchModelFileSizes: vi.fn().mockResolvedValue({ "onnx/encoder_model_q4.onnx": 100 }) }));

const whisper: TranscriptionModel = {
    model_id: "onnx-community/whisper-small",
    label: "Whisper Small",
    size_hint: "~220 MB",
    dtype: { encoder_model: "q4", decoder_model_merged: "int8" }
};

/** Plain worker double: records inbound messages and lets tests push replies. */
class FakeWorker {
    static instances: FakeWorker[] = [];
    onmessage: ((event: MessageEvent<WorkerOutMessage>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    sent: WorkerInMessage[] = [];

    constructor() {
        FakeWorker.instances.push(this);
    }

    postMessage(msg: WorkerInMessage): void {
        this.sent.push(msg);
    }

    terminate(): void {}

    /** Drives the message pump the component listens on. */
    reply(msg: WorkerOutMessage): void {
        this.onmessage?.({ data: msg } as unknown as MessageEvent<WorkerOutMessage>);
    }

    get latestLoad(): Extract<WorkerInMessage, { type: "load" }> | undefined {
        return [...this.sent].reverse().find((m): m is Extract<WorkerInMessage, { type: "load" }> => m.type === "load");
    }
}

/** Repository for the most recent context value (written by the probe). */
const holder: { last: ITranscription | null } = { last: null };

/** Minimal fake CacheStorage (fresh per test). */
function createFakeCacheStore() {
    const stores = new Map<string, Map<string, string>>();
    const urlOf = (request: RequestInfo | URL): string => (typeof request === "string" ? request : request instanceof URL ? request.href : request.url);
    const open = vi.fn(async (name: string) => {
        if (!stores.has(name)) stores.set(name, new Map());
        const entries = stores.get(name)!;
        return {
            match: async (request: RequestInfo | URL) => (entries.has(urlOf(request)) ? new Response("cached") : undefined),
            put: async (request: RequestInfo | URL, response: Response) => {
                void response;
                entries.set(urlOf(request), "ok");
            },
            delete: async (request: RequestInfo | URL) => entries.delete(urlOf(request)),
            keys: async () => [...entries.keys()].map(url => new Request(url))
        };
    });
    return { open, stores };
}

let store: ReturnType<typeof createFakeCacheStore>;

/** Renders the provider and exposes the current context via {@link holder}. */
function renderProvider(transcriptionModelId: string | null) {
    const Probe = () => {
        const context = useContext(TranscriptionContext);
        holder.last = context;
        return null;
    };
    render(
        <TranscriptionProvider transcriptionEnabled transcriptionModelId={transcriptionModelId}>
            <Probe />
        </TranscriptionProvider>
    );
}

/** Waits until the provider reports the given model state. */
async function waitForModelState(state: TranscriptionModelState): Promise<ITranscription> {
    return await waitFor(
        () => {
            if (holder.last === null || holder.last.modelState !== state) {
                throw new Error(`waiting for ${state}, got ${holder.last?.modelState}`);
            }
            return holder.last;
        },
        { timeout: 2000 }
    );
}

beforeEach(() => {
    store = createFakeCacheStore();
    vi.stubGlobal("caches", { open: store.open });
    // Note: `location` must keep jsdom's value — stubbing it breaks relative `new URL`
    // resolution against the worker URL used by the provider.
    vi.stubGlobal("Worker", FakeWorker);
    FakeWorker.instances = [];
    holder.last = null;
    stableRecorder.startRecording.mockReset();
    stableRecorder.stopRecording.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/** Seeds both ONNX weights the registry's dtype requires for the whisper fixture. */
async function seedWhisperCache() {
    const transformers = await store.open("transformers-cache");
    await transformers.put(`https://huggingface.co/${whisper.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("ok"));
    await transformers.put(`https://huggingface.co/${whisper.model_id}/resolve/main/onnx/decoder_model_merged_int8.onnx`, new Response("ok"));
}

describe("TranscriptionProvider", () => {
    it("disables transcription silently when no model is configured (null)", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        renderProvider(null);

        await waitFor(() => expect(holder.last?.enabled).toBe(false));
        expect(holder.last?.model).toBeNull();
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(0));
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it("disables transcription with a warning for an unknown configured model id", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        renderProvider("does/not-exist");

        await waitFor(() => expect(holder.last?.enabled).toBe(false));
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(0));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does/not-exist"));
    });

    it("auto-loads a verified download on boot and recovers `ready` on load", async () => {
        await markModelVerified(whisper);
        await seedWhisperCache();

        renderProvider(whisper.model_id);

        await waitForModelState("loading");
        expect(FakeWorker.instances).toHaveLength(1);

        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });

        const context = await waitForModelState("ready");
        expect(context.enabled).toBe(true);
    });

    it("refuses to start with a visible error when the model cannot transcribe the UI language", async () => {
        // The distil-whisper registry entry only declares German and stores its
        // decoder with the q8 dtype (→ decoder_model_merged_quantized.onnx).
        const distil: TranscriptionModel = {
            model_id: "flackzz/distil-whisper-large-v3-german_timestamped-ONNX",
            label: "Distil-Whisper Large v3 German",
            dtype: { encoder_model: "q4", decoder_model_merged: "q8" },
            languages: ["de"]
        };
        await markModelVerified(distil);
        const transformers = await store.open("transformers-cache");
        await transformers.put(`https://huggingface.co/${distil.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("ok"));
        await transformers.put(`https://huggingface.co/${distil.model_id}/resolve/main/onnx/decoder_model_merged_quantized.onnx`, new Response("ok"));

        renderProvider(distil.model_id);
        await waitForModelState("loading");
        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: distil.model_id });
        await waitForModelState("ready");

        // A language the German-only model cannot transcribe (the
        // Ukrainian-UI scenario): the start must reject AND move out of
        // "idle", or the mic button's reopened panel renders no error and
        // the refusal is invisible.
        holder.last!.setLanguage("uk");
        await waitFor(() => expect(holder.last?.language).toBe("uk"));
        await expect(holder.last!.startRecording()).rejects.toThrow();
        await waitFor(() => expect(holder.last?.status).toBe("error"));
        expect(holder.last?.error).toBe("components.transcription.language_unsupported");
        // The refusal happens before any capture starts.
        expect(FakeWorker.instances[0]!.sent.some(m => m.type === "start-recording")).toBe(false);
    });

    /** Boots the whisper fixture to the `ready` state and returns the worker double. */
    async function readyProvider(): Promise<FakeWorker> {
        await markModelVerified(whisper);
        await seedWhisperCache();
        renderProvider(whisper.model_id);
        await waitForModelState("loading");
        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });
        await waitForModelState("ready");
        return worker;
    }

    it("retracts a pending start silently when it is cancelled mid-setup", async () => {
        const worker = await readyProvider();

        // The audio hook hangs on its setup (a permission dialog nobody answers)
        // and then rejects because its signal was aborted meanwhile.
        let capturedSignal: AbortSignal | undefined;
        let rejectHook!: (reason: unknown) => void;
        stableRecorder.startRecording.mockImplementation(
            (_onFrame: (frame: Float32Array) => void, signal: AbortSignal) =>
                new Promise<void>((_resolve, reject) => {
                    capturedSignal = signal;
                    rejectHook = reason => reject(reason);
                })
        );

        const start = holder.last!.startRecording();
        await waitFor(() => expect(capturedSignal).toBeDefined());
        holder.last!.cancelPendingStart();
        rejectHook(capturedSignal!.reason);

        await expect(start).rejects.toMatchObject({ name: "AbortError" });
        // A cancelled start is not an error: no message, status back to idle.
        expect(holder.last?.status).toBe("idle");
        expect(holder.last?.error).toBeNull();
        // The worker session opened before the abort is retracted afterwards.
        const sent = worker.sent.map(m => m.type);
        expect(sent).toContain("start-recording");
        expect(sent.indexOf("stop-recording")).toBeGreaterThan(sent.indexOf("start-recording"));
    });

    it("tears down a brand-new capture when the cancellation lands as the hook resolves", async () => {
        const worker = await readyProvider();

        // The hook finishes successfully — the abort arrives while it hands the
        // fresh capture back, a race the hook itself cannot observe.
        let capturedSignal: AbortSignal | undefined;
        let releaseHook!: () => void;
        stableRecorder.startRecording.mockImplementation(
            (_onFrame: (frame: Float32Array) => void, signal: AbortSignal) =>
                new Promise<void>(resolve => {
                    capturedSignal = signal;
                    releaseHook = resolve;
                })
        );

        const start = holder.last!.startRecording();
        await waitFor(() => expect(capturedSignal).toBeDefined());
        holder.last!.cancelPendingStart();
        releaseHook();

        await expect(start).rejects.toMatchObject({ name: "AbortError" });
        // The provider closed the fresh capture itself ...
        expect(stableRecorder.stopRecording).toHaveBeenCalled();
        // ... and never signalled "recording" to the UI.
        expect(holder.last?.status).toBe("idle");
        expect(holder.last?.error).toBeNull();
        expect(worker.sent.map(m => m.type)).toContain("stop-recording");
    });

    it("keeps forwarding audio frames to the worker while the capture runs", async () => {
        await readyProvider();

        let forwardFrame!: (frame: Float32Array) => void;
        stableRecorder.startRecording.mockImplementation((onFrame: (frame: Float32Array) => void) => {
            forwardFrame = onFrame;
            return Promise.resolve();
        });

        await holder.last!.startRecording();
        await waitFor(() => expect(holder.last?.status).toBe("recording"));

        forwardFrame(new Float32Array(512));
        expect(FakeWorker.instances[0]!.sent.some(m => m.type === "audio-frame")).toBe(true);
    });

    it("reports missing for a never-downloaded model and downloads on demand", async () => {
        renderProvider(whisper.model_id);

        const context = await waitForModelState("missing");

        const download = context.downloadModel();
        await waitFor(() => expect(holder.last?.modelState).toBe("downloading"));

        const worker = FakeWorker.instances[0]!;
        expect(worker.latestLoad?.modelId).toBe(whisper.model_id);

        // The cached files must exist before `ready` so the persisted marker
        // reflects a genuinely complete download.
        await seedWhisperCache();
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });
        await download;
        const ready = await waitForModelState("ready");
        expect(ready.enabled).toBe(true);
        // The verification marker was written on `ready`.
        await waitFor(async () => expect(await isModelDownloaded(whisper)).toBe(true));
    });

    it("keeps the same worker and finishes the load when the interface language switches mid-load", async () => {
        renderProvider(whisper.model_id);
        const context = await waitForModelState("missing");

        const download = context.downloadModel();
        await waitFor(() => expect(holder.last?.modelState).toBe("downloading"));

        // Switch the interface language and the translation function while the
        // model loads — neither must tear down or replace the worker.
        i18nMock.language = "EN";
        i18nMock.t = (key: string) => `switched:${key}`;

        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "progress", progress: 50 });
        await waitFor(() => expect(holder.last?.modelProgress).toBe(50));

        await seedWhisperCache();
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });
        await download;
        await waitForModelState("ready");

        expect(FakeWorker.instances).toHaveLength(1);
        i18nMock.language = "DE";
        i18nMock.t = stableT;
    });

    it("times out a stalled load: settles the download, reports the error and replaces the worker", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        renderProvider(whisper.model_id);
        const context = await waitForModelState("missing");

        const download = context.downloadModel();
        await waitFor(() => expect(holder.last?.modelState).toBe("downloading"));
        // Attach the rejection expectation before the watchdog fires so the
        // rejection never counts as unhandled.
        const rejection = expect(download).rejects.toThrow("Model load timed out");

        // No progress message ever arrives — the watchdog must fire.
        await vi.advanceTimersByTimeAsync(LOAD_WATCHDOG_MS + 1);

        await rejection;
        await waitFor(() => expect(holder.last?.error).toBe("components.transcription.load_timeout"));
        await waitForModelState("missing");
        // The stuck worker was replaced so a retry starts on a fresh instance.
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    });

    it("falls back to unverified after a failed load so the popover can offer recovery", async () => {
        await markModelVerified(whisper);
        await seedWhisperCache();

        renderProvider(whisper.model_id);
        await waitForModelState("loading");

        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "error", requestId: worker.latestLoad!.requestId, message: "session failed" });

        const context = await waitForModelState("unverified");
        expect(context.error).toBe("session failed");
        // the verification marker was invalidated; a re-download is proposed again
        expect(await isModelDownloaded(whisper)).toBe(false);
    });
});
