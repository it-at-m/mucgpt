import { useTranslation } from "react-i18next";

import { CloseConfirmationDialog } from "./CloseConfirmationDialog";

interface PendingCreateDraftConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Confirmed replacing the existing draft with the new prefill. */
    onOverwrite: () => void;
    /** Keeps the existing draft and opens the create-assistant mask with it. */
    onOpenExistingDraft: () => void;
    /** Optional context-specific message; defaults to the generic draft-exists message. */
    message?: string;
}

/** Warns that prefilled assistant data would replace an existing unfinished create-assistant draft. */
export const PendingCreateDraftConfirmDialog = ({ open, onOpenChange, onOverwrite, onOpenExistingDraft, message }: PendingCreateDraftConfirmDialogProps) => {
    const { t } = useTranslation();

    return (
        <CloseConfirmationDialog
            open={open}
            onOpenChange={onOpenChange}
            onConfirmClose={onOverwrite}
            title={t("components.import_assistant.draft_exists_title")}
            message={message ?? t("components.import_assistant.draft_exists_message")}
            confirmLabel={t("components.import_assistant.draft_exists_overwrite")}
            confirmIntent="danger"
            secondaryAction={{ label: t("components.import_assistant.draft_exists_open"), onClick: onOpenExistingDraft }}
        />
    );
};
