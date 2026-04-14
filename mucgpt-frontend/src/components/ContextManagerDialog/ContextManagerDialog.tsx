import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Spinner,
    Text,
    Tooltip
} from "@fluentui/react-components";
import { Dismiss24Regular, Delete16Regular, ArrowDownload16Regular, ArrowUpload16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { uploadFileApi } from "../../api/core-client";
import {
    clearStoredParsedDocuments,
    getStoredParsedDocuments,
    removeStoredParsedDocument,
    StoredParsedDocument,
    upsertParsedDocumentFromUpload
} from "../../service/parsedDocumentStorage";
import { useGlobalToastContext } from "../GlobalToastHandler/GlobalToastContext";
import styles from "./ContextManagerDialog.module.css";

export type UploadedDataStatus = "pending" | "uploading" | "ready" | "error" | "pending-restore";

export interface UploadedData {
    id: string;
    file: File;
    name: string;
    size: number;
    status: UploadedDataStatus;
    isActive: boolean;
    errorMessage?: string;
    fileContent?: string | null; // parsed text content returned by the parse endpoint; null means content is known to be absent (e.g. pending-restore)
    source?: "upload" | "stored";
    storedDocumentId?: string;
    parsedAt?: string;
    fileSignature?: string;
    mimeType?: string;
}

interface ContextManagerDialogProps {
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

export const ContextManagerDialog = ({ open, onOpenChange, data, onDataChange }: ContextManagerDialogProps) => {
    const { t } = useTranslation();
    const { showError, showSuccess } = useGlobalToastContext();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [storedDocuments, setStoredDocuments] = useState<StoredParsedDocument[]>([]);
    const [selectedStoredDocumentIds, setSelectedStoredDocumentIds] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    // Transient error entries for uploads that succeeded on the network but
    // could not be persisted to browser storage (e.g. QuotaExceededError).
    // They are shown in the list so the user knows what happened, but are
    // never written to localStorage.
    const [failedUploads, setFailedUploads] = useState<UploadedData[]>([]);

    const toUploadedData = useCallback((document: StoredParsedDocument): UploadedData => {
        const file = new File([], document.name, {
            type: document.mimeType || "application/octet-stream",
            lastModified: document.lastModified
        });
        return createUploadedData(file, "ready", {
            size: document.size,
            fileContent: document.content,
            source: "stored",
            storedDocumentId: document.id,
            parsedAt: document.parsedAt,
            fileSignature: document.fileSignature,
            mimeType: document.mimeType
        });
    }, []);

    const syncSelectionToData = useCallback(
        (selectedIds: string[], documents: StoredParsedDocument[], currentFailedUploads: UploadedData[]) => {
            const selectedData = documents.filter(document => selectedIds.includes(document.id)).map(toUploadedData);
            onDataChange([...selectedData, ...currentFailedUploads]);
        },
        [onDataChange, toUploadedData]
    );

    useEffect(() => {
        if (open) {
            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);
            const selectedIds = data.map(d => d.storedDocumentId).filter((id): id is string => Boolean(id));
            setSelectedStoredDocumentIds(selectedIds);
            // Restore any transient error entries that are already tracked in `data`
            setFailedUploads(data.filter(d => d.status === "error" && !d.storedDocumentId));
        } else {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [open, data]);

    const hasStoredDocuments = storedDocuments.length > 0;

    const formatParsedAt = useCallback((value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(date);
    }, []);

    const onDialogOpenChange = useCallback(
        (_: unknown, dialogData: { open: boolean }) => {
            onOpenChange(dialogData.open);
        },
        [onOpenChange]
    );

    const showCountToast = useCallback(
        (
            count: number,
            showToast: (title: string, message?: string, timeout?: number) => string,
            titleKey: string,
            titleFallback: string,
            messageKey: string
        ) => {
            if (count === 0) {
                return;
            }

            showToast(t(titleKey, titleFallback), t(messageKey, { count }));
        },
        [t]
    );

    const handleFileSelection = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) {
                return;
            }

            setIsUploading(true);
            const newlyStoredIds: string[] = [];
            const newlyFailedUploads: UploadedData[] = [];
            let uploadFailureCount = 0;
            const knownSignatures = new Set(storedDocuments.map(doc => doc.fileSignature));

            for (const file of files) {
                const signature = getFileSignature(file);
                if (knownSignatures.has(signature)) {
                    continue;
                }
                try {
                    const fileContent = await uploadFileApi(file);
                    const storedDocument = upsertParsedDocumentFromUpload(file, fileContent);
                    if (storedDocument) {
                        // Storage succeeded — track the new id so we can select it.
                        newlyStoredIds.push(storedDocument.id);
                        knownSignatures.add(signature);
                    } else {
                        // The network upload worked but the browser rejected the
                        // localStorage write (e.g. QuotaExceededError).  Create a
                        // transient error entry so the user sees what happened.
                        console.error(`Failed to persist document "${file.name}" to browser storage (storage quota may be exceeded).`);
                        newlyFailedUploads.push(
                            createUploadedData(file, "error", {
                                fileContent,
                                errorMessage: t(
                                    "components.contextmanagerdialog.storage_error",
                                    "Dokument konnte nicht gespeichert werden (Speicherplatz voll)."
                                )
                            })
                        );
                    }
                } catch (error) {
                    console.error("Failed to upload data:", error);
                    uploadFailureCount += 1;
                }
            }

            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);

            const nextFailedUploads = [...failedUploads, ...newlyFailedUploads];
            if (newlyFailedUploads.length > 0) {
                setFailedUploads(nextFailedUploads);
            }

            if (newlyStoredIds.length > 0 || newlyFailedUploads.length > 0) {
                const nextSelectedIds = Array.from(new Set([...selectedStoredDocumentIds, ...newlyStoredIds]));
                setSelectedStoredDocumentIds(nextSelectedIds);
                syncSelectionToData(nextSelectedIds, docs, nextFailedUploads);
            }

            showCountToast(
                newlyStoredIds.length,
                showSuccess,
                "components.contextmanagerdialog.upload_success_title",
                "Upload erfolgreich",
                "components.contextmanagerdialog.upload_success"
            );

            showCountToast(
                newlyFailedUploads.length,
                showError,
                "components.contextmanagerdialog.storage_error_title",
                "Speichern fehlgeschlagen",
                "components.contextmanagerdialog.storage_error"
            );

            showCountToast(
                uploadFailureCount,
                showError,
                "components.contextmanagerdialog.upload_error_title",
                "Upload fehlgeschlagen",
                "components.contextmanagerdialog.upload_error"
            );

            setIsUploading(false);

            if (event.target) {
                event.target.value = "";
            }
        },
        [storedDocuments, selectedStoredDocumentIds, failedUploads, syncSelectionToData, showCountToast, showError, showSuccess]
    );

    const handleToggleStoredDocument = useCallback(
        (documentId: string, checked: boolean) => {
            const nextSelectedIds = checked
                ? Array.from(new Set([...selectedStoredDocumentIds, documentId]))
                : selectedStoredDocumentIds.filter(id => id !== documentId);
            setSelectedStoredDocumentIds(nextSelectedIds);
            syncSelectionToData(nextSelectedIds, storedDocuments, failedUploads);
        },
        [selectedStoredDocumentIds, storedDocuments, failedUploads, syncSelectionToData]
    );

    const handleRemoveStoredDocument = useCallback(
        (id: string) => {
            removeStoredParsedDocument(id);
            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);
            const nextSelectedIds = selectedStoredDocumentIds.filter(selectedId => selectedId !== id);
            setSelectedStoredDocumentIds(nextSelectedIds);
            syncSelectionToData(nextSelectedIds, docs, failedUploads);
        },
        [selectedStoredDocumentIds, failedUploads, syncSelectionToData]
    );

    const handleRemoveFailedUpload = useCallback(
        (id: string) => {
            const nextFailedUploads = failedUploads.filter(entry => entry.id !== id);
            setFailedUploads(nextFailedUploads);
            syncSelectionToData(selectedStoredDocumentIds, storedDocuments, nextFailedUploads);
        },
        [failedUploads, selectedStoredDocumentIds, storedDocuments, syncSelectionToData]
    );

    const handleClearStoredDocuments = useCallback(() => {
        clearStoredParsedDocuments();
        setStoredDocuments([]);
        setSelectedStoredDocumentIds([]);
        setFailedUploads([]);
        onDataChange([]);
    }, [onDataChange]);

    const handleDownloadParsedContent = useCallback((doc: StoredParsedDocument) => {
        if (!doc.content) {
            return;
        }

        const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");

        anchor.href = url;
        anchor.download = `${doc.name}.txt`;
        window.document.body.appendChild(anchor);
        anchor.click();
        window.document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, []);

    const storedDocumentsList = useMemo(() => {
        if (storedDocuments.length === 0 && failedUploads.length === 0) {
            return (
                <Text className={styles.emptyState} role="note">
                    {t("components.contextmanagerdialog.no_saved", "Noch keine gespeicherten Dokumente.")}
                </Text>
            );
        }

        return (
            <>
                {failedUploads.map(entry => (
                    <div key={entry.id} className={`${styles.fileItem} ${styles.fileItemError}`} role="alert">
                        <div className={styles.fileMeta}>
                            <Tooltip content={entry.name} relationship="description">
                                <Text size={300} weight="semibold" className={styles.fileName}>
                                    {entry.name}
                                </Text>
                            </Tooltip>
                            <Text size={200} className={styles.fileSize}>
                                {formatFileSize(entry.size)}
                            </Text>
                            <Text size={200} className={styles.fileSecondary}>
                                {entry.errorMessage ??
                                    t("components.contextmanagerdialog.storage_error", "Dokument konnte nicht gespeichert werden (Speicherplatz voll).")}
                            </Text>
                        </div>
                        <div className={styles.fileActions}>
                            <Tooltip content={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")} relationship="description">
                                <Button
                                    appearance="subtle"
                                    size="small"
                                    icon={<Delete16Regular />}
                                    onClick={() => handleRemoveFailedUpload(entry.id)}
                                    aria-label={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")}
                                />
                            </Tooltip>
                        </div>
                    </div>
                ))}
                {storedDocuments.map(document => {
                    const isAttached = selectedStoredDocumentIds.includes(document.id);
                    const itemClassName = [styles.fileItem, isAttached && styles.fileItemSelected].filter(Boolean).join(" ");

                    return (
                        <div key={document.id} className={itemClassName}>
                            <div className={styles.fileSelector}>
                                <Checkbox
                                    checked={isAttached}
                                    onChange={(_, checkboxData) => handleToggleStoredDocument(document.id, checkboxData.checked === true)}
                                    aria-label={t("components.contextmanagerdialog.use", "Verwenden")}
                                />
                            </div>
                            <div className={styles.fileMeta}>
                                <Tooltip content={document.name} relationship="description">
                                    <Text size={300} weight="semibold" className={styles.fileName}>
                                        {document.name}
                                    </Text>
                                </Tooltip>
                                <Text size={200} className={styles.fileSecondary}>
                                    {t("components.contextmanagerdialog.parsed_at", "Verarbeitet am")}: {formatParsedAt(document.parsedAt)} •{" "}
                                    {formatFileSize(document.size)}
                                </Text>
                            </div>
                            <div className={styles.fileActions}>
                                {document.content && (
                                    <Tooltip content={t("components.contextmanagerdialog.download", "Text herunterladen")} relationship="description">
                                        <Button
                                            appearance="subtle"
                                            size="small"
                                            icon={<ArrowDownload16Regular />}
                                            onClick={() => handleDownloadParsedContent(document)}
                                            aria-label={t("components.contextmanagerdialog.download", "Text herunterladen")}
                                        />
                                    </Tooltip>
                                )}
                                <Tooltip
                                    content={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")}
                                    relationship="description"
                                >
                                    <Button
                                        appearance="subtle"
                                        size="small"
                                        icon={<Delete16Regular />}
                                        onClick={() => handleRemoveStoredDocument(document.id)}
                                        aria-label={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    );
                })}
            </>
        );
    }, [
        failedUploads,
        formatParsedAt,
        handleDownloadParsedContent,
        handleRemoveFailedUpload,
        handleRemoveStoredDocument,
        handleToggleStoredDocument,
        selectedStoredDocumentIds,
        storedDocuments,
        t
    ]);

    const selectedCount = selectedStoredDocumentIds.length;
    const totalCount = storedDocuments.length;

    return (
        <Dialog open={open} onOpenChange={onDialogOpenChange} modalType="modal">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
                            </DialogTrigger>
                        }
                    >
                        {t("components.contextmanagerdialog.title", "Meine Dokumente")}
                    </DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <Text className={styles.subtitle}>
                            {t("components.contextmanagerdialog.subtitle", "Ausgewählte Dokumente werden im Chat als Kontext verwendet.")}
                        </Text>
                        <div className={styles.toolbar}>
                            <Text as="span" className={styles.toolbarCount}>
                                {t("components.contextmanagerdialog.selection_count", "Im Chat verwendet: {{selected}} von {{total}}", {
                                    selected: selectedCount,
                                    total: totalCount
                                })}
                            </Text>
                            <div className={styles.toolbarActions}>
                                {isUploading ? (
                                    <Spinner size="tiny" label={t("components.contextmanagerdialog.uploading", "Wird hochgeladen...")} labelPosition="after" />
                                ) : (
                                    <Button
                                        appearance="primary"
                                        size="small"
                                        icon={<ArrowUpload16Regular />}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
                                        {t("components.contextmanagerdialog.upload_btn", "Hochladen")}
                                    </Button>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                hidden
                                onChange={handleFileSelection}
                                disabled={isUploading}
                                aria-label={t("components.contextmanagerdialog.select_label", "Dateien auswählen")}
                            />
                        </div>
                        {hasStoredDocuments && (
                            <div className={styles.listActions}>
                                <Button
                                    className={styles.clearAllButton}
                                    appearance="transparent"
                                    size="small"
                                    onClick={handleClearStoredDocuments}
                                    disabled={isUploading}
                                    aria-label={t("components.contextmanagerdialog.clear_saved", "Alle gespeicherten Dokumente löschen")}
                                >
                                    {t("components.contextmanagerdialog.clear_saved", "Alle löschen")}
                                </Button>
                            </div>
                        )}
                        <div className={styles.fileList}>{storedDocumentsList}</div>
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
