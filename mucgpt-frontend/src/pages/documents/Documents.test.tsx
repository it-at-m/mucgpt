// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

import { deleteDocumentApi, listDocumentsApi, uploadDocumentApi } from "../../api/documents-client";
import type { DocumentLibraryEntry, DocumentMetadata } from "../../api/models";
import { DEFAULT_APP_CONFIG } from "../../constants";
import { ConfigContext } from "../../context/ConfigContext";
import Documents from "./Documents";

vi.mock("react-i18next", () => {
    const t = (key: string) => key;
    return { useTranslation: () => ({ t, i18n: { language: "DE", resolvedLanguage: "DE" } }) };
});
vi.mock("../../api/documents-client", () => ({ listDocumentsApi: vi.fn(), deleteDocumentApi: vi.fn(), uploadDocumentApi: vi.fn() }));

const entry = (overrides: Partial<DocumentLibraryEntry> = {}): DocumentLibraryEntry => ({
    id: "ready",
    filename: "Policy.txt",
    mime_type: "text/plain",
    original_size: 5,
    text_length: 5,
    preview: "text",
    preview_kind: "initial_excerpt",
    path: "/documents/ready.txt",
    created_at: "2026-11-02",
    status: "ready",
    ...overrides
});

const renderPage = () =>
    render(
        <ConfigContext.Provider value={{ ...DEFAULT_APP_CONFIG, document_processing_enabled: true }}>
            <MemoryRouter>
                <Documents />
            </MemoryRouter>
        </ConfigContext.Provider>
    );

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

it("allows deleting stale processing documents so a crash cannot block the quota", async () => {
    // The backend distinguishes stale from active workers via the document lock
    // (409 while busy), so the delete button must stay available for processing rows.
    vi.mocked(listDocumentsApi).mockResolvedValue([entry({ id: "stuck", status: "processing" })]);
    renderPage();

    expect(await screen.findByRole("button", { name: "document_library.delete" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "document_library.new_chat_aria" })).not.toBeInTheDocument();
});

it("deletes a document only after the confirmation", async () => {
    vi.mocked(listDocumentsApi).mockResolvedValue([entry()]);
    vi.mocked(deleteDocumentApi).mockResolvedValue();
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "document_library.delete" }));
    expect(screen.getByText("document_library.delete_confirm_message")).toBeInTheDocument();
    expect(deleteDocumentApi).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "document_library.delete_confirm_action" }));
    await waitFor(() => expect(deleteDocumentApi).toHaveBeenCalledWith("ready"));
});

it("offers the upload as the next step when the library is empty", async () => {
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("document_library.empty_title")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "document_library.upload" })).toHaveLength(1);
    expect(screen.queryByText("document_library.empty_browser_hint")).not.toBeInTheDocument();
});

it("points to browser documents when the library is still empty", async () => {
    localStorage.setItem(
        "MUCGPT_PARSED_DOCUMENTS_V1",
        JSON.stringify([
            {
                id: "old",
                name: "Alt.pdf",
                content: "text",
                size: 4,
                mimeType: "application/pdf",
                lastModified: 0,
                fileSignature: "old",
                parsedAt: "2026-09-14"
            }
        ])
    );
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("document_library.empty_browser_hint")).toBeInTheDocument();
});

it("keeps every finished upload when list reloads resolve out of order", async () => {
    const first = entry({ id: "a", filename: "A.txt" });
    const second = entry({ id: "b", filename: "B.txt" });
    let resolveStaleList: (documents: DocumentLibraryEntry[]) => void = () => {};
    vi.mocked(listDocumentsApi)
        .mockResolvedValueOnce([])
        .mockReturnValueOnce(new Promise(resolve => (resolveStaleList = resolve)))
        .mockResolvedValueOnce([first, second]);
    const uploaded = (document: DocumentLibraryEntry): DocumentMetadata => ({
        ...document,
        text_length: document.text_length ?? 0,
        preview: document.preview ?? "",
        preview_kind: document.preview_kind ?? "initial_excerpt"
    });
    let finishFirstUpload: () => void = () => {};
    vi.mocked(uploadDocumentApi)
        .mockReturnValueOnce(new Promise(resolve => (finishFirstUpload = () => resolve(uploaded(first)))))
        .mockResolvedValueOnce(uploaded(second));
    renderPage();
    await screen.findByText("document_library.empty_title");

    fireEvent.change(screen.getByLabelText("document_library.upload", { selector: "input" }), {
        target: { files: [new File(["a"], "A.txt"), new File(["b"], "B.txt")] }
    });
    await waitFor(() => expect(listDocumentsApi).toHaveBeenCalledTimes(2));
    finishFirstUpload();
    await waitFor(() => expect(listDocumentsApi).toHaveBeenCalledTimes(3));
    await screen.findByText("B.txt");

    resolveStaleList([first]);
    await waitFor(() => expect(screen.queryByText("document_library.loading")).not.toBeInTheDocument());
    expect(screen.getByText("A.txt")).toBeInTheDocument();
    expect(screen.getByText("B.txt")).toBeInTheDocument();
});
