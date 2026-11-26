import { useAnnounce } from "@fluentui/react-components";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";

import { acknowledgeDocumentSensitivityApi, listDocumentsApi, uploadDocumentApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import {
    createPendingUpload,
    findLibraryDuplicate,
    getDocumentSignature,
    getFileSignature,
    getUnconfirmedDocuments,
    isLibraryDocument,
    isSendBlockedByDocuments,
    toChatDocument,
    type ChatDocument,
    type UploadingChatDocument
} from "./documentSelection";
import { getUploadErrorKey } from "./uploadErrors";

export interface DuplicateUpload {
    file: File;
    documentId: string;
    /** The existing document was attached because of this upload, so "upload anyway" detaches it again. */
    attachedByUpload: boolean;
}

/**
 * Attachment state of the chat composer: uploads, library selection and duplicate handling.
 * `conversationKey` identifies the chat; the composer stays mounted when switching chats, so duplicate notices are scoped by it.
 */
export const useChatDocuments = (documents: ChatDocument[], setDocuments: Dispatch<SetStateAction<ChatDocument[]>>, conversationKey?: string) => {
    const { t } = useTranslation();
    const { announce } = useAnnounce();
    const [duplicateUploads, setDuplicateUploads] = useState<DuplicateUpload[]>([]);
    const [isConfirmingSensitive, setIsConfirmingSensitive] = useState(false);
    const [hasConfirmationFailed, setHasConfirmationFailed] = useState(false);
    // Uploads finish independently of renders, so state changes always go through updater functions;
    // this ref is only read for decisions that tolerate a value from the last render.
    const latestDocumentsRef = useRef(documents);
    // Bumped on every chat switch so a duplicate check that started in the previous chat is discarded.
    const conversationGenerationRef = useRef(0);

    useEffect(() => {
        latestDocumentsRef.current = documents;
    }, [documents]);

    useEffect(() => {
        conversationGenerationRef.current += 1;
        setDuplicateUploads(current => (current.length === 0 ? current : []));
    }, [conversationKey]);

    const hasUnavailableDocuments = documents.some(document => document.status === "unavailable");
    const isSendBlocked = isSendBlockedByDocuments(documents);
    const unconfirmedDocuments = getUnconfirmedDocuments(documents);

    const upload = useCallback(
        (pending: UploadingChatDocument) => {
            uploadDocumentApi(pending.file)
                .then(document => {
                    setDocuments(current => current.map(entry => (entry.id === pending.id ? toChatDocument(document) : entry)));
                    announce(t("document_library.announce_ready", { name: pending.name }), { polite: true });
                })
                .catch(error => {
                    console.error("Failed to upload document:", error);
                    const errorMessage = t(getUploadErrorKey(error));
                    const failed: ChatDocument = { ...pending, status: "failed", errorMessage };
                    setDocuments(current => current.map(entry => (entry.id === pending.id ? failed : entry)));
                    announce(t("document_library.upload_failed_named", { name: pending.name, reason: errorMessage }), { alert: true });
                });
        },
        [announce, setDocuments, t]
    );

    const attachFiles = useCallback(
        async (files: File[], { skipDuplicateCheck = false } = {}) => {
            const knownSignatures = new Set(latestDocumentsRef.current.map(getDocumentSignature));
            const pendingUploads: UploadingChatDocument[] = [];
            for (const file of files) {
                const signature = getFileSignature(file);
                if (knownSignatures.has(signature)) continue;
                knownSignatures.add(signature);
                pendingUploads.push(createPendingUpload(file));
            }
            if (pendingUploads.length === 0) return;

            // The chips appear before the duplicate check so the drop is acknowledged immediately.
            setDocuments(current => [...current, ...pendingUploads]);

            const generation = conversationGenerationRef.current;
            let library: DocumentLibraryEntry[] = [];
            if (!skipDuplicateCheck) {
                try {
                    library = await listDocumentsApi();
                } catch (error) {
                    // Duplicate detection is a convenience; a real library problem surfaces through the upload itself.
                    console.error("Failed to check the library for duplicates:", error);
                }
            }
            // The chat was switched meanwhile: its placeholders are gone, so neither upload nor report duplicates.
            if (generation !== conversationGenerationRef.current) return;

            const duplicates: DuplicateUpload[] = [];
            for (const pending of pendingUploads) {
                const duplicate = findLibraryDuplicate(pending.file, library);
                if (!duplicate) {
                    upload(pending);
                    continue;
                }
                const isDuplicate = (document: ChatDocument) => isLibraryDocument(document) && document.id === duplicate.id;
                const alreadyAttached = latestDocumentsRef.current.some(isDuplicate);
                // The placeholder turns into the existing document unless that one is attached already.
                setDocuments(current =>
                    current.some(isDuplicate)
                        ? current.filter(document => document.id !== pending.id)
                        : current.map(document => (document.id === pending.id ? toChatDocument(duplicate) : document))
                );
                duplicates.push({ file: pending.file, documentId: duplicate.id, attachedByUpload: !alreadyAttached });
            }
            if (duplicates.length > 0) {
                // Earlier batches stay unresolved until the user decides; dropping the same file again must not list it twice.
                setDuplicateUploads(current => {
                    const known = new Set(current.map(duplicate => getFileSignature(duplicate.file)));
                    return [...current, ...duplicates.filter(duplicate => !known.has(getFileSignature(duplicate.file)))];
                });
            }
        },
        [setDocuments, upload]
    );

    const uploadDuplicatesAnyway = useCallback(() => {
        const detachIds = new Set(duplicateUploads.filter(duplicate => duplicate.attachedByUpload).map(duplicate => duplicate.documentId));
        setDocuments(current => current.filter(document => !(isLibraryDocument(document) && detachIds.has(document.id))));
        setDuplicateUploads([]);
        void attachFiles(
            duplicateUploads.map(duplicate => duplicate.file),
            { skipDuplicateCheck: true }
        );
    }, [attachFiles, duplicateUploads, setDocuments]);

    const dismissDuplicates = useCallback(() => setDuplicateUploads([]), []);

    const toggleLibraryDocument = useCallback(
        (document: DocumentLibraryEntry, attach: boolean) => {
            setDocuments(current => {
                const others = current.filter(entry => !(isLibraryDocument(entry) && entry.id === document.id));
                return attach ? [...others, toChatDocument(document)] : others;
            });
        },
        [setDocuments]
    );

    const removeDocument = useCallback(
        (id: string) => {
            const removed = latestDocumentsRef.current.find(document => document.id === id);
            setDocuments(current => current.filter(document => document.id !== id));
            if (removed) announce(t("document_library.announce_removed", { name: removed.name }), { polite: true });
        },
        [announce, setDocuments, t]
    );

    const retryUpload = useCallback(
        (id: string) => {
            const document = latestDocumentsRef.current.find(entry => entry.id === id);
            if (document?.status !== "failed") return;
            const retried: UploadingChatDocument = { status: "uploading", id, file: document.file, name: document.name, size: document.size };
            setDocuments(current => current.map(entry => (entry.id === id ? retried : entry)));
            upload(retried);
        },
        [setDocuments, upload]
    );

    /** Records the user's confirmation of likely personal data or secrets; documents that fail stay unconfirmed and keep blocking the send. */
    const confirmSensitiveDocuments = useCallback(async () => {
        const ids = getUnconfirmedDocuments(latestDocumentsRef.current).map(document => document.id);
        if (ids.length === 0) return;
        setIsConfirmingSensitive(true);
        setHasConfirmationFailed(false);
        const results = await Promise.allSettled(ids.map(id => acknowledgeDocumentSensitivityApi(id)));
        const confirmed = new Set(ids.filter((_, index) => results[index].status === "fulfilled"));
        setDocuments(current =>
            current.map(document => (document.status === "ready" && confirmed.has(document.id) ? { ...document, needsConfirmation: false } : document))
        );
        setIsConfirmingSensitive(false);
        if (confirmed.size < ids.length) {
            console.error("Failed to confirm sensitive documents:", results);
            setHasConfirmationFailed(true);
            announce(t("document_library.sensitivity_confirm_failed"), { alert: true });
        } else {
            announce(t("document_library.sensitivity_confirmed"), { polite: true });
        }
    }, [announce, setDocuments, t]);

    /** Detaches unconfirmed flagged documents from this chat; they stay in the library. */
    const removeUnconfirmedDocuments = useCallback(() => {
        const ids = new Set(getUnconfirmedDocuments(latestDocumentsRef.current).map(document => document.id));
        if (ids.size === 0) return;
        setDocuments(current => current.filter(document => !ids.has(document.id)));
        setHasConfirmationFailed(false);
        announce(t("document_library.sensitivity_removed"), { polite: true });
    }, [announce, setDocuments, t]);

    /** Documents sent with a turn may have been read by the agent, which changes what removing them means. */
    const markReadyDocumentsAsUsed = useCallback(() => {
        if (!latestDocumentsRef.current.some(document => document.status === "ready" && !document.usedInChat)) return;
        setDocuments(current => current.map(document => (document.status === "ready" ? { ...document, usedInChat: true } : document)));
    }, [setDocuments]);

    return {
        hasUnavailableDocuments,
        isSendBlocked,
        unconfirmedDocuments,
        isConfirmingSensitive,
        hasConfirmationFailed,
        confirmSensitiveDocuments,
        removeUnconfirmedDocuments,
        duplicateUploads,
        attachFiles,
        uploadDuplicatesAnyway,
        dismissDuplicates,
        toggleLibraryDocument,
        removeDocument,
        retryUpload,
        markReadyDocumentsAsUsed
    };
};
