// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { listDocumentsApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import { getStoredParsedDocuments } from "../../service/parsedDocumentStorage";
import { DocumentAttachMenu } from "./DocumentAttachMenu";

vi.mock("react-i18next", () => {
    const t = (key: string) => key;
    return { useTranslation: () => ({ t }) };
});
vi.mock("../../api/documents-client", () => ({ listDocumentsApi: vi.fn() }));
vi.mock("../../service/parsedDocumentStorage", () => ({ getStoredParsedDocuments: vi.fn(() => []) }));

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

const openMenu = (onToggleDocument = vi.fn()) => {
    render(<DocumentAttachMenu documents={[]} onToggleDocument={onToggleDocument} onUploadFiles={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "document_library.menu_trigger" }));
    return onToggleDocument;
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoredParsedDocuments).mockReturnValue([]);
});

it("explains an empty library inside the submenu", async () => {
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "document_library.select_from_library" }));

    expect(await screen.findByRole("menuitem", { name: "document_library.menu_empty" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("document_library.menu_browser_documents_hint")).not.toBeInTheDocument();
});

it("moves keyboard focus to the documents once the loading item is replaced", async () => {
    let finishLoading: (documents: DocumentLibraryEntry[]) => void = () => {};
    vi.mocked(listDocumentsApi).mockReturnValue(new Promise(resolve => (finishLoading = resolve)));
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "document_library.select_from_library" }));
    const loadingItem = await screen.findByRole("menuitem", { name: "document_library.menu_loading" });
    expect(loadingItem).toHaveAttribute("aria-disabled", "true");
    loadingItem.focus();

    finishLoading([entry()]);

    await waitFor(() => expect(screen.getByRole("menuitemcheckbox", { name: "Policy.txt" })).toHaveFocus());
});

it("points to the documents page when documents only exist in this browser", async () => {
    vi.mocked(getStoredParsedDocuments).mockReturnValue([
        { id: "old", name: "Alt.pdf", content: "text", size: 4, mimeType: "application/pdf", lastModified: 0, fileSignature: "old", parsedAt: "2026-09-14" }
    ]);
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
    openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "document_library.select_from_library" }));

    expect(await screen.findByText("document_library.menu_browser_documents_hint")).toBeInTheDocument();
    expect(screen.queryByText("document_library.menu_empty")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /document_library.manage/ })).toHaveAttribute("href", "#/documents");
});

it("keeps the submenu open when its trigger is clicked again", async () => {
    vi.mocked(listDocumentsApi).mockResolvedValue([entry()]);
    openMenu();

    const trigger = await screen.findByRole("menuitem", { name: "document_library.select_from_library" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("menuitemcheckbox", { name: "Policy.txt" })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("menuitemcheckbox", { name: "Policy.txt" })).toBeInTheDocument();
});

it("attaches a library document from the submenu", async () => {
    const document = entry();
    vi.mocked(listDocumentsApi).mockResolvedValue([document]);
    const onToggleDocument = openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: "document_library.select_from_library" }));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Policy.txt" }));

    expect(onToggleDocument).toHaveBeenCalledWith(document, true);
});
