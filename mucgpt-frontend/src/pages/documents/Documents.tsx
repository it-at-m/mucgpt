import { useCallback, useEffect, useRef, useState } from "react";
import {
    Body1,
    Caption1,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    MessageBar,
    MessageBarActions,
    MessageBarBody,
    Subtitle2,
    Text,
    Title2,
    Title3,
    mergeClasses
} from "@fluentui/react-components";
import { ArrowClockwise16Regular, ArrowUpload20Regular, ArrowUpload32Regular, Dismiss20Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { deleteDocumentApi, listDocumentsApi, uploadDocumentApi } from "../../api/documents-client";
import type { DocumentLibraryEntry } from "../../api/models";
import { DOCUMENT_LIBRARY_LIMIT } from "../../components/ChatDocuments/documentSelection";
import { getUploadErrorKey } from "../../components/ChatDocuments/uploadErrors";
import { useFileDropZone } from "../../components/ChatDocuments/useFileDropZone";
import { useFilePicker } from "../../components/ChatDocuments/useFilePicker";
import { EdelweissSpinner } from "../../components/EdelweissSpinner";
import { useConfigContext } from "../../context/ConfigContext";
import { getStoredParsedDocuments, removeStoredParsedDocument, type StoredParsedDocument } from "../../service/parsedDocumentStorage";
import { Button } from "../../ui/Button";
import { toIntlLocale } from "../../utils/locale";
import { LegacyDocumentRow, LibraryDocumentRow, UploadRow, type PendingUpload } from "./DocumentRows";
import styles from "./Documents.module.css";

const Documents = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { document_processing_enabled: isDocumentProcessingEnabled } = useConfigContext();
    const [documents, setDocuments] = useState<DocumentLibraryEntry[] | null>(null);
    const [hasLoadError, setHasLoadError] = useState(false);
    const [uploads, setUploads] = useState<PendingUpload[]>([]);
    const [actionError, setActionError] = useState<string>();
    const [documentToDelete, setDocumentToDelete] = useState<DocumentLibraryEntry | null>(null);
    const [busyIds, setBusyIds] = useState<string[]>([]);
    const [legacyDocuments, setLegacyDocuments] = useState<StoredParsedDocument[]>(getStoredParsedDocuments);

    const loadRequestIdRef = useRef(0);

    // Parallel uploads each reload the list; only the latest request reflects every finished upload.
    const loadDocuments = useCallback(async () => {
        const requestId = ++loadRequestIdRef.current;
        try {
            const nextDocuments = await listDocumentsApi();
            if (requestId !== loadRequestIdRef.current) return;
            setDocuments(nextDocuments);
            setHasLoadError(false);
            setUploads(current => current.filter(upload => !upload.documentId || !nextDocuments.some(document => document.id === upload.documentId)));
        } catch (error) {
            if (requestId !== loadRequestIdRef.current) return;
            console.error("Failed to load the document library:", error);
            setHasLoadError(true);
        }
    }, []);

    useEffect(() => {
        if (isDocumentProcessingEnabled) void loadDocuments();
    }, [isDocumentProcessingEnabled, loadDocuments]);

    const runUpload = useCallback(
        async (upload: PendingUpload) => {
            try {
                const document = await uploadDocumentApi(upload.file);
                // The row stays until the reloaded list contains the document, so it never disappears in between.
                setUploads(current => current.map(entry => (entry.id === upload.id ? { ...entry, documentId: document.id } : entry)));
            } catch (error) {
                console.error("Failed to upload document:", error);
                setUploads(current => current.map(entry => (entry.id === upload.id ? { ...entry, errorMessage: t(getUploadErrorKey(error)) } : entry)));
            }
            await loadDocuments();
        },
        [loadDocuments, t]
    );

    const uploadFiles = useCallback(
        (files: File[]) => {
            const newUploads = files.map(file => ({ id: crypto.randomUUID(), file }));
            setUploads(current => [...current, ...newUploads]);
            newUploads.forEach(upload => void runUpload(upload));
        },
        [runUpload]
    );

    const retryUpload = (upload: PendingUpload) => {
        const retried = { ...upload, errorMessage: undefined };
        setUploads(current => current.map(entry => (entry.id === upload.id ? retried : entry)));
        void runUpload(retried);
    };

    const removeUpload = (upload: PendingUpload) => setUploads(current => current.filter(entry => entry.id !== upload.id));

    const { openFilePicker, inputProps: fileInputProps } = useFilePicker(uploadFiles);

    const withBusy = async (id: string, action: () => Promise<void>) => {
        setBusyIds(current => [...current, id]);
        try {
            await action();
        } finally {
            setBusyIds(current => current.filter(busyId => busyId !== id));
        }
    };

    const deleteDocument = (document: DocumentLibraryEntry) => {
        setActionError(undefined);
        return withBusy(document.id, async () => {
            try {
                await deleteDocumentApi(document.id);
            } catch (error) {
                console.error("Failed to delete document:", error);
                setActionError(t("document_library.error"));
            }
            await loadDocuments();
        });
    };

    const migrateLegacyDocument = (document: StoredParsedDocument) => {
        setActionError(undefined);
        return withBusy(document.id, async () => {
            // Only the extracted text was kept in the browser, so it is stored as a text file.
            const filename = document.name.toLowerCase().endsWith(".txt") ? document.name : `${document.name}.txt`;
            try {
                await uploadDocumentApi(new File([document.content], filename, { type: "text/plain" }));
                removeStoredParsedDocument(document.id);
                setLegacyDocuments(getStoredParsedDocuments());
            } catch (error) {
                console.error("Failed to move the browser document to the library:", error);
                setActionError(t("document_library.upload_failed_named", { name: document.name, reason: t(getUploadErrorKey(error)) }));
            }
            await loadDocuments();
        });
    };

    const deleteLegacyDocument = (document: StoredParsedDocument) => {
        removeStoredParsedDocument(document.id);
        setLegacyDocuments(getStoredParsedDocuments());
    };

    const activeUploadCount = uploads.filter(upload => !upload.errorMessage).length;
    const usedSlots = (documents?.length ?? 0) + activeUploadCount;
    const isLibraryFull = documents !== null && usedSlots >= DOCUMENT_LIBRARY_LIMIT;
    const canUpload = isDocumentProcessingEnabled && documents !== null && !isLibraryFull;
    const { isDragActive, dropZoneProps } = useFileDropZone(uploadFiles, canUpload);
    const usage = { used: documents?.length ?? 0, limit: DOCUMENT_LIBRARY_LIMIT };
    const dateFormatter = new Intl.DateTimeFormat(toIntlLocale(i18n.resolvedLanguage || i18n.language), { dateStyle: "medium" });
    const formatDate = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
    };
    const isEmpty = documents?.length === 0 && uploads.length === 0;

    if (!isDocumentProcessingEnabled) {
        return (
            <main className={styles.page}>
                <div className={styles.content}>
                    <MessageBar intent="warning">
                        <MessageBarBody>{t("document_library.upload_error_disabled")}</MessageBarBody>
                    </MessageBar>
                </div>
            </main>
        );
    }

    return (
        <main className={styles.page} {...dropZoneProps}>
            <div className={mergeClasses(styles.content, isDragActive && !isEmpty && styles.dragActive)}>
                <header className={styles.header}>
                    <Title2 as="h1" className={styles.title}>
                        {t("document_library.page_title")}
                    </Title2>
                    {documents !== null && !isEmpty && (
                        <div className={styles.headerActions}>
                            <Text className={styles.quota}>{t("document_library.quota", usage)}</Text>
                            <Button appearance="primary" icon={<ArrowUpload20Regular />} disabled={!canUpload} onClick={openFilePicker}>
                                {t("document_library.upload")}
                            </Button>
                        </div>
                    )}
                    <input {...fileInputProps} aria-label={t("document_library.upload")} />
                </header>

                {isLibraryFull && (
                    <MessageBar intent="warning" className={styles.message}>
                        <MessageBarBody>{t("document_library.library_full", usage)}</MessageBarBody>
                    </MessageBar>
                )}
                {actionError && (
                    <MessageBar intent="error" className={styles.message}>
                        <MessageBarBody>{actionError}</MessageBarBody>
                        <MessageBarActions
                            containerAction={
                                <Button
                                    appearance="subtle"
                                    icon={<Dismiss20Regular />}
                                    aria-label={t("document_library.dismiss")}
                                    onClick={() => setActionError(undefined)}
                                />
                            }
                        />
                    </MessageBar>
                )}
                {hasLoadError && (
                    <MessageBar intent="error" className={styles.message}>
                        <MessageBarBody>{t("document_library.error")}</MessageBarBody>
                        <MessageBarActions>
                            <Button icon={<ArrowClockwise16Regular />} onClick={() => void loadDocuments()}>
                                {t("document_library.refresh")}
                            </Button>
                        </MessageBarActions>
                    </MessageBar>
                )}

                {documents === null && !hasLoadError && (
                    <div className={styles.centered}>
                        <EdelweissSpinner size="small" label={t("document_library.menu_loading")} />
                    </div>
                )}

                {isEmpty && (
                    <section className={mergeClasses(styles.emptyState, isDragActive && styles.emptyStateDragActive)}>
                        <span className={styles.emptyIcon} aria-hidden="true">
                            <ArrowUpload32Regular />
                        </span>
                        <Subtitle2 as="h2">{t("document_library.empty_title")}</Subtitle2>
                        <Body1>{t("document_library.empty_message")}</Body1>
                        <Button appearance="primary" icon={<ArrowUpload20Regular />} disabled={!canUpload} onClick={openFilePicker}>
                            {t("document_library.upload")}
                        </Button>
                        {legacyDocuments.length > 0 && <Caption1 className={styles.emptyHint}>{t("document_library.empty_browser_hint")}</Caption1>}
                    </section>
                )}

                {documents !== null && !isEmpty && (
                    <ul className={styles.list} aria-label={t("document_library.page_title")}>
                        {uploads.map(upload => (
                            <UploadRow key={upload.id} upload={upload} onRetry={() => retryUpload(upload)} onRemove={() => removeUpload(upload)} />
                        ))}
                        {documents.map(document => (
                            <LibraryDocumentRow
                                key={document.id}
                                document={document}
                                isBusy={busyIds.includes(document.id)}
                                formatDate={formatDate}
                                onStartChat={() => navigate(`/chat?new=${Date.now()}&documents=${encodeURIComponent(document.id)}`)}
                                onDelete={() => setDocumentToDelete(document)}
                            />
                        ))}
                    </ul>
                )}

                {legacyDocuments.length > 0 && (
                    <section className={styles.legacy} aria-labelledby="legacy-documents-title">
                        <Title3 as="h2" id="legacy-documents-title">
                            {t("document_library.legacy_title")}
                        </Title3>
                        <Body1 className={styles.legacyDescription}>{t("document_library.legacy_description")}</Body1>
                        <ul className={styles.list} aria-labelledby="legacy-documents-title">
                            {legacyDocuments.map(document => (
                                <LegacyDocumentRow
                                    key={document.id}
                                    document={document}
                                    isBusy={busyIds.includes(document.id)}
                                    canMigrate={canUpload}
                                    formatDate={formatDate}
                                    onMigrate={() => void migrateLegacyDocument(document)}
                                    onDelete={() => deleteLegacyDocument(document)}
                                />
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            <Dialog open={documentToDelete !== null} onOpenChange={(_, data) => !data.open && setDocumentToDelete(null)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>{t("document_library.delete_confirm_title")}</DialogTitle>
                        <DialogContent>{t("document_library.delete_confirm_message", { name: documentToDelete?.filename })}</DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setDocumentToDelete(null)}>
                                {t("common.cancel")}
                            </Button>
                            <Button
                                appearance="secondary"
                                tone="danger"
                                onClick={() => {
                                    if (documentToDelete) void deleteDocument(documentToDelete);
                                    setDocumentToDelete(null);
                                }}
                            >
                                {t("document_library.delete_confirm_action")}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </main>
    );
};

export default Documents;
