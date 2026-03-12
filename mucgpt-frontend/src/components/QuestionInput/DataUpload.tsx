import { useTranslation } from "react-i18next";
import { Button, Tooltip, Spinner } from "@fluentui/react-components";
import { Checkmark24Regular, Dismiss16Regular, ErrorCircle24Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { UploadedData } from "../DataUploadDialog/DataUploadDialog";

interface DataUploadProps {
    data: UploadedData[];
    onToggle: (dataId: string) => void;
    onRemove: (dataId: string) => void;
}

export const DataUpload = ({ data, onToggle, onRemove }: DataUploadProps) => {
    const { t } = useTranslation();

    if (data.length === 0) {
        return null;
    }

    return (
        <div className={styles.toolBadgesHeader}>
            <span className={styles.toolBadgesLabel}>{t("components.questioninput.uploaded_data_label", "Hinzugefügte Dokumente")}</span>
            {data.map(d => {
                const isActive = d.isActive !== false;
                const isUploading = d.status === "uploading";
                const hasError = d.status === "error";
                const isReady = d.status === "ready";

                let icon = isActive && isReady ? <Checkmark24Regular /> : undefined;
                if (isUploading) {
                    icon = <Spinner size="tiny" />;
                }
                if (hasError) {
                    icon = <ErrorCircle24Regular />;
                }

                const buttonAppearance = hasError ? "secondary" : isActive ? "primary" : "secondary";
                const tooltipContent = hasError
                    ? d.errorMessage || t("components.questioninput.upload_error", "Upload fehlgeschlagen")
                    : isUploading
                        ? t("components.questioninput.uploading", "Wird hochgeladen...")
                        : d.name;

                return (
                    <div key={d.id} className={styles.toolButtonWrapper}>
                        <Tooltip content={tooltipContent} relationship="label">
                            <Button
                                appearance={buttonAppearance}
                                size="medium"
                                className={styles.toolButton}
                                onClick={() => !isUploading && onToggle(d.id)}
                                aria-pressed={isActive}
                                icon={icon}
                                disabled={isUploading}
                            >
                                {d.name}
                            </Button>
                        </Tooltip>
                        <Tooltip content={t("components.questioninput.remove_data", "Dokument entfernen")} relationship="label">
                            <button
                                className={styles.toolHelpButton}
                                onClick={() => onRemove(d.id)}
                                aria-label={t("components.questioninput.remove_data", "Dokument entfernen")}
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