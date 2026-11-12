// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act, createElement, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionInput } from "./QuestionInput";
import { TranscriptionContext, type ITranscription, type TranscriptionModelState, type TranscriptionStatus } from "../Transcription/TranscriptionContext";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            // Mirror i18next's default interpolation for limit/count params.
            if (params && typeof key === "string") {
                let result = key;
                for (const [name, value] of Object.entries(params)) {
                    result = result.replace(new RegExp(`{{${name}}}`, "g"), String(value));
                }
                return result;
            }
            return key;
        },
        i18n: { resolvedLanguage: "de" }
    })
}));

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

// ---------------------------------------------------------------------------
// Image attachments (#1398)
// ---------------------------------------------------------------------------

import { ConfigContext } from "../../context/ConfigContext";
import { DEFAULT_APP_CONFIG } from "../../constants";
import type { ApplicationConfig, ImageAttachment, Model } from "../../api/models";
import type { UploadedData } from "../ContextManagerDialog/ContextManagerDialog";
import { within } from "@testing-library/dom";

vi.mock("../../api/core-client", async () => {
    const original = await vi.importActual<typeof import("../../api/core-client")>("../../api/core-client");
    return {
        ...original,
        uploadImageApi: vi.fn(),
        imageContentUrl: (id: string) => `/api/backend/v1/images/${id}/content`
    };
});

import { uploadImageApi } from "../../api/core-client";
import { uploadDocumentApi } from "../../api/documents-client";

vi.mock("../../api/documents-client", () => ({
    uploadDocumentApi: vi.fn().mockResolvedValue({
        id: "doc-1",
        filename: "doc.pdf",
        mime_type: "application/pdf",
        original_size: 10,
        text_length: 5,
        preview: "hello",
        preview_kind: "initial_excerpt",
        path: "/documents/doc-1.txt",
        created_at: "2026-01-01T00:00:00Z",
        status: "ready"
    })
}));

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const GIF_BYTES = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

const imageConfig: ApplicationConfig = {
    ...DEFAULT_APP_CONFIG,
    image_input: {
        enabled: true,
        max_upload_bytes: 10 * 1024 * 1024,
        max_images_per_message: 5,
        max_pixels: 20_000_000,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"]
    }
};

const visionModels: Model[] = [
    { id: "vision-model", supports_vision: true },
    { id: "text-model", supports_vision: false }
];

function imageHarness(options: {
    selectedLLM?: string;
    config?: ApplicationConfig;
    onSend?: (question: string, data: UploadedData[], images?: ImageAttachment[]) => void;
}) {
    const defaults = {
        selectedLLM: "vision-model",
        config: imageConfig,
        onSend: (() => {}) as (question: string, data: UploadedData[], images?: ImageAttachment[]) => void,
        ...options
    };

    const Harness = (props: { selectedLLM: string }) => {
        const [question, setQuestion] = useState("");
        return (
            <ConfigContext.Provider value={defaults.config}>
                <QuestionInput
                    onSend={defaults.onSend}
                    disabled={false}
                    question={question}
                    setQuestion={setQuestion}
                    selectedTools={[]}
                    hideDisclaimer
                    llmOptions={visionModels}
                    selectedLLM={props.selectedLLM}
                    onLLMSelectionChange={() => {}}
                />
            </ConfigContext.Provider>
        );
    };
    // Call sites use render(imageHarness(...)()); the wrapper only creates an
    // element (hooks live in Harness), and per-call overrides let rerenders
    // change props on the same mounted component instead of remounting it.
    return (overrides?: { selectedLLM?: string }) => createElement(Harness, { selectedLLM: overrides?.selectedLLM ?? defaults.selectedLLM });
}

const imageButton = () => screen.getByRole("button", { name: "components.questioninput.add_image" });

function pasteEvent(text: string | undefined, files: File[]): React.ClipboardEvent & ClipboardEvent {
    const clipboardData = {
        files,
        items: files.map(file => ({ kind: "file", type: file.type })),
        getData: (type: string) => (type === "text/plain" ? text : ""),
        types: [...(text !== undefined ? ["text/plain"] : []), "Files"]
    };
    const event = new Event("paste", { bubbles: true, cancelable: true }) as unknown as React.ClipboardEvent & ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    return event;
}

const pngFile = () => new File([PNG_BYTES], "shot.png", { type: "image/png" });

describe("QuestionInput images", () => {
    beforeEach(() => {
        vi.mocked(uploadImageApi).mockReset();
    });

    it("shows the image button only when the selected model is vision-enabled and image input is on", () => {
        render(imageHarness({})());
        expect(imageButton()).toBeInTheDocument();
    });

    it("hides the image button for non-vision models", () => {
        render(imageHarness({ selectedLLM: "text-model" })());
        expect(screen.queryByRole("button", { name: "components.questioninput.add_image" })).not.toBeInTheDocument();
    });

    it("hides the image button when image input is disabled", () => {
        render(imageHarness({ config: { ...imageConfig, image_input: { ...imageConfig.image_input!, enabled: false } } })());
        expect(screen.queryByRole("button", { name: "components.questioninput.add_image" })).not.toBeInTheDocument();
    });

    it("uploads picked images and renders ready thumbnails", async () => {
        vi.mocked(uploadImageApi).mockResolvedValue({
            id: "img-1",
            filename: "shot.png",
            mime_type: "image/png",
            size_bytes: 10,
            width: 1,
            height: 1,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-02T00:00:00Z",
            managed_url: "mucgpt-image://img-1"
        });
        const onSend = vi.fn();
        render(imageHarness({ onSend })());

        const input = document.querySelector('input[type="file"][hidden]') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { files: [pngFile()] } });
        });

        expect(uploadImageApi).toHaveBeenCalledWith(expect.anything(), "vision-model");
        await waitFor(() => {
            expect(screen.getByRole("img", { name: "shot.png" })).toBeInTheDocument();
        });
    });

    it("blocks send while an image upload is in flight and sends ready attachments", async () => {
        let resolveUpload!: (value: Awaited<ReturnType<typeof uploadImageApi>>) => void;
        vi.mocked(uploadImageApi).mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveUpload = resolve;
                })
        );
        const onSend = vi.fn();
        render(imageHarness({ onSend })());

        const input = document.querySelector('input[type="file"][hidden]') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { files: [pngFile()] } });
        });

        const textarea = screen.getByRole("textbox");
        await act(async () => {
            fireEvent.change(textarea, { target: { value: "What is this?" } });
        });
        const sendButton = screen.getByRole("button", { name: "components.questioninput.send_question" });
        expect(sendButton).toBeDisabled();

        await act(async () => {
            resolveUpload({
                id: "img-1",
                filename: "shot.png",
                mime_type: "image/png",
                size_bytes: 10,
                width: 1,
                height: 1,
                created_at: "2026-01-01T00:00:00Z",
                expires_at: "2026-01-02T00:00:00Z",
                managed_url: "mucgpt-image://img-1"
            });
        });
        await waitFor(() => {
            expect(sendButton).toBeEnabled();
        });

        await act(async () => {
            fireEvent.click(sendButton);
        });
        expect(onSend).toHaveBeenCalledWith(
            "What is this?",
            [],
            [
                {
                    id: "img-1",
                    displayUrl: "/api/backend/v1/images/img-1/content",
                    filename: "shot.png",
                    mime_type: "image/png",
                    size_bytes: 10,
                    width: 1,
                    height: 1
                }
            ]
        );
    });

    it("blocks send when a non-vision model is selected while images are staged", async () => {
        // Drafts are staged on a vision model, then the user switches models.
        // One factory instance keeps the component type stable across rerenders.
        const harness = imageHarness({});
        const { rerender } = render(harness());
        vi.mocked(uploadImageApi).mockResolvedValue({
            id: "img-1",
            filename: "shot.png",
            mime_type: "image/png",
            size_bytes: 10,
            width: 1,
            height: 1,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-02T00:00:00Z",
            managed_url: "mucgpt-image://img-1"
        });
        const input = document.querySelector('input[type="file"][hidden]') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { files: [pngFile()] } });
        });
        await waitFor(() => {
            expect(screen.getByRole("img", { name: "shot.png" })).toBeInTheDocument();
        });

        rerender(harness({ selectedLLM: "text-model" }));

        expect(await screen.findByText("components.questioninput.images_need_vision_model")).toBeInTheDocument();
        const textarea = screen.getByRole("textbox");
        await act(async () => {
            fireEvent.change(textarea, { target: { value: "What is this?" } });
        });
        expect(screen.getByRole("button", { name: "components.questioninput.send_question" })).toBeDisabled();
    });

    it("pastes an image on a vision model and uploads it with a generated name", async () => {
        vi.mocked(uploadImageApi).mockResolvedValue({
            id: "img-1",
            filename: "pasted-image.png",
            mime_type: "image/png",
            size_bytes: 10,
            width: 1,
            height: 1,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-02T00:00:00Z",
            managed_url: "mucgpt-image://img-1"
        });
        render(imageHarness({})());

        const textarea = screen.getByRole("textbox");
        await act(async () => {
            fireEvent.paste(textarea, { clipboardData: { files: [pngFile()], getData: () => "", types: ["Files"] } } as never);
        });

        await waitFor(() => {
            expect(uploadImageApi).toHaveBeenCalled();
        });
        const uploadCall = vi.mocked(uploadImageApi).mock.calls[0];
        expect(uploadCall[1]).toBe("vision-model");
        await waitFor(() => {
            expect(screen.getByRole("list", { name: "components.questioninput.attached_images" })).toBeInTheDocument();
        });
    });

    it("pastes mixed text and image: text is kept and image is uploaded", async () => {
        vi.mocked(uploadImageApi).mockResolvedValue({
            id: "img-1",
            filename: "pasted-image.png",
            mime_type: "image/png",
            size_bytes: 10,
            width: 1,
            height: 1,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-02T00:00:00Z",
            managed_url: "mucgpt-image://img-1"
        });
        render(imageHarness({})());
        const textarea = screen.getByRole("textbox");

        await act(async () => {
            fireEvent.paste(textarea, {
                clipboardData: {
                    files: [pngFile()],
                    getData: (type: string) => (type === "text/plain" ? "please analyze" : ""),
                    types: ["text/plain", "Files"]
                }
            } as never);
        });

        expect(screen.getByRole("textbox")).toHaveValue("please analyze");
        await waitFor(() => {
            expect(uploadImageApi).toHaveBeenCalled();
        });
    });

    it("shows a hint for image-only pastes on non-vision models without uploading", async () => {
        render(imageHarness({ selectedLLM: "text-model" })());
        const textarea = screen.getByRole("textbox");

        await act(async () => {
            fireEvent.paste(textarea, {
                clipboardData: { files: [pngFile()], getData: () => "", types: ["Files"] }
            } as never);
        });

        expect(await screen.findByText("components.questioninput.image_disabled_hint")).toBeInTheDocument();
        expect(uploadImageApi).not.toHaveBeenCalled();
    });

    it("rejects unsupported image pastes with an explicit format hint", async () => {
        render(imageHarness({})());
        const textarea = screen.getByRole("textbox");

        await act(async () => {
            fireEvent.paste(textarea, {
                clipboardData: { files: [new File([GIF_BYTES], "anim.gif", { type: "image/gif" })], getData: () => "", types: ["Files"] }
            } as never);
        });

        expect(await screen.findByText("components.questioninput.image_unsupported_format")).toBeInTheDocument();
        expect(uploadImageApi).not.toHaveBeenCalled();
    });

    it("routes dropped documents to the document pipeline and images to the image pipeline", async () => {
        vi.mocked(uploadImageApi).mockResolvedValue({
            id: "img-1",
            filename: "shot.png",
            mime_type: "image/png",
            size_bytes: 10,
            width: 1,
            height: 1,
            created_at: "2026-01-01T00:00:00Z",
            expires_at: "2026-01-02T00:00:00Z",
            managed_url: "mucgpt-image://img-1"
        });
        render(imageHarness({})());
        const composer = screen.getByRole("textbox").closest("div")!;

        await act(async () => {
            fireEvent.drop(composer, { dataTransfer: { files: [pngFile(), new File([PDF_BYTES], "doc.pdf", { type: "application/pdf" })], types: ["Files"] } });
        });

        await waitFor(() => {
            expect(uploadImageApi).toHaveBeenCalled();
            expect(uploadDocumentApi).toHaveBeenCalled();
        });
        expect(vi.mocked(uploadDocumentApi).mock.calls[0][0].name).toBe("doc.pdf");
    });
});
