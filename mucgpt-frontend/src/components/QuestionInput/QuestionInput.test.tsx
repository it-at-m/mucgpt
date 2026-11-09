// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { QuestionInput } from "./QuestionInput";
import { TranscriptionContext, type ITranscription, type TranscriptionModelState, type TranscriptionStatus } from "../Transcription/TranscriptionContext";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const baseTranscription: ITranscription = {
    enabled: true,
    model: null,
    modelState: "ready" as TranscriptionModelState,
    status: "idle",
    modelProgress: 100,
    downloadedBytes: 0,
    totalBytes: 0,
    transcript: "",
    error: null,
    language: undefined,
    setLanguage: () => {},
    downloadModel: vi.fn(),
    retryModelLoad: () => {},
    redownloadModel: vi.fn(),
    cancelDownload: () => {},
    deleteModel: vi.fn(),
    startRecording: vi.fn().mockResolvedValue(undefined),
    cancelPendingStart: () => {},
    stopAndTranscribe: vi.fn().mockResolvedValue(undefined)
};

interface HarnessProps {
    /** Partial context overriding {@link baseTranscription}. */
    transcription?: Partial<ITranscription>;
    /** Passthrough prop for the opt-out. */
    transcriptionDisabled?: boolean;
}

/** Stateful harness: question lives in real state so transcript merges can be asserted on the textarea. */
const Harness = ({ transcription = {}, transcriptionDisabled = false }: HarnessProps) => {
    const [question, setQuestion] = useState("");
    return (
        <TranscriptionContext.Provider value={{ ...baseTranscription, ...transcription }}>
            <QuestionInput
                onSend={() => {}}
                disabled={false}
                question={question}
                setQuestion={setQuestion}
                selectedTools={[]}
                transcriptionDisabled={transcriptionDisabled}
                hideDisclaimer
            />
        </TranscriptionContext.Provider>
    );
};

const micButton = () => screen.getByRole("button", { name: "components.microphonebutton.record" });

describe("QuestionInput transcription", () => {
    it("renders the microphone without any onTranscription prop when transcription is enabled", () => {
        render(<Harness />);

        expect(micButton()).toBeInTheDocument();
    });

    it("hides the microphone when transcriptionDisabled is set", () => {
        render(<Harness transcriptionDisabled />);

        expect(screen.queryByRole("button", { name: "components.microphonebutton.record" })).not.toBeInTheDocument();
    });

    it("merges live and final transcripts into the question without requiring onTranscription", async () => {
        const view = render(<Harness />);
        await act(async () => {
            fireEvent.click(micButton());
        });

        // Live transcript while recording is forwarded from the owned instance.
        await act(async () => {
            view.rerender(<Harness transcription={{ status: "recording" as TranscriptionStatus, transcript: "Hallo" }} />);
        });
        expect(screen.getByRole("textbox")).toHaveValue("Hallo");

        // Completion (status back to idle) forwards the final transcript once.
        await act(async () => {
            view.rerender(<Harness transcription={{ status: "idle" as TranscriptionStatus, transcript: "Hallo Welt" }} />);
        });
        await waitFor(() => {
            expect(screen.getByRole("textbox")).toHaveValue("Hallo Welt");
        });
    });
});
