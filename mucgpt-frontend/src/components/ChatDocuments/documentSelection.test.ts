import { beforeEach, describe, expect, it, vi } from "vitest";

import { listDocumentsApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import { findLibraryDuplicate, getSelectedDocumentIds, restoreDocumentSelection } from "./documentSelection";

vi.mock("../../api/documents-client", () => ({ listDocumentsApi: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

const readyEntry = (): DocumentLibraryEntry => ({
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
});

describe("restoreDocumentSelection", () => {
    it("restores every saved ID without body content or reconstructed Files", async () => {
        const ready = readyEntry();
        vi.mocked(listDocumentsApi).mockResolvedValue([ready, { ...ready, id: "deleting", status: "deleting" }]);
        const selected = await restoreDocumentSelection(["ready", "deleted", "deleting"], { deleted: "Deleted policy.pdf", ready: "Old name.txt" });
        expect(selected.map(document => document.name)).toEqual(["Policy.txt", "Deleted policy.pdf", "Policy.txt"]);
        expect(selected.map(document => [document.id, document.status])).toEqual([
            ["ready", "ready"],
            ["deleted", "unavailable"],
            ["deleting", "unavailable"]
        ]);
        expect(getSelectedDocumentIds(selected)).toEqual(["ready", "deleted", "deleting"]);
        expect(selected.every(document => !("file" in document))).toBe(true);
        expect(selected.every(document => "usedInChat" in document && document.usedInChat)).toBe(true);
    });

    it("surfaces a failed library lookup instead of silently restoring no selection", async () => {
        vi.mocked(listDocumentsApi).mockRejectedValue(new Error("offline"));
        await expect(restoreDocumentSelection(["saved"])).rejects.toThrow("offline");
    });
});

describe("findLibraryDuplicate", () => {
    const file = (name: string, content: string, type = "text/plain") => new File([content], name, { type });

    it("matches a ready document with the same name and size", () => {
        expect(findLibraryDuplicate(file("Policy.txt", "12345"), [readyEntry()])?.id).toBe("ready");
    });

    it("does not match a different size, a different name or a document that is not ready", () => {
        expect(findLibraryDuplicate(file("Policy.txt", "123456"), [readyEntry()])).toBeUndefined();
        expect(findLibraryDuplicate(file("Other.txt", "12345"), [readyEntry()])).toBeUndefined();
        expect(findLibraryDuplicate(file("Policy.txt", "12345"), [{ ...readyEntry(), status: "processing" }])).toBeUndefined();
    });

    it("lets a specific differing MIME type veto the match but ignores a missing one", () => {
        expect(findLibraryDuplicate(file("Policy.txt", "12345", "application/pdf"), [readyEntry()])).toBeUndefined();
        expect(findLibraryDuplicate(file("Policy.txt", "12345", ""), [readyEntry()])?.id).toBe("ready");
    });
});
