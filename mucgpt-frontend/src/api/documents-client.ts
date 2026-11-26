import { ApiError, deleteConfig, getConfig, handleApiRequest, handleRedirect, postFormDataConfig } from "./fetch-utils";
import type { DocumentLibraryEntry, DocumentMetadata, SensitivityFinding } from "./models";

const DOCUMENTS_URL = "/api/backend/v1/documents";

export function listDocumentsApi(): Promise<DocumentLibraryEntry[]> {
    return handleApiRequest(() => fetch(DOCUMENTS_URL, getConfig()), "Failed to load documents");
}

export async function uploadDocumentApi(file: File, confirm?: (name: string, findings: SensitivityFinding[]) => Promise<boolean>): Promise<DocumentMetadata> {
    const body = new FormData();
    body.append("file", file);
    for (;;) {
        const response = await fetch(DOCUMENTS_URL, postFormDataConfig(body));
        handleRedirect(response, true);
        if (response.status === 409 && confirm) {
            const { detail } = await response
                .clone()
                .json()
                .catch(() => ({}));
            if (detail?.code === "sensitivity_confirmation_required" && typeof detail.fingerprint === "string" && Array.isArray(detail.findings)) {
                if (!(await confirm(file.name, detail.findings))) throw new DOMException("Upload cancelled", "AbortError");
                body.set("confirmation_fingerprint", detail.fingerprint);
                continue;
            }
        }
        return handleApiRequest(() => Promise.resolve(response), "Failed to upload document");
    }
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
