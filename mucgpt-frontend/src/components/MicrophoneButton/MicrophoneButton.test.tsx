// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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
}

const setup = ({ modelState, overrides = {}, disabled = false }: SetupOptions) => {
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
        retryModelLoad: () => {},
        redownloadModel: vi.fn().mockResolvedValue(undefined),
        cancelDownload: vi.fn(),
        deleteModel: vi.fn().mockResolvedValue(undefined),
        startRecording: vi.fn().mockResolvedValue(undefined),
        stopAndTranscribe: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };
    render(
        <TranscriptionContext.Provider value={context}>
            <MicrophoneButton onTranscription={onTranscriptionSpy} disabled={disabled} />
        </TranscriptionContext.Provider>
    );
    return context as ITranscription & {
        downloadModel: ReturnType<typeof vi.fn>;
        startRecording: ReturnType<typeof vi.fn>;
        redownloadModel: ReturnType<typeof vi.fn>;
        retryModelLoad: ReturnType<typeof vi.fn>;
    };
};

describe("MicrophoneButton", () => {
    it("opens the model panel with a download action when the model is missing", async () => {
        const context = setup({ modelState: "missing" });

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
        const context = setup({ modelState: "unverified", overrides: { error: "boom" } });

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(screen.getByText("components.transcription.retry")).toBeInTheDocument();

        fireEvent.click(screen.getByText("components.transcription.retry"));
        expect(context.downloadModel).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText("components.transcription.redownload"));
        expect(context.redownloadModel).toHaveBeenCalledTimes(1);
    });

    it("shows a warning without download actions when the browser cannot run the model", () => {
        setup({ modelState: "unsupported" });

        fireEvent.click(screen.getAllByRole("button")[0]);
        expect(screen.getByText("components.transcription.webgpu_warning")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "components.transcription.download" })).not.toBeInTheDocument();
    });

    it("records in the ready state without a panel", () => {
        const context = setup({ modelState: "ready" });

        const mic = screen.getAllByRole("button")[0];
        expect(mic).toHaveAccessibleName("components.microphonebutton.record");
        fireEvent.click(mic);
        expect(context.startRecording).toHaveBeenCalledTimes(1);
    });

    it("respects the input's disabled state in every state", () => {
        setup({ modelState: "ready", disabled: true });
        expect(screen.getAllByRole("button")[0]).toBeDisabled();
    });
});
