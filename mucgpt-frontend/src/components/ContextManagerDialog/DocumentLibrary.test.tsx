// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { deleteDocumentApi, listDocumentsApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import { getSelectedDocumentIds } from "./ContextManagerDialog";
import { DocumentLibrary, restoreDocumentSelection } from "./DocumentLibrary";

vi.mock("react-i18next", () => {
    const t = (key: string) => key;
    return { useTranslation: () => ({ t }) };
});
vi.mock("../../api/documents-client", () => ({ listDocumentsApi: vi.fn(), deleteDocumentApi: vi.fn(), uploadDocumentApi: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it("restores every saved ID without body content or reconstructed Files", async () => {
    const ready: DocumentLibraryEntry = {
        id: "ready",
        filename: "Policy.txt",
        mime_type: "text/plain",
        original_size: 5,
        text_length: 5,
        preview: "text",
        preview_kind: "initial_excerpt",
        path: "/documents/ready.txt",
        created_at: "2026-11-02",
        status: "ready"
    };
    vi.mocked(listDocumentsApi).mockResolvedValue([ready, { ...ready, id: "deleting", status: "deleting" }]);
    const selected = await restoreDocumentSelection(["ready", "deleted", "deleting"], { deleted: "Deleted policy.pdf", ready: "Old name.txt" });
    expect(selected.map(document => document.name)).toEqual(["Policy.txt", "Deleted policy.pdf", "Policy.txt"]);
    expect(selected.map(document => [document.id, document.status])).toEqual([
        ["ready", "ready"],
        ["deleted", "unavailable"],
        ["deleting", "unavailable"]
    ]);
    expect(getSelectedDocumentIds(selected)).toEqual(["ready", "deleted", "deleting"]);
    expect(selected.every(document => !document.file && !document.fileContent)).toBe(true);
});

it("does not fetch the library for an explicit empty selection", async () => {
    expect(await restoreDocumentSelection([])).toEqual([]);
    expect(listDocumentsApi).not.toHaveBeenCalled();
});

it("surfaces a failed library lookup instead of silently restoring no selection", async () => {
    vi.mocked(listDocumentsApi).mockRejectedValue(new Error("offline"));
    await expect(restoreDocumentSelection(["saved"])).rejects.toThrow("offline");
});

it("shows an unavailable selection and detaches it without globally deleting a document", async () => {
    vi.mocked(listDocumentsApi).mockResolvedValue([]);
    const data = await restoreDocumentSelection(["deleted"], { deleted: "Policy.pdf" });
    const onDataChange = vi.fn();
    render(<DocumentLibrary data={data} onDataChange={onDataChange} />);
    expect(await screen.findByText("document_library.unavailable_selection")).toBeInTheDocument();
    expect(screen.getByText("Policy.pdf")).toBeInTheDocument();
    const detach = await screen.findByRole("button", { name: "document_library.detach" });
    await waitFor(() => expect(detach).toBeEnabled());
    fireEvent.click(detach);
    expect(onDataChange).toHaveBeenCalledWith([]);
    expect(deleteDocumentApi).not.toHaveBeenCalled();
});
