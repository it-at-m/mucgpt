// @vitest-environment jsdom
import { useContext } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptionProvider, TranscriptionContext, type ITranscription, type TranscriptionModelState } from "./TranscriptionContext";
import type { WorkerInMessage, WorkerOutMessage } from "../../workers/transcription.worker";
import type { TranscriptionModel } from "../../config/transcriptionModels";
import { markModelVerified, isModelDownloaded } from "../../utils/transcriptionModelCache";

const stableT = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key;

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: stableT,
        i18n: { language: "DE" }
    })
}));

const stableRecorder = { recordingState: "idle", startRecording: vi.fn(), stopRecording: vi.fn() };
vi.mock("../../hooks/useAudioRecorder", () => ({
    useAudioRecorder: () => stableRecorder
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
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("TranscriptionProvider", () => {
    it("disables transcription with a warning for an unknown configured model id", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        renderProvider("does/not-exist");

        await waitFor(() => expect(holder.last?.enabled).toBe(false));
        await waitFor(() => expect(FakeWorker.instances).toHaveLength(0));
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does/not-exist"));
    });

    it("auto-loads a verified download on boot and recovers `ready` on load", async () => {
        await markModelVerified(whisper);
        const transformers = await store.open("transformers-cache");
        await transformers.put(`https://huggingface.co/${whisper.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("ok"));

        renderProvider(whisper.model_id);

        await waitForModelState("loading");
        expect(FakeWorker.instances).toHaveLength(1);

        const worker = FakeWorker.instances[0]!;
        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });

        const context = await waitForModelState("ready");
        expect(context.enabled).toBe(true);
    });

    it("reports missing for a never-downloaded model and downloads on demand", async () => {
        renderProvider(whisper.model_id);

        const context = await waitForModelState("missing");

        const download = context.downloadModel();
        await waitFor(() => expect(holder.last?.modelState).toBe("downloading"));

        const worker = FakeWorker.instances[0]!;
        expect(worker.latestLoad?.modelId).toBe(whisper.model_id);

        worker.reply({ type: "ready", requestId: worker.latestLoad!.requestId, modelId: whisper.model_id });
        await download;
        const ready = await waitForModelState("ready");
        expect(ready.enabled).toBe(true);
    });

    it("falls back to unverified after a failed load so the popover can offer recovery", async () => {
        await markModelVerified(whisper);
        const transformers = await store.open("transformers-cache");
        await transformers.put(`https://huggingface.co/${whisper.model_id}/resolve/main/onnx/encoder_model_q4.onnx`, new Response("stale"));

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
