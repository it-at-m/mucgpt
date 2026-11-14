// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDocumentApi, listDocumentsApi, uploadDocumentApi } from "../../api/documents-client";
import { ApiError } from "../../api/fetch-utils";
import type { DocumentLibraryEntry, DocumentMetadata } from "../../api/models";
import { DEFAULT_APP_CONFIG } from "../../constants";
import { ConfigContext } from "../../context/ConfigContext";
import type { ChatDocument } from "../ChatDocuments/documentSelection";
import { QuestionInput } from "./QuestionInput";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
// Fluent's live region writes via innerText, which jsdom does not render, so the announcement itself is observed.
const announce = vi.hoisted(() => vi.fn());
vi.mock("@fluentui/react-components", async importOriginal => ({
    ...(await importOriginal<typeof import("@fluentui/react-components")>()),
    useAnnounce: () => ({ announce })
}));
vi.mock("../../api/documents-client", () => ({ listDocumentsApi: vi.fn(), deleteDocumentApi: vi.fn(), uploadDocumentApi: vi.fn() }));

const libraryEntry = (overrides: Partial<DocumentLibraryEntry> = {}): DocumentLibraryEntry => ({
    id: "library-1",
    filename: "Policy.txt",
    mime_type: "text/plain",
    original_size: 5,
    text_length: 5,
    preview: "text",
    preview_kind: "initial_excerpt",
    path: "/documents/library-1.txt",
    created_at: "2026-11-02",
    status: "ready",
    ...overrides
});

const attached = ({ status = "ready", usedInChat = false }: { status?: "ready" | "unavailable"; usedInChat?: boolean } = {}): ChatDocument => ({
    id: "library-1",
    name: "Policy.txt",
    size: 5,
    status,
    usedInChat
});

const onSend = vi.fn();

const Harness = ({ initialData = [] }: { initialData?: ChatDocument[] }) => {
    const [question, setQuestion] = useState("Frage");
    const [data, setData] = useState(initialData);
    return (
        <ConfigContext.Provider value={{ ...DEFAULT_APP_CONFIG, document_processing_enabled: true }}>
            <QuestionInput
                onSend={onSend}
                disabled={false}
                question={question}
                setQuestion={setQuestion}
                selectedTools={[]}
                documents={data}
                setDocuments={setData}
                transcriptionDisabled
                hideDisclaimer
            />
        </ConfigContext.Provider>
    );
};

const sendButton = () => screen.getByRole("button", { name: "components.questioninput.send_question" });
const dropFiles = (files: File[]) => fireEvent.drop(screen.getByRole("textbox"), { dataTransfer: { files, types: ["Files"] } });

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
});

describe("QuestionInput documents", () => {
    it("shows attached documents by name and marks them as used once sent", () => {
        render(<Harness initialData={[attached()]} />);

        expect(screen.getByText("Policy.txt")).toBeInTheDocument();
        fireEvent.click(sendButton());
        expect(onSend).toHaveBeenCalledWith("Frage");
        expect(screen.getByRole("button", { name: "document_library.chip_stop_using" })).toBeInTheDocument();
    });

    it("blocks sending while an unavailable document is attached and detaches it without deleting it", () => {
        render(<Harness initialData={[attached({ status: "unavailable" })]} />);

        expect(screen.getByText("document_library.send_blocked_unavailable")).toBeInTheDocument();
        expect(sendButton()).toBeDisabled();
        fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
        expect(onSend).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "document_library.remove" }));
        expect(screen.queryByText("Policy.txt")).not.toBeInTheDocument();
        expect(sendButton()).toBeEnabled();
        expect(deleteDocumentApi).not.toHaveBeenCalled();
    });

    it("keeps keyboard focus in the composer when documents are removed and announces the removal", async () => {
        const second: ChatDocument = { id: "library-2", name: "Plan.txt", size: 5, status: "ready", usedInChat: false };
        render(<Harness initialData={[attached(), second]} />);

        const [firstRemove, secondRemove] = screen.getAllByRole("button", { name: "document_library.remove" });
        firstRemove.focus();
        fireEvent.click(firstRemove);
        expect(secondRemove).toHaveFocus();
        expect(announce).toHaveBeenCalledWith("document_library.announce_removed", { polite: true });

        fireEvent.click(secondRemove);
        expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("moves focus on when a retried upload hides the chip's buttons", async () => {
        vi.mocked(uploadDocumentApi).mockRejectedValueOnce(new ApiError("unsupported", 415));
        render(<Harness />);

        dropFiles([new File(["x"], "Video.mp4", { type: "video/mp4" })]);
        const retry = await screen.findByRole("button", { name: "document_library.retry_upload" });
        expect(announce).toHaveBeenCalledWith("document_library.upload_failed_named", { alert: true });

        vi.mocked(uploadDocumentApi).mockReturnValue(new Promise(() => {}));
        retry.focus();
        fireEvent.click(retry);
        expect(await screen.findByText("document_library.chip_processing")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toHaveFocus();
    });

    it("explains that removing a used document only stops future reads", () => {
        render(<Harness initialData={[attached({ usedInChat: true })]} />);

        expect(screen.getByRole("button", { name: "document_library.chip_stop_using" })).toBeInTheDocument();
    });

    it("blocks sending while an upload is processed and attaches the document afterwards", async () => {
        let finishUpload: (document: DocumentMetadata) => void = () => {};
        vi.mocked(uploadDocumentApi).mockReturnValue(new Promise(resolve => (finishUpload = resolve)));
        render(<Harness />);

        dropFiles([new File(["hello"], "Bericht.txt", { type: "text/plain" })]);

        expect(await screen.findByText("document_library.chip_processing")).toBeInTheDocument();
        expect(sendButton()).toBeDisabled();
        await waitFor(() => expect(uploadDocumentApi).toHaveBeenCalledTimes(1));

        finishUpload({ ...libraryEntry({ id: "new", filename: "Bericht.txt" }), text_length: 5, preview: "hello", preview_kind: "initial_excerpt" });
        await waitFor(() => expect(sendButton()).toBeEnabled());
        expect(screen.getByText("Bericht.txt")).toBeInTheDocument();
        expect(announce).toHaveBeenCalledWith("document_library.announce_ready", { polite: true });
    });

    it("keeps every result when several uploads finish at different times", async () => {
        const finish: Record<string, () => void> = {};
        vi.mocked(uploadDocumentApi).mockImplementation(
            file =>
                new Promise((resolve, reject) => {
                    finish[file.name] = () =>
                        file.name === "B.mp4"
                            ? reject(new ApiError("unsupported", 415))
                            : resolve({
                                  ...libraryEntry({ id: file.name, filename: file.name }),
                                  text_length: 1,
                                  preview: "x",
                                  preview_kind: "initial_excerpt"
                              });
                })
        );
        render(<Harness />);

        dropFiles(["A.txt", "B.mp4", "C.txt"].map(name => new File(["x"], name)));
        await waitFor(() => expect(uploadDocumentApi).toHaveBeenCalledTimes(3));

        finish["A.txt"]();
        finish["B.mp4"]();
        finish["C.txt"]();

        await waitFor(() => expect(screen.queryByText("document_library.chip_processing")).not.toBeInTheDocument());
        expect(screen.getByText("document_library.upload_error_unsupported")).toBeInTheDocument();
        expect(sendButton()).toBeEnabled();
    });

    it("shows a readable reason for a failed upload, keeps sending possible and retries on request", async () => {
        vi.mocked(uploadDocumentApi).mockRejectedValueOnce(new ApiError("Parser does not support the document format.", 415));
        render(<Harness />);

        dropFiles([new File(["x"], "Video.mp4", { type: "video/mp4" })]);

        expect(await screen.findByText("document_library.upload_error_unsupported")).toBeInTheDocument();
        expect(sendButton()).toBeEnabled();
        fireEvent.click(sendButton());
        expect(onSend).toHaveBeenCalledWith("Frage");

        vi.mocked(uploadDocumentApi).mockReturnValue(new Promise(() => {}));
        fireEvent.click(screen.getByRole("button", { name: "document_library.retry_upload" }));
        expect(await screen.findByText("document_library.chip_processing")).toBeInTheDocument();
        expect(uploadDocumentApi).toHaveBeenCalledTimes(2);
    });

    it("attaches the existing library document for a duplicate and uploads it only on request", async () => {
        vi.mocked(listDocumentsApi).mockResolvedValue([libraryEntry()]);
        vi.mocked(uploadDocumentApi).mockReturnValue(new Promise(() => {}));
        render(<Harness />);

        dropFiles([new File(["12345"], "Policy.txt", { type: "text/plain" })]);

        expect(await screen.findByText("document_library.duplicate_title")).toBeInTheDocument();
        expect(uploadDocumentApi).not.toHaveBeenCalled();
        expect(sendButton()).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "document_library.duplicate_upload_anyway" }));
        await waitFor(() => expect(uploadDocumentApi).toHaveBeenCalledTimes(1));
        expect(screen.queryByText("document_library.duplicate_title")).not.toBeInTheDocument();
    });
});
