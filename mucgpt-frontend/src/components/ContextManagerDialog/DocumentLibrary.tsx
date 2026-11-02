import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Checkbox, MessageBar, MessageBarBody, Text, Tooltip } from "@fluentui/react-components";
import { ArrowClockwise16Regular, ArrowUpload16Regular, Delete16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { deleteDocumentApi, listDocumentsApi, uploadDocumentApi } from "../../api/documents-client";
import type { DocumentLibraryEntry, DocumentMetadata } from "../../api/models";
import type { UploadedData } from "./ContextManagerDialog";
import { EdelweissSpinner } from "../EdelweissSpinner";
import styles from "./ContextManagerDialog.module.css";

export const documentToUploadedData = (document: DocumentMetadata | DocumentLibraryEntry): UploadedData => ({
    id: document.id,
    name: document.filename,
    size: document.original_size,
    status: "ready",
    isActive: true,
    source: "library",
    storedDocumentId: document.id,
    mimeType: document.mime_type,
    parsedAt: document.created_at
});

export const DocumentLibrary = ({ data, onDataChange }: { data: UploadedData[]; onDataChange: (data: UploadedData[]) => void }) => {
    const { t } = useTranslation();
    const fileInput = useRef<HTMLInputElement>(null);
    const [documents, setDocuments] = useState<DocumentLibraryEntry[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();

    const updateLibrary = useCallback(
        async (operation?: () => Promise<unknown>) => {
            setBusy(true);
            setError(undefined);
            try {
                await operation?.();
                setDocuments(await listDocumentsApi());
            } catch (reason) {
                setError(reason instanceof Error ? reason.message : t("document_library.error"));
            } finally {
                setBusy(false);
            }
        },
        [t]
    );

    useEffect(() => {
        void updateLibrary();
    }, [updateLibrary]);

    return (
        <section className={styles.library} aria-label={t("document_library.title")}>
            <Text as="h3" weight="semibold">
                {t("document_library.title")}
            </Text>
            <Text as="p" size={200}>
                {t("document_library.description")}
            </Text>
            <div className={styles.toolbar}>
                <Text aria-live="polite">{documents === null ? "– / 10" : `${documents.length} / 10`}</Text>
                <div className={styles.toolbarActions}>
                    {busy && <EdelweissSpinner size="tiny" label={t("document_library.loading")} labelPosition="after" />}
                    <Tooltip content={t("document_library.refresh")} relationship="label">
                        <Button
                            icon={<ArrowClockwise16Regular />}
                            appearance="subtle"
                            aria-label={t("document_library.refresh")}
                            disabled={busy}
                            onClick={() => void updateLibrary()}
                        />
                    </Tooltip>
                    <Button
                        icon={<ArrowUpload16Regular />}
                        appearance="primary"
                        disabled={busy || documents === null || documents.length >= 10}
                        onClick={() => fileInput.current?.click()}
                    >
                        {t("document_library.upload")}
                    </Button>
                    <input
                        ref={fileInput}
                        type="file"
                        hidden
                        aria-label={t("document_library.upload")}
                        onChange={event => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file)
                                void updateLibrary(async () => {
                                    const document = await uploadDocumentApi(file);
                                    onDataChange([...data, documentToUploadedData(document)]);
                                });
                        }}
                    />
                </div>
            </div>
            {error && (
                <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}
            {documents?.length === 0 && <Text as="p">{t("document_library.empty")}</Text>}
            <div className={styles.fileList}>
                {documents?.map(document => (
                    <div key={document.id} className={styles.fileItem}>
                        <Checkbox
                            checked={data.some(selected => selected.source === "library" && selected.id === document.id && selected.isActive)}
                            disabled={busy || document.status !== "ready"}
                            aria-label={t("document_library.select", { name: document.filename })}
                            onChange={(_, value) =>
                                onDataChange([
                                    ...data.filter(selected => selected.source !== "library" || selected.id !== document.id),
                                    ...(value.checked === true ? [documentToUploadedData(document)] : [])
                                ])
                            }
                        />
                        <div className={styles.fileMeta}>
                            <Text weight="semibold" className={styles.fileName}>
                                {document.filename}
                            </Text>
                            <Text size={200}>{t(`document_library.${document.status}`)}</Text>
                            {document.preview && (
                                <Text size={200} block truncate wrap={false} className={styles.fileSecondary}>
                                    {document.preview}
                                </Text>
                            )}
                        </div>
                        <Tooltip content={t("document_library.delete", { name: document.filename })} relationship="label">
                            <Button
                                icon={<Delete16Regular />}
                                appearance="subtle"
                                disabled={busy || document.status === "processing"}
                                aria-label={t("document_library.delete", { name: document.filename })}
                                onClick={() =>
                                    void updateLibrary(async () => {
                                        await deleteDocumentApi(document.id);
                                        onDataChange(data.filter(selected => selected.source !== "library" || selected.id !== document.id));
                                    })
                                }
                            />
                        </Tooltip>
                    </div>
                ))}
            </div>
        </section>
    );
};
