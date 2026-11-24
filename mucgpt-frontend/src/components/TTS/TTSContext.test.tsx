// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TtsProvider, TtsContext, type ITts } from "./TTSContext";

const runtimeMock = vi.hoisted(() => {
    return {
        loadTts: vi.fn(),
        disposeTts: vi.fn().mockResolvedValue(undefined),
        getLoadedTts: vi.fn().mockReturnValue(null)
    };
});
vi.mock("../../utils/tts/phononRuntime", () => runtimeMock);

const playbackMock = vi.hoisted(() => ({ playSpeechStream: vi.fn() }));
vi.mock("../../utils/tts/playback", () => playbackMock);

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key })
}));

/** Reads the context value inside the provider tree. */
function Consumer() {
    const value = useContext<ITts>(TtsContext);
    return (
        <div>
            <button type="button" onClick={() => value.speak("a", "hello")}>
                speak
            </button>
            <button type="button" onClick={() => value.stop()}>
                stop
            </button>
            <span>{`${value.enabled}|${value.status}|${value.activeToken ?? "-"}`}</span>
        </div>
    );
}

function renderProvider(props?: { ttsEnabled?: boolean; ttsModelId?: string | null }) {
    return render(
        <TtsProvider ttsEnabled={props?.ttsEnabled ?? true} ttsModelId={props?.ttsModelId ?? "gradium/phonon-31m-en"}>
            <Consumer />
        </TtsProvider>
    );
}

/** Playback mock that hangs until its abort signal fires (observable "speaking" state). */
function mockHangingPlayback(): void {
    playbackMock.playSpeechStream.mockImplementation(
        (_stream: unknown, options: { signal: AbortSignal }) =>
            new Promise<void>((_, reject) => {
                options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
            })
    );
}

afterEach(() => {
    runtimeMock.loadTts.mockReset();
    playbackMock.playSpeechStream.mockReset();
});

describe("TtsProvider", () => {
    it("is disabled when the flag is off (speak is a no-op)", async () => {
        const user = userEvent.setup();
        renderProvider({ ttsEnabled: false });
        expect(screen.getByText("false|idle|-")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "speak" }));
        expect(screen.getByText("false|idle|-")).toBeInTheDocument();
        expect(runtimeMock.loadTts).not.toHaveBeenCalled();
    });

    it("disables the feature for an unknown model id with a warning", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        renderProvider({ ttsModelId: "gradium/phonon-40m-de" });
        expect(screen.getByText("false|idle|-")).toBeInTheDocument();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("phonon-40m-de"));
        warn.mockRestore();
    });

    it("moves idle → loading → speaking and reports the active token", async () => {
        const user = userEvent.setup();
        mockHangingPlayback();
        runtimeMock.loadTts.mockResolvedValue({ stream: vi.fn(), sampleRate: 24000 });

        renderProvider();
        expect(screen.getByText("true|idle|-")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "speak" }));
        await waitFor(() => expect(screen.getByText("true|speaking|a")).toBeInTheDocument());
        expect(runtimeMock.loadTts).toHaveBeenCalledWith(expect.objectContaining({ model_id: "gradium/phonon-31m-en" }), expect.any(Function));
        expect(playbackMock.playSpeechStream).toHaveBeenCalledTimes(1);
    });

    it("stop() aborts playback and returns to idle", async () => {
        const user = userEvent.setup();
        mockHangingPlayback();
        runtimeMock.loadTts.mockResolvedValue({ stream: vi.fn(), sampleRate: 24000 });

        renderProvider();
        await user.click(screen.getByRole("button", { name: "speak" }));
        await waitFor(() => expect(screen.getByText("true|speaking|a")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: "stop" }));
        await waitFor(() => expect(screen.getByText("true|idle|-")).toBeInTheDocument());
    });

    it("sets an error state when playback fails", async () => {
        const user = userEvent.setup();
        playbackMock.playSpeechStream.mockRejectedValue(new Error("boom"));
        runtimeMock.loadTts.mockResolvedValue({ stream: vi.fn(), sampleRate: 24000 });

        renderProvider();
        await user.click(screen.getByRole("button", { name: "speak" }));
        await waitFor(() => expect(screen.getByText("true|error|-")).toBeInTheDocument());
    });
});
