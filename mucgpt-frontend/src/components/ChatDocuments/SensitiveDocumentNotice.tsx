import { Button, MessageBar, MessageBarActions, MessageBarBody, MessageBarTitle } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

import type { SensitivityFinding } from "../../api/models";
import styles from "./SensitiveDocumentNotice.module.css";
import { describeFindings } from "./sensitivity";

interface Props {
    documents: { id: string; name: string; sensitiveFindings?: SensitivityFinding[] }[];
    isConfirming: boolean;
    hasFailed: boolean;
    onConfirm: () => void;
    onRemove: () => void;
}

/**
 * Asks once per document before likely personal data or secrets are sent to the model.
 * There is no dismiss action: the turn stays blocked until the user decides.
 */
export const SensitiveDocumentNotice = ({ documents, isConfirming, hasFailed, onConfirm, onRemove }: Props) => {
    const { t } = useTranslation();

    return (
        <MessageBar intent="warning" layout="multiline" className={styles.messageBar}>
            <MessageBarBody>
                <MessageBarTitle>{t("document_library.sensitivity_title")}</MessageBarTitle>
                {t("document_library.sensitivity_message")}
                <ul className={styles.list}>
                    {documents.map(document => (
                        <li key={document.id}>
                            <span className={styles.name}>{document.name}</span>: {describeFindings(document.sensitiveFindings ?? [], t)}
                        </li>
                    ))}
                </ul>
                {hasFailed && <span role="alert">{t("document_library.sensitivity_confirm_failed")}</span>}
            </MessageBarBody>
            <MessageBarActions>
                <Button onClick={onConfirm} disabled={isConfirming}>
                    {t("document_library.sensitivity_confirm")}
                </Button>
                <Button appearance="subtle" onClick={onRemove} disabled={isConfirming}>
                    {t("document_library.sensitivity_remove")}
                </Button>
            </MessageBarActions>
        </MessageBar>
    );
};
