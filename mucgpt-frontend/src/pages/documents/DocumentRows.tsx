import { Caption1, Tooltip } from "@fluentui/react-components";
import {
    ArrowClockwise16Regular,
    ArrowImport16Regular,
    ChatAdd16Regular,
    Delete16Regular,
    Dismiss16Regular,
    ErrorCircle20Regular
} from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DocumentLibraryEntry } from "../../api/models";
import { DocumentTypeIcon } from "../../components/ChatDocuments/DocumentTypeIcon";
import { formatFileSize, getLibraryStatusKey } from "../../components/ChatDocuments/documentSelection";
import { EdelweissSpinner } from "../../components/EdelweissSpinner";
import type { StoredParsedDocument } from "../../service/parsedDocumentStorage";
import { Button } from "../../ui/Button";
import styles from "./Documents.module.css";

export interface PendingUpload {
    id: string;
    file: File;
    errorMessage?: string;
    /** Set once the upload succeeded; the row is removed when the reloaded list contains this document. */
    documentId?: string;
}

interface DocumentRowProps {
    icon: ReactNode;
    name: string;
    meta: ReactNode;
    /** Announces changing meta text, e.g. upload progress or errors. */
    metaRole?: "status" | "alert";
    status?: "uploading" | "error";
    actions?: ReactNode;
}

const DocumentRow = ({ icon, name, meta, metaRole, status, actions }: DocumentRowProps) => (
    <li className={styles.row} data-status={status}>
        <span className={styles.rowIcon} aria-hidden="true">
            {icon}
        </span>
        <div className={styles.rowCopy}>
            <span className={styles.rowName}>{name}</span>
            <Caption1 className={styles.rowMeta} role={metaRole}>
                {meta}
            </Caption1>
        </div>
        {actions && <div className={styles.rowActions}>{actions}</div>}
    </li>
);

const joinMeta = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");

interface UploadRowProps {
    upload: PendingUpload;
    onRetry: () => void;
    onRemove: () => void;
}

export const UploadRow = ({ upload, onRetry, onRemove }: UploadRowProps) => {
    const { t } = useTranslation();
    const name = upload.file.name;
    const hasFailed = upload.errorMessage !== undefined;

    return (
        <DocumentRow
            icon={hasFailed ? <ErrorCircle20Regular /> : <EdelweissSpinner size="tiny" labelPosition="after" />}
            name={name}
            meta={upload.errorMessage ?? t("document_library.loading")}
            metaRole={hasFailed ? "alert" : "status"}
            status={hasFailed ? "error" : "uploading"}
            actions={
                hasFailed && (
                    <>
                        <Tooltip content={t("document_library.retry_upload", { name })} relationship="label">
                            <Button appearance="subtle" icon={<ArrowClockwise16Regular />} onClick={onRetry} />
                        </Tooltip>
                        <Tooltip content={t("document_library.remove", { name })} relationship="label">
                            <Button appearance="subtle" icon={<Dismiss16Regular />} onClick={onRemove} />
                        </Tooltip>
                    </>
                )
            }
        />
    );
};

interface LibraryDocumentRowProps {
    document: DocumentLibraryEntry;
    isBusy: boolean;
    formatDate: (value: string) => string;
    onStartChat: () => void;
    onDelete: () => void;
}

export const LibraryDocumentRow = ({ document, isBusy, formatDate, onStartChat, onDelete }: LibraryDocumentRowProps) => {
    const { t } = useTranslation();
    const statusKey = getLibraryStatusKey(document.status);

    return (
        <DocumentRow
            icon={<DocumentTypeIcon filename={document.filename} size={20} />}
            name={document.filename}
            meta={joinMeta([formatDate(document.created_at), formatFileSize(document.original_size), statusKey && t(statusKey)])}
            actions={
                <>
                    {document.status === "ready" && (
                        <Button
                            appearance="subtle"
                            icon={<ChatAdd16Regular />}
                            aria-label={t("document_library.new_chat_aria", { name: document.filename })}
                            onClick={onStartChat}
                        >
                            {t("document_library.new_chat")}
                        </Button>
                    )}
                    <Tooltip content={t("document_library.delete", { name: document.filename })} relationship="label">
                        <Button appearance="subtle" icon={<Delete16Regular />} disabled={isBusy} onClick={onDelete} />
                    </Tooltip>
                </>
            }
        />
    );
};

interface LegacyDocumentRowProps {
    document: StoredParsedDocument;
    isBusy: boolean;
    canMigrate: boolean;
    formatDate: (value: string) => string;
    onMigrate: () => void;
    onDelete: () => void;
}

export const LegacyDocumentRow = ({ document, isBusy, canMigrate, formatDate, onMigrate, onDelete }: LegacyDocumentRowProps) => {
    const { t } = useTranslation();

    return (
        <DocumentRow
            icon={isBusy ? <EdelweissSpinner size="tiny" labelPosition="after" /> : <DocumentTypeIcon filename={document.name} size={20} />}
            name={document.name}
            meta={joinMeta([formatDate(document.parsedAt), formatFileSize(document.size)])}
            actions={
                <>
                    <Button
                        icon={<ArrowImport16Regular />}
                        aria-label={t("document_library.legacy_migrate_aria", { name: document.name })}
                        disabled={isBusy || !canMigrate}
                        onClick={onMigrate}
                    >
                        {t("document_library.legacy_migrate")}
                    </Button>
                    <Tooltip content={t("document_library.legacy_delete", { name: document.name })} relationship="label">
                        <Button appearance="subtle" icon={<Delete16Regular />} disabled={isBusy} onClick={onDelete} />
                    </Tooltip>
                </>
            }
        />
    );
};
