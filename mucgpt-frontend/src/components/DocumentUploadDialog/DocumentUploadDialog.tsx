import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, DocumentAdd24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { uploadFileApi } from "../../api/doc-client";

import styles from "./DocumentUploadDialog.module.css";

export type UploadedDocumentStatus = "pending" | "uploading" | "ready" | "error";

export interface UploadedDocument {
    id: string;
    file: File;
    name: string;
    size: number;
    status: UploadedDocumentStatus;
    isActive: boolean;
    errorMessage?: string;
    fileId?: string; // UUID from the doc service
}

interface DocumentUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documents: UploadedDocument[];
    onDocumentsChange: (documents: UploadedDocument[]) => void;
}

const generateDocumentId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const getFileSignature = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

export const getDocumentSignature = (document: UploadedDocument) => getFileSignature(document.file);

export const createUploadedDocument = (file: File, status: UploadedDocumentStatus = "ready", overrides: Partial<UploadedDocument> = {}): UploadedDocument => ({
    id: overrides.id ?? generateDocumentId(),
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    status,
    isActive: overrides.isActive ?? true,
    errorMessage: overrides.errorMessage
});

const formatFileSize = (bytes: number) => {
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

export const DocumentUploadDialog = ({ open, onOpenChange, documents, onDocumentsChange }: DocumentUploadDialogProps) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingDocuments, setPendingDocuments] = useState<UploadedDocument[]>([]);
    const documentsRef = useRef<UploadedDocument[]>(documents);

    useEffect(() => {
        documentsRef.current = documents;
    }, [documents]);

    useEffect(() => {
        if (!open) {
            setPendingDocuments([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [open]);

    const hasPendingDocuments = pendingDocuments.length > 0;

    const onDialogOpenChange = useCallback(
        (_: unknown, data: { open: boolean }) => {
            onOpenChange(data.open);
        },
        [onOpenChange]
    );

    const handleFileSelection = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) {
                return;
            }

            setPendingDocuments(prev => {
                const existingSignatures = new Set(prev.map(getDocumentSignature).concat(documents.map(getDocumentSignature)));

                const newDocs = files.filter(file => !existingSignatures.has(getFileSignature(file))).map(file => createUploadedDocument(file, "pending"));

                return newDocs.length > 0 ? [...prev, ...newDocs] : prev;
            });

            if (event.target) {
                event.target.value = "";
            }
        },
        [documents]
    );

    const handleRemovePending = useCallback((id: string) => {
        setPendingDocuments(prev => prev.filter(doc => doc.id !== id));
    }, []);

    const handleCancel = useCallback(() => {
        setPendingDocuments([]);
        onOpenChange(false);
    }, [onOpenChange]);

    const handleConfirm = useCallback(() => {
        if (pendingDocuments.length === 0) {
            onOpenChange(false);
            return;
        }

        // Mark documents as uploading and add them to the main list
        const uploadingDocuments = pendingDocuments.map(doc => ({
            ...doc,
            status: "uploading" as UploadedDocumentStatus,
            isActive: doc.isActive ?? true
        }));

        const updatedDocuments = [...documents, ...uploadingDocuments];
        onDocumentsChange(updatedDocuments);
        setPendingDocuments([]);
        onOpenChange(false);

        // Upload each document
        uploadingDocuments.forEach(doc => {
            uploadFileApi(doc.file)
                .then(fileId => {
                    const current = documentsRef.current;
                    const updated = current.map(d => (d.id === doc.id ? { ...d, status: "ready" as UploadedDocumentStatus, fileId } : d));
                    onDocumentsChange(updated);
                })
                .catch(error => {
                    console.error("Failed to upload document:", error);
                    const current = documentsRef.current;
                    const updated = current.map(d =>
                        d.id === doc.id ? { ...d, status: "error" as UploadedDocumentStatus, errorMessage: error.message || "Upload failed" } : d
                    );
                    onDocumentsChange(updated);
                });
        });
    }, [pendingDocuments, documents, onDocumentsChange, onOpenChange]);

    const pendingList = useMemo(() => {
        if (!hasPendingDocuments) {
            return (
                <Text className={styles.emptyState} role="note">
                    {t("components.questioninput.upload_dialog_no_pending", "Keine Dateien ausgewählt.")}
                </Text>
            );
        }

        return pendingDocuments.map(doc => (
            <div key={doc.id} className={styles.fileItem}>
                <div className={styles.fileMeta}>
                    <span className={styles.fileName}>{doc.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(doc.size)}</span>
                </div>
                <Tooltip content={t("components.questioninput.remove_document", "Dokument entfernen")} relationship="description">
                    <Button
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss16Regular />}
                        onClick={() => handleRemovePending(doc.id)}
                        aria-label={t("components.questioninput.remove_document", "Dokument entfernen")}
                    />
                </Tooltip>
            </div>
        ));
    }, [hasPendingDocuments, pendingDocuments, handleRemovePending, t]);

    return (
        <Dialog open={open} onOpenChange={onDialogOpenChange} modalType="modal">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <span className={styles.titleContent}>
                            <DocumentAdd24Regular className={styles.titleIcon} aria-hidden />
                            {t("components.questioninput.upload_dialog_title", "Dokumente hinzufügen")}
                        </span>
                    </DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <Field
                            label={t("components.questioninput.upload_dialog_select_label", "Dateien auswählen")}
                            hint={t("components.questioninput.upload_dialog_select_hint", "Mehrere Dateien sind möglich.")}
                            className={styles.field}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className={styles.fileInput}
                                onChange={handleFileSelection}
                                aria-label={t("components.questioninput.upload_dialog_select_label", "Dateien auswählen")}
                            />
                        </Field>
                        <div className={styles.section}>
                            <Text weight="semibold" as="h3" className={styles.sectionTitle}>
                                {t("components.questioninput.upload_dialog_pending_label", "Ausgewählte Dateien")}
                            </Text>
                            <div className={styles.fileList}>{pendingList}</div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={handleCancel}>
                            {t("components.questioninput.upload_dialog_cancel", "Abbrechen")}
                        </Button>
                        <Button appearance="primary" onClick={handleConfirm} disabled={!hasPendingDocuments}>
                            {t("components.questioninput.upload_dialog_confirm", "Hinzufügen")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
