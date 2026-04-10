import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Field,
    Text,
    Tooltip,
    Spinner
} from "@fluentui/react-components";
import { Dismiss16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { uploadFileApi } from "../../api/core-client";
import {
    clearStoredParsedDocuments,
    getStoredParsedDocuments,
    removeStoredParsedDocument,
    StoredParsedDocument,
    upsertParsedDocumentFromUpload
} from "../../service/parsedDocumentStorage";

import styles from "./ContextManagerDialog.module.css";

function SectionCard({
    title,
    children,
    className,
    hideTitle,
    id
}: {
    title: string;
    children: ReactNode;
    className?: string;
    hideTitle?: boolean;
    id?: string;
}) {
    const sectionClassName = [styles.sectionCard, className].filter(Boolean).join(" ");
    return (
        <div className={sectionClassName} id={id}>
            {!hideTitle && <h3 className={styles.sectionTitle}>{title}</h3>}
            <div className={styles.sectionContent}>{children}</div>
        </div>
    );
}

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [storedDocuments, setStoredDocuments] = useState<StoredParsedDocument[]>([]);
    const [selectedStoredDocumentIds, setSelectedStoredDocumentIds] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);

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
        (selectedIds: string[], documents: StoredParsedDocument[]) => {
            const selectedData = documents.filter(document => selectedIds.includes(document.id)).map(toUploadedData);
            onDataChange(selectedData);
        },
        [onDataChange, toUploadedData]
    );

    useEffect(() => {
        if (open) {
            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);
            const selectedIds = data.map(d => d.storedDocumentId).filter((id): id is string => Boolean(id));
            setSelectedStoredDocumentIds(selectedIds);
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
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) {
                return;
            }

            setIsUploading(true);
            const newlyStoredIds: string[] = [];
            const knownSignatures = new Set(storedDocuments.map(doc => doc.fileSignature));

            for (const file of files) {
                const signature = getFileSignature(file);
                if (knownSignatures.has(signature)) {
                    continue;
                }
                try {
                    const fileContent = await uploadFileApi(file);
                    const storedDocument = upsertParsedDocumentFromUpload(file, fileContent);
                    if (storedDocument?.id) {
                        newlyStoredIds.push(storedDocument.id);
                    }
                    knownSignatures.add(signature);
                } catch (error) {
                    console.error("Failed to upload data:", error);
                }
            }

            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);

            if (newlyStoredIds.length > 0) {
                const nextSelectedIds = Array.from(new Set([...selectedStoredDocumentIds, ...newlyStoredIds]));
                setSelectedStoredDocumentIds(nextSelectedIds);
                syncSelectionToData(nextSelectedIds, docs);
            }

            setIsUploading(false);

            if (event.target) {
                event.target.value = "";
            }
        },
        [storedDocuments, selectedStoredDocumentIds, syncSelectionToData]
    );

    const handleCancel = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const handleToggleStoredDocument = useCallback(
        (documentId: string, checked: boolean) => {
            const nextSelectedIds = checked
                ? Array.from(new Set([...selectedStoredDocumentIds, documentId]))
                : selectedStoredDocumentIds.filter(id => id !== documentId);
            setSelectedStoredDocumentIds(nextSelectedIds);
            syncSelectionToData(nextSelectedIds, storedDocuments);
        },
        [selectedStoredDocumentIds, storedDocuments, syncSelectionToData]
    );

    const handleRemoveStoredDocument = useCallback(
        (id: string) => {
            removeStoredParsedDocument(id);
            const docs = getStoredParsedDocuments();
            setStoredDocuments(docs);
            const nextSelectedIds = selectedStoredDocumentIds.filter(selectedId => selectedId !== id);
            setSelectedStoredDocumentIds(nextSelectedIds);
            syncSelectionToData(nextSelectedIds, docs);
        },
        [selectedStoredDocumentIds, syncSelectionToData]
    );

    const handleClearStoredDocuments = useCallback(() => {
        clearStoredParsedDocuments();
        setStoredDocuments([]);
        setSelectedStoredDocumentIds([]);
        onDataChange([]);
    }, [onDataChange]);

    const handleDownloadParsedContent = useCallback((doc: StoredParsedDocument) => {
        if (!doc.content) return;
        const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `${doc.name}.txt`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    const storedDocumentsList = useMemo(() => {
        if (storedDocuments.length === 0) {
            return (
                <Text className={styles.emptyState} role="note">
                    {t("components.contextmanagerdialog.no_saved", "Noch keine gespeicherten Dokumente.")}
                </Text>
            );
        }

        return storedDocuments.map(document => {
            const isAttached = selectedStoredDocumentIds.includes(document.id);
            return (
                <div key={document.id} className={styles.fileItem}>
                    <div className={styles.fileSelector}>
                        <Checkbox
                            checked={isAttached}
                            onChange={(_, data) => handleToggleStoredDocument(document.id, data.checked === true)}
                            aria-label={t("components.contextmanagerdialog.use", "Verwenden")}
                        />
                    </div>
                    <div className={styles.fileMeta}>
                        <span className={styles.fileName}>{document.name}</span>
                        <span className={styles.fileSize}>{formatFileSize(document.size)}</span>
                        <span className={styles.fileSecondary}>
                            {t("components.contextmanagerdialog.parsed_at", "Geparsed")}: {formatParsedAt(document.parsedAt)}
                        </span>
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
                        <Tooltip content={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")} relationship="description">
                            <Button
                                appearance="subtle"
                                size="small"
                                icon={<Dismiss16Regular />}
                                onClick={() => handleRemoveStoredDocument(document.id)}
                                aria-label={t("components.contextmanagerdialog.remove_saved", "Gespeichertes Dokument entfernen")}
                            />
                        </Tooltip>
                    </div>
                </div>
            );
        });
    }, [formatParsedAt, handleDownloadParsedContent, handleRemoveStoredDocument, handleToggleStoredDocument, selectedStoredDocumentIds, storedDocuments, t]);

    return (
        <Dialog open={open} onOpenChange={onDialogOpenChange} modalType="modal">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{t("components.contextmanagerdialog.title", "Kontextmanager")}</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <SectionCard title={t("components.contextmanagerdialog.upload_section_title", "Dokumente hochladen")}>
                            <Text className={styles.description}>
                                {t(
                                    "components.contextmanagerdialog.upload_description",
                                    "Lade neue Dokumente hoch oder wähle bereits hochgeladene Dokumente aus."
                                )}
                            </Text>
                            <Field
                                label={t("components.contextmanagerdialog.select_label", "Dateien auswählen")}
                                hint={t("components.contextmanagerdialog.select_hint", "Mehrere Dateien sind möglich.")}
                                className={styles.field}
                            >
                                {isUploading ? (
                                    <div className={styles.spinnerContainer}>
                                        <Spinner label={t("components.contextmanagerdialog.uploading", "Wird hochgeladen...")} size="medium" />
                                    </div>
                                ) : (
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className={styles.fileInput}
                                        onChange={handleFileSelection}
                                        disabled={isUploading}
                                        aria-label={t("components.contextmanagerdialog.select_label", "Dateien auswählen")}
                                    />
                                )}
                            </Field>
                        </SectionCard>
                        <SectionCard title={t("components.contextmanagerdialog.saved_label", "Bereits hochgeladene Dokumente")} className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <Text weight="semibold" as="span" className={styles.sectionCount}>
                                    {t("components.contextmanagerdialog.saved_count", "Anzahl: ")}
                                    {storedDocuments.length}
                                </Text>
                                <Button
                                    appearance="transparent"
                                    size="small"
                                    onClick={handleClearStoredDocuments}
                                    disabled={!hasStoredDocuments || isUploading}
                                    aria-label={t("components.contextmanagerdialog.clear_saved", "Alle gespeicherten Dokumente löschen")}
                                >
                                    {t("components.contextmanagerdialog.clear_saved", "Alle löschen")}
                                </Button>
                            </div>
                            <div className={styles.fileList}>{storedDocumentsList}</div>
                        </SectionCard>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={handleCancel}>
                            {t("components.contextmanagerdialog.close", "Schließen")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
