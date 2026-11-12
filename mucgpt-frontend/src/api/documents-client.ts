import { ApiError, deleteConfig, getConfig, handleApiRequest, handleRedirect, postFormDataConfig } from "./fetch-utils";
import type { DocumentLibraryEntry, DocumentMetadata } from "./models";

const DOCUMENTS_URL = "/api/backend/v1/documents";

export function listDocumentsApi(): Promise<DocumentLibraryEntry[]> {
    return handleApiRequest(() => fetch(DOCUMENTS_URL, getConfig()), "Failed to load documents");
}

export function uploadDocumentApi(file: File): Promise<DocumentMetadata> {
    const body = new FormData();
    body.append("file", file);
    return handleApiRequest(() => fetch(DOCUMENTS_URL, postFormDataConfig(body)), "Failed to upload document");
}

export async function deleteDocumentApi(documentId: string): Promise<void> {
    const response = await fetch(`${DOCUMENTS_URL}/${encodeURIComponent(documentId)}`, deleteConfig());
    handleRedirect(response);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(typeof error.detail === "string" ? error.detail : "Failed to delete document", response.status);
    }
}
