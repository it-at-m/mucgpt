import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Text, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, DocumentAdd24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { uploadFileApi } from "../../api/data-client";

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
    fileId?: string; // UUID from the doc service
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

export const DataUploadDialog = ({ open, onOpenChange, data, onDataChange }: DataUploadDialogProps) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [pendingData, setPendingData] = useState<UploadedData[]>([]);
    const dataRef = useRef<UploadedData[]>(data);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        if (!open) {
            setPendingData([]);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, [open]);

    const hasPendingData = pendingData.length > 0;

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
                .then(fileId => {
                    const current = dataRef.current;
                    const updated = current.map(d => (d.id === data.id ? { ...d, status: "ready" as UploadedDataStatus, fileId } : d));
                    onDataChange(updated);
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
    }, [pendingData, data, onDataChange, onOpenChange]);

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
                        <Button appearance="primary" onClick={handleConfirm} disabled={!hasPendingData}>
                            {t("components.questioninput.upload_dialog_confirm", "Hinzufügen")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};