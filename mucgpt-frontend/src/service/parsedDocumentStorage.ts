const PARSED_DOCUMENTS_STORAGE_KEY = "MUCGPT_PARSED_DOCUMENTS_V1";
const MAX_STORED_DOCUMENTS = 50;
const MAX_DOCUMENT_CONTENT_CHARS = 250_000;
const MAX_STORAGE_PAYLOAD_CHARS = 3_000_000;

export interface StoredParsedDocument {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    lastModified: number;
    fileSignature: string;
    parsedAt: string;
    content: string;
}

const generateId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `parsed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildFileSignature = (name: string, size: number, lastModified: number) => `${name}-${size}-${lastModified}`;

const canUseLocalStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isQuotaExceededError = (error: unknown) => {
    if (!(error instanceof DOMException)) {
        return false;
    }

    return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
};

const normalizeForStorage = (document: StoredParsedDocument): StoredParsedDocument => ({
    ...document,
    content: document.content.slice(0, MAX_DOCUMENT_CONTENT_CHARS)
});

export const getStoredParsedDocuments = (): StoredParsedDocument[] => {
    if (!canUseLocalStorage()) {
        return [];
    }

    try {
        const raw = localStorage.getItem(PARSED_DOCUMENTS_STORAGE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(doc => doc && typeof doc === "object" && typeof doc.id === "string" && typeof doc.content === "string")
            .map(
                (doc): StoredParsedDocument => ({
                    id: String(doc.id),
                    name: String(doc.name ?? "Unnamed document"),
                    size: Number(doc.size ?? 0),
                    mimeType: String(doc.mimeType ?? "application/octet-stream"),
                    lastModified: Number(doc.lastModified ?? 0),
                    fileSignature: String(
                        doc.fileSignature ?? buildFileSignature(String(doc.name ?? ""), Number(doc.size ?? 0), Number(doc.lastModified ?? 0))
                    ),
                    parsedAt: String(doc.parsedAt ?? new Date(0).toISOString()),
                    content: String(doc.content ?? "")
                })
            )
            .sort((a, b) => Date.parse(b.parsedAt) - Date.parse(a.parsedAt));
    } catch (error) {
        console.error("Failed to read parsed documents from localStorage", error);
        return [];
    }
};

const saveStoredParsedDocuments = (documents: StoredParsedDocument[]): boolean => {
    if (!canUseLocalStorage()) {
        return false;
    }

    let trimmed = documents
        .slice()
        .map(normalizeForStorage)
        .sort((a, b) => Date.parse(b.parsedAt) - Date.parse(a.parsedAt))
        .slice(0, MAX_STORED_DOCUMENTS);

    while (trimmed.length > 0) {
        const serialized = JSON.stringify(trimmed);

        if (serialized.length > MAX_STORAGE_PAYLOAD_CHARS) {
            trimmed = trimmed.slice(0, -1);
            continue;
        }

        try {
            localStorage.setItem(PARSED_DOCUMENTS_STORAGE_KEY, serialized);
            return true;
        } catch (error) {
            if (isQuotaExceededError(error)) {
                trimmed = trimmed.slice(0, -1);
                continue;
            }
            console.error("Failed to save parsed documents to localStorage", error);
            return false;
        }
    }

    try {
        localStorage.setItem(PARSED_DOCUMENTS_STORAGE_KEY, JSON.stringify([]));
        return true;
    } catch (error) {
        if (!isQuotaExceededError(error)) {
            console.error("Failed to clear parsed documents in localStorage", error);
        }
        return false;
    }
};

export const upsertParsedDocumentFromUpload = (file: File, content: string): StoredParsedDocument | null => {
    const documents = getStoredParsedDocuments();
    const fileSignature = buildFileSignature(file.name, file.size, file.lastModified);
    const existing = documents.find(doc => doc.fileSignature === fileSignature);

    const next: StoredParsedDocument = {
        id: existing?.id ?? generateId(),
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        lastModified: file.lastModified,
        fileSignature,
        parsedAt: new Date().toISOString(),
        content
    };

    const nextDocuments = [next, ...documents.filter(doc => doc.id !== next.id)];
    const persisted = saveStoredParsedDocuments(nextDocuments);
    if (!persisted) {
        return null;
    }

    const persistedDocument = getStoredParsedDocuments().find(doc => doc.id === next.id);
    return persistedDocument ?? normalizeForStorage(next);
};

export const removeStoredParsedDocument = (id: string) => {
    const documents = getStoredParsedDocuments();
    const nextDocuments = documents.filter(doc => doc.id !== id);
    saveStoredParsedDocuments(nextDocuments);
};

export const clearStoredParsedDocuments = () => {
    saveStoredParsedDocuments([]);
};
