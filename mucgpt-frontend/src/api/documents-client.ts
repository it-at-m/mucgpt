import { ApiError, deleteConfig, getConfig, handleApiRequest, handleRedirect, postConfig, postFormDataConfig } from "./fetch-utils";
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

async function throwOnError(response: Response, fallbackMessage: string) {
    handleRedirect(response);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(typeof error.detail === "string" ? error.detail : fallbackMessage, response.status);
    }
}

export async function deleteDocumentApi(documentId: string): Promise<void> {
    const response = await fetch(`${DOCUMENTS_URL}/${encodeURIComponent(documentId)}`, deleteConfig());
    await throwOnError(response, "Failed to delete document");
}

/** Confirms that the user has seen the warning about likely personal data or secrets; required before attaching a flagged document. */
export async function acknowledgeDocumentSensitivityApi(documentId: string): Promise<void> {
    const response = await fetch(`${DOCUMENTS_URL}/${encodeURIComponent(documentId)}/acknowledge-sensitivity`, postConfig());
    await throwOnError(response, "Failed to confirm document");
}
