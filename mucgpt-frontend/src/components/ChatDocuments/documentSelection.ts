import i18next from "i18next";

import { listDocumentsApi } from "../../api/documents-client";
import type { DocumentLibraryEntry, DocumentMetadata } from "../../api/models";

/** Mirrors the backend's per-user library limit (`DOCUMENT_LIMIT` in the core service). */
export const DOCUMENT_LIBRARY_LIMIT = 10;

interface PendingUpload {
    /** Local id; replaced by the library document once the upload succeeds. */
    id: string;
    file: File;
    name: string;
    size: number;
}

interface AttachedLibraryDocument {
    /** The library document id. */
    id: string;
    name: string;
    size: number;
    /** The document was part of a sent turn, so the agent may already have read it into the chat history. */
    usedInChat: boolean;
}

/**
 * A document shown in the chat composer: an upload in flight, or a library document attached to the chat.
 * `unavailable` documents were saved with the chat but are deleted or unreadable in the library now.
 */
export type ChatDocument =
    | ({ status: "uploading" } & PendingUpload)
    | ({ status: "failed"; errorMessage: string } & PendingUpload)
    | ({ status: "ready" } & AttachedLibraryDocument)
    | ({ status: "unavailable" } & AttachedLibraryDocument);

export type UploadingChatDocument = Extract<ChatDocument, { status: "uploading" }>;

export type LibraryChatDocument = Extract<ChatDocument, { status: "ready" | "unavailable" }>;

export const isLibraryDocument = (document: ChatDocument): document is LibraryChatDocument => document.status === "ready" || document.status === "unavailable";

export const getSelectedDocumentIds = (documents: ChatDocument[]) => documents.filter(isLibraryDocument).map(document => document.id);

/** A turn must not be sent while an upload is in flight or an attached document is gone, or it would silently lack documents. */
export const isSendBlockedByDocuments = (documents: ChatDocument[]) =>
    documents.some(document => document.status === "uploading" || document.status === "unavailable");

export const getFileSignature = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

export const getDocumentSignature = (document: ChatDocument) => (isLibraryDocument(document) ? document.id : getFileSignature(document.file));

export const createPendingUpload = (file: File): UploadingChatDocument => ({
    status: "uploading",
    id: crypto.randomUUID(),
    file,
    name: file.name,
    size: file.size
});

export const toChatDocument = (document: DocumentMetadata | DocumentLibraryEntry, usedInChat = false): ChatDocument => ({
    status: "ready",
    id: document.id,
    name: document.filename,
    size: document.original_size,
    usedInChat
});

/** Restores a chat's saved selection. These documents were sent before, hence `usedInChat`. */
export async function restoreDocumentSelection(ids: string[], savedNames: Record<string, string> = {}): Promise<ChatDocument[]> {
    if (ids.length === 0) return [];
    const documents = await listDocumentsApi();
    return ids.map(id => {
        const document = documents.find(entry => entry.id === id);
        return document?.status === "ready"
            ? toChatDocument(document, true)
            : {
                  status: "unavailable",
                  id,
                  name: document?.filename ?? savedNames[id] ?? i18next.t("document_library.unavailable_name"),
                  size: document?.original_size ?? 0,
                  usedInChat: true
              };
    });
}

const LIBRARY_STATUS_KEYS: Record<DocumentLibraryEntry["status"], string | undefined> = {
    ready: undefined,
    processing: "document_library.processing",
    deleting: "document_library.deleting"
};

/** Translation key describing a library document that cannot be used yet; undefined for ready documents. */
export const getLibraryStatusKey = (status: DocumentLibraryEntry["status"]) => LIBRARY_STATUS_KEYS[status];

const GENERIC_MIME_TYPE = "application/octet-stream";

/**
 * Finds a ready library document that is most likely the same file. The library keeps no content
 * hash, so name and size identify the candidate; the MIME type only vetoes a match when both
 * sides report a specific, differing type (browsers often report none at all).
 */
export const findLibraryDuplicate = (file: File, documents: DocumentLibraryEntry[]): DocumentLibraryEntry | undefined =>
    documents.find(document => {
        if (document.status !== "ready" || document.filename !== file.name || document.original_size !== file.size) return false;
        const fileType = file.type && file.type !== GENERIC_MIME_TYPE ? file.type : undefined;
        const documentType = document.mime_type && document.mime_type !== GENERIC_MIME_TYPE ? document.mime_type : undefined;
        return !fileType || !documentType || fileType === documentType;
    });

export const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
};
