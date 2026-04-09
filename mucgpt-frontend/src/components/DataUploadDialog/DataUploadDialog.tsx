import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, DocumentAdd24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { uploadFileApi } from "../../api/core-client";
import {
    clearStoredParsedDocuments,
    getStoredParsedDocuments,
    removeStoredParsedDocument,
    StoredParsedDocument,
    upsertParsedDocumentFromUpload
} from "../../service/parsedDocumentStorage";

import styles from "./DataUploadDialog.module.css";

export type UploadedDataStatus = "pending" | "uploading" | "ready" | "error";

export interface UploadedData {
    id: string;
    file: File;
    name: string;
    size: number;
    status: UploadedDataStatus;
    isActive: boolean;
    errorMessage?: string;
    fileContent?: string; // parsed text content returned by the parse endpoint
    source?: "upload" | "stored";
    storedDocumentId?: string;
    parsedAt?: string;
    fileSignature?: string;
    mimeType?: string;
}

interface DataUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: UploadedData[];
    onDataChange: (data: UploadedData[]) => void;
}

const generateDataId = () =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const getFileSignature = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

export const getDataSignature = (data: UploadedData) => getFileSignature(data.file);

export const createUploadedData = (file: File, status: UploadedDataStatus = "ready", overrides: Partial<UploadedData> = {}): UploadedData => ({
    id: overrides.id ?? generateDataId(),
    file,
    name: overrides.name ?? file.name,
    size: overrides.size ?? file.size,
    status,
    isActive: overrides.isActive ?? true,
    errorMessage: overrides.errorMessage,
    fileContent: overrides.fileContent,
    source: overrides.source ?? "upload",
    storedDocumentId: overrides.storedDocumentId,
    parsedAt: overrides.parsedAt,
    fileSignature: overrides.fileSignature,
    mimeType: overrides.mimeType ?? file.type
});

/**
 * Reconstructs an UploadedData entry from pre-parsed file content (e.g. when restoring from URL params).
 * A dummy File object is used since the original file is no longer available.
 */
export const createUploadedDataFromContent = (fileContent: string, name = "restored-file"): UploadedData => {
    const dummyFile = new File([], name, { type: "application/octet-stream" });
    return {
        id: generateDataId(),
        file: dummyFile,
        name,
        size: 0,
        status: "ready",
        isActive: true,
        fileContent,
        source: "stored"
    };
};

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

export const DataUploadDialog = ({ open, onOpenChange, data, onDataChange }: DataUploadDialogProps) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingData, setPendingData] = useState<UploadedData[]>([]);
    const [storedDocuments, setStoredDocuments] = useState<StoredParsedDocument[]>([]);
    const dataRef = useRef<UploadedData[]>(data);

    const refreshStoredDocuments = useCallback(() => {
        setStoredDocuments(getStoredParsedDocuments());
    }, []);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        if (open) {
            refreshStoredDocuments();
        } else {
            setPendingData([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [open, refreshStoredDocuments]);

    const hasPendingData = pendingData.length > 0;
    const hasStoredDocuments = storedDocuments.length > 0;

    const formatParsedAt = useCallback((value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }, []);

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

            setPendingData(prev => {
                const existingSignatures = new Set(prev.map(getDataSignature).concat(data.map(getDataSignature)));

                const newData = files.filter(file => !existingSignatures.has(getFileSignature(file))).map(file => createUploadedData(file, "pending"));

                return newData.length > 0 ? [...prev, ...newData] : prev;
            });

            if (event.target) {
                event.target.value = "";
            }
        },
        [data]
    );

    const handleRemovePending = useCallback((id: string) => {
        setPendingData(prev => prev.filter(data => data.id !== id));
    }, []);

    const handleCancel = useCallback(() => {
        setPendingData([]);
        onOpenChange(false);
    }, [onOpenChange]);

    const handleUseStoredDocument = useCallback(
        (document: StoredParsedDocument) => {
            const isAlreadyAttached = data.some(d => d.storedDocumentId === document.id);
            if (isAlreadyAttached) {
                return;
            }

            const file = new File([], document.name, { type: document.mimeType || "application/octet-stream", lastModified: document.lastModified });
            const reusable = createUploadedData(file, "ready", {
                size: document.size,
                fileContent: document.content,
                source: "stored",
                storedDocumentId: document.id,
                parsedAt: document.parsedAt,
                fileSignature: document.fileSignature,
                mimeType: document.mimeType
            });

            onDataChange([...data, reusable]);
        },
        [data, onDataChange]
    );

    const handleRemoveStoredDocument = useCallback(
        (id: string) => {
            removeStoredParsedDocument(id);
            refreshStoredDocuments();
        },
        [refreshStoredDocuments]
    );

    const handleClearStoredDocuments = useCallback(() => {
        clearStoredParsedDocuments();
        refreshStoredDocuments();
    }, [refreshStoredDocuments]);

    const handleConfirm = useCallback(() => {
        if (pendingData.length === 0) {
            onOpenChange(false);
            return;
        }

        // Mark data as uploading and add them to the main list
        const uploadingData = pendingData.map(doc => ({
            ...doc,
            status: "uploading" as UploadedDataStatus,
            isActive: doc.isActive ?? true
        }));

        const updatedData = [...data, ...uploadingData];
        onDataChange(updatedData);
        setPendingData([]);
        onOpenChange(false);

        // Upload each document
        uploadingData.forEach(data => {
            uploadFileApi(data.file)
                .then(fileContent => {
                    const storedDocument = upsertParsedDocumentFromUpload(data.file, fileContent);
                    const current = dataRef.current;
                    const updated = current.map(d =>
                        d.id === data.id
                            ? {
                                  ...d,
                                  status: "ready" as UploadedDataStatus,
                                  fileContent,
                                  storedDocumentId: storedDocument?.id,
                                  parsedAt: storedDocument?.parsedAt,
                                  fileSignature: storedDocument?.fileSignature,
                                  mimeType: storedDocument?.mimeType,
                                  source: "upload" as const
                              }
                            : d
                    );
                    onDataChange(updated);
                    refreshStoredDocuments();
                })
                .catch(error => {
                    console.error("Failed to upload data:", error);
                    const current = dataRef.current;
                    const updated = current.map(d =>
                        d.id === data.id ? { ...d, status: "error" as UploadedDataStatus, errorMessage: error.message || "Upload failed" } : d
                    );
                    onDataChange(updated);
                });
        });
    }, [pendingData, data, onDataChange, onOpenChange, refreshStoredDocuments]);

    const pendingList = useMemo(() => {
        if (!hasPendingData) {
            return (
                <Text className={styles.emptyState} role="note">
                    {t("components.questioninput.upload_dialog_no_pending", "Keine Dateien ausgewählt.")}
                </Text>
            );
        }

        return pendingData.map(data => (
            <div key={data.id} className={styles.fileItem}>
                <div className={styles.fileMeta}>
                    <span className={styles.fileName}>{data.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(data.size)}</span>
                </div>
                <Tooltip content={t("components.questioninput.remove_data", "Dokument entfernen")} relationship="description">
                    <Button
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss16Regular />}
                        onClick={() => handleRemovePending(data.id)}
                        aria-label={t("components.questioninput.remove_data", "Dokument entfernen")}
                    />
                </Tooltip>
            </div>
        ));
    }, [hasPendingData, pendingData, handleRemovePending, t]);

    const storedDocumentsList = useMemo(() => {
        if (storedDocuments.length === 0) {
            return (
                <Text className={styles.emptyState} role="note">
                    {t("components.questioninput.upload_manager_no_saved", "Noch keine gespeicherten Dokumente.")}
                </Text>
            );
        }

        return storedDocuments.map(document => {
            const isAttached = data.some(d => d.storedDocumentId === document.id);
            return (
                <div key={document.id} className={styles.fileItem}>
                    <div className={styles.fileMeta}>
                        <span className={styles.fileName}>{document.name}</span>
                        <span className={styles.fileSize}>{formatFileSize(document.size)}</span>
                        <span className={styles.fileSecondary}>
                            {t("components.questioninput.upload_manager_parsed_at", "Geparsed")}: {formatParsedAt(document.parsedAt)}
                        </span>
                    </div>
                    <div className={styles.fileActions}>
                        <Button appearance="secondary" size="small" onClick={() => handleUseStoredDocument(document)} disabled={isAttached}>
                            {isAttached
                                ? t("components.questioninput.upload_manager_added", "Hinzugefügt")
                                : t("components.questioninput.upload_manager_use", "Verwenden")}
                        </Button>
                        <Tooltip
                            content={t("components.questioninput.upload_manager_remove_saved", "Gespeichertes Dokument entfernen")}
                            relationship="description"
                        >
                            <Button
                                appearance="subtle"
                                size="small"
                                icon={<Dismiss16Regular />}
                                onClick={() => handleRemoveStoredDocument(document.id)}
                                aria-label={t("components.questioninput.upload_manager_remove_saved", "Gespeichertes Dokument entfernen")}
                            />
                        </Tooltip>
                    </div>
                </div>
            );
        });
    }, [data, formatParsedAt, handleRemoveStoredDocument, handleUseStoredDocument, storedDocuments, t]);

    return (
        <Dialog open={open} onOpenChange={onDialogOpenChange} modalType="modal">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <span className={styles.titleContent}>
                            <DocumentAdd24Regular className={styles.titleIcon} aria-hidden />
                            {t("components.questioninput.upload_dialog_title", "Dokumente verwalten")}
                        </span>
                    </DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <Text className={styles.description}>
                            {t(
                                "components.questioninput.upload_manager_description",
                                "Lade neue Dokumente hoch oder verwende bereits geparste Dokumente aus deinem lokalen Speicher."
                            )}
                        </Text>
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
                        <div className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <Text weight="semibold" as="h3" className={styles.sectionTitle}>
                                    {t("components.questioninput.upload_manager_saved_label", "Gespeicherte Dokumente")}
                                    <span className={styles.sectionCount}>({storedDocuments.length})</span>
                                </Text>
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    onClick={handleClearStoredDocuments}
                                    disabled={!hasStoredDocuments}
                                    aria-label={t("components.questioninput.upload_manager_clear_saved", "Alle gespeicherten Dokumente löschen")}
                                >
                                    {t("components.questioninput.upload_manager_clear_saved", "Alle löschen")}
                                </Button>
                            </div>
                            <div className={styles.fileList}>{storedDocumentsList}</div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={handleCancel}>
                            {t("components.questioninput.upload_dialog_cancel", "Abbrechen")}
                        </Button>
                        <Button appearance="primary" onClick={handleConfirm} disabled={!hasPendingData}>
                            {t("components.questioninput.upload_dialog_confirm", "Hinzufügen")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
