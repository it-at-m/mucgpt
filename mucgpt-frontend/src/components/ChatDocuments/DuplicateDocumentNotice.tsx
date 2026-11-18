import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./DuplicateDocumentNotice.module.css";

interface Props {
    names: string[];
    onUploadAnyway: () => void;
    onDismiss: () => void;
}

/** Name and size only suggest a duplicate, so the user can still insist on a fresh upload. */
export const DuplicateDocumentNotice = ({ names, onUploadAnyway, onDismiss }: Props) => {
    const { t } = useTranslation();

    return (
        <MessageBar intent="info" className={styles.messageBar}>
            <MessageBarBody>
                <MessageBarTitle>{t("document_library.duplicate_title")}</MessageBarTitle>
                {t("document_library.duplicate_message", { names: names.join(", ") })}
            </MessageBarBody>
            <MessageBarActions
                containerAction={<Button appearance="subtle" icon={<Dismiss20Regular />} onClick={onDismiss} aria-label={t("document_library.dismiss")} />}
            >
                <Button onClick={onUploadAnyway}>{t("document_library.duplicate_upload_anyway")}</Button>
            </MessageBarActions>
        </MessageBar>
    );
};
