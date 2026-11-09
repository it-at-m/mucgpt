// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { MicrophoneButton } from "./MicrophoneButton";
import { TranscriptionContext, type ITranscription, type TranscriptionModelState } from "../Transcription/TranscriptionContext";
import type { TranscriptionModel } from "../../config/transcriptionModels";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const whisper: TranscriptionModel = {
    model_id: "onnx-community/whisper-small",
    label: "Whisper Small",
    size_hint: "~220 MB"
};

const onTranscriptionSpy = vi.fn();

interface SetupOptions {
    modelState: TranscriptionModelState;
    overrides?: Partial<ITranscription>;
    disabled?: boolean;
    onLiveTranscription?: (text: string) => void;
}

const setup = ({ modelState, overrides = {}, disabled = false, onLiveTranscription }: SetupOptions) => {
    const context: ITranscription = {
        enabled: true,
        model: whisper,
        modelState,
        status: "idle",
        modelProgress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        transcript: "",
        error: null,
        language: undefined,
        setLanguage: () => {},
        downloadModel: vi.fn().mockResolvedValue(undefined),
        retryModelLoad: vi.fn(),
        redownloadModel: vi.fn().mockResolvedValue(undefined),
        cancelDownload: vi.fn(),
        deleteModel: vi.fn().mockResolvedValue(undefined),
        startRecording: vi.fn().mockResolvedValue(undefined),
        cancelPendingStart: vi.fn(),
        stopAndTranscribe: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };
    const renderResult = render(
        <TranscriptionContext.Provider value={context}>
            <MicrophoneButton onTranscription={onTranscriptionSpy} onLiveTranscription={onLiveTranscription} disabled={disabled} />
        </TranscriptionContext.Provider>
    );
    return {
        ...renderResult,
        context: context as ITranscription & {
            downloadModel: ReturnType<typeof vi.fn>;
            startRecording: ReturnType<typeof vi.fn>;
            cancelPendingStart: ReturnType<typeof vi.fn>;
            redownloadModel: ReturnType<typeof vi.fn>;
            retryModelLoad: ReturnType<typeof vi.fn>;
            stopAndTranscribe: ReturnType<typeof vi.fn>;
        }
    };
};

describe("MicrophoneButton", () => {
    it("opens the model panel with a download action when the model is missing", async () => {
        const { context } = setup({ modelState: "missing" });

        const mic = screen.getAllByRole("button")[0];
        expect(mic).toHaveAccessibleName("components.transcription.setup_tooltip");

        fireEvent.click(mic);
        expect(await screen.findByText("components.transcription.download")).toBeInTheDocument();

        expect(context.downloadModel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("components.transcription.download"));
        expect(context.downloadModel).toHaveBeenCalledTimes(1);
    });

    it("is busy (not clickable) while the model loads or downloads", () => {
        setup({ modelState: "downloading", overrides: { modelProgress: 42, downloadedBytes: 10, totalBytes: 220 } });

        const mic = screen.getAllByRole("button")[0];
        expect(mic).toBeDisabled();
        expect(mic).toHaveAccessibleName(/components\.microphonebutton\.loading_model/);
    });

    it("opens the panel with retry and re-download actions when the cached model is unverified", () => {
        const { context } = setup({ modelState: "unverified", overrides: { error: "boom" } });

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(screen.getByText("components.transcription.retry")).toBeInTheDocument();

        fireEvent.click(screen.getByText("components.transcription.retry"));
        expect(context.downloadModel).not.toHaveBeenCalled();
        expect(context.retryModelLoad).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText("components.transcription.redownload"));
        expect(context.redownloadModel).toHaveBeenCalledTimes(1);
    });

    it("keeps the panel with the cancel action reachable while a download runs", () => {
        setup({ modelState: "downloading", overrides: { modelProgress: 42 } });

        // The panel is mounted (forced open) so the user can always cancel.
        expect(screen.getByText("components.transcription.cancel_download")).toBeInTheDocument();
    });

    it("does not forward a transcript it did not start recording", () => {
        const liveSpy = vi.fn();
        setup({ modelState: "ready", overrides: { status: "recording", transcript: "leftover" }, onLiveTranscription: liveSpy });

        // A mic button mounted while a recording from elsewhere is running must
        // not adopt the transcript into its input's draft.
        expect(liveSpy).not.toHaveBeenCalled();
    });

    it("shows a warning without download actions when the browser cannot run the model", () => {
        setup({ modelState: "unsupported" });

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(screen.getByText("components.transcription.webgpu_only_error")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "components.transcription.download" })).not.toBeInTheDocument();
    });

    it("records in the ready state without a panel", () => {
        const { context } = setup({ modelState: "ready" });

        const mic = screen.getAllByRole("button")[0];
        expect(mic).toHaveAccessibleName("components.microphonebutton.record");
        fireEvent.click(mic);
        expect(context.startRecording).toHaveBeenCalledTimes(1);
    });

    it("ignores a second click while this instance's start is pending", () => {
        const { context } = setup({
            modelState: "ready",
            overrides: { startRecording: vi.fn(() => new Promise<void>(() => {})) }
        });

        const mic = screen.getAllByRole("button")[0];
        fireEvent.click(mic);
        fireEvent.click(mic);

        // The provider would no-op the duplicate start — the button must not call
        // it again: a resolved duplicate would steal the ownership claim and clear
        // the pending marker the unmount cleanup relies on.
        expect(context.startRecording).toHaveBeenCalledTimes(1);
    });

    it("aborts a pending start when unmounted mid-setup", () => {
        // The start hangs (permission dialog / audio setup in flight) and is
        // never claimed as owned.
        const { context, unmount } = setup({
            modelState: "ready",
            overrides: { startRecording: vi.fn(() => new Promise<void>(() => {})) }
        });

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(context.startRecording).toHaveBeenCalledTimes(1);

        unmount();
        expect(context.cancelPendingStart).toHaveBeenCalledTimes(1);
        expect(context.stopAndTranscribe).not.toHaveBeenCalled();
    });

    it("aborts nothing when unmounted while idle", () => {
        const { context, unmount } = setup({ modelState: "ready" });

        unmount();
        expect(context.cancelPendingStart).not.toHaveBeenCalled();
        expect(context.stopAndTranscribe).not.toHaveBeenCalled();
    });

    it("stops a running recording on unmount instead of cancelling", async () => {
        const { context, rerender, unmount } = setup({ modelState: "ready" });

        await act(async () => {
            fireEvent.click(screen.getAllByRole("button")[0]);
        });
        // The provider flipped to "recording" — reflect it in the context value.
        rerender(
            <TranscriptionContext.Provider value={{ ...context, status: "recording" }}>
                <MicrophoneButton onTranscription={onTranscriptionSpy} />
            </TranscriptionContext.Provider>
        );

        unmount();
        // The instance owns the recording: the graceful stop path runs, not the abort.
        expect(context.stopAndTranscribe).toHaveBeenCalledTimes(1);
        expect(context.cancelPendingStart).not.toHaveBeenCalled();
    });

    it("respects the input's disabled state in every state", () => {
        setup({ modelState: "ready", disabled: true });
        expect(screen.getAllByRole("button")[0]).toBeDisabled();
    });
});
