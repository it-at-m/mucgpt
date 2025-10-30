import { useTranslation } from "react-i18next";
import { Button, Tooltip, Spinner } from "@fluentui/react-components";
import { Checkmark24Regular, Dismiss16Regular, ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { UploadedDocument } from "../DocumentUploadDialog/DocumentUploadDialog";

interface UploadedDocumentsProps {
    documents: UploadedDocument[];
    onToggle: (documentId: string) => void;
    onRemove: (documentId: string) => void;
}

export const UploadedDocuments = ({ documents, onToggle, onRemove }: UploadedDocumentsProps) => {
    const { t } = useTranslation();

    if (documents.length === 0) {
        return null;
    }

    return (
        <div className={styles.toolBadgesHeader}>
            <span className={styles.toolBadgesLabel}>{t("components.questioninput.uploaded_documents_label", "Hinzugefügte Dokumente")}</span>
            {documents.map(document => {
                const isActive = document.isActive !== false;
                const isUploading = document.status === "uploading";
                const hasError = document.status === "error";
                const isReady = document.status === "ready";

                let icon = isActive && isReady ? <Checkmark24Regular /> : undefined;
                if (isUploading) {
                    icon = <Spinner size="tiny" />;
                }
                if (hasError) {
                    icon = <ErrorCircle24Regular />;
                }

                const buttonAppearance = hasError ? "secondary" : isActive ? "primary" : "secondary";
                const tooltipContent = hasError
                    ? document.errorMessage || t("components.questioninput.upload_error", "Upload fehlgeschlagen")
                    : isUploading
                      ? t("components.questioninput.uploading", "Wird hochgeladen...")
                      : document.name;

                return (
                    <div key={document.id} className={styles.toolButtonWrapper}>
                        <Tooltip content={tooltipContent} relationship="label">
                            <Button
                                appearance={buttonAppearance}
                                size="medium"
                                className={styles.toolButton}
                                onClick={() => !isUploading && onToggle(document.id)}
                                aria-pressed={isActive}
                                icon={icon}
                                disabled={isUploading}
                            >
                                {document.name}
                            </Button>
                        </Tooltip>
                        <Tooltip content={t("components.questioninput.remove_document", "Dokument entfernen")} relationship="label">
                            <button
                                className={styles.toolHelpButton}
                                onClick={() => onRemove(document.id)}
                                aria-label={t("components.questioninput.remove_document", "Dokument entfernen")}
                                disabled={isUploading}
                            >
                                <Dismiss16Regular />
                            </button>
                        </Tooltip>
                    </div>
                );
            })}
        </div>
    );
};
