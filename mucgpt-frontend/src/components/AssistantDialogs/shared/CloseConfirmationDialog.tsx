import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions, Button } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

interface CloseConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirmClose: () => void;
    /** Override the dialog title. Defaults to the "close dialog" i18n string. */
    title?: string;
    /** Override the dialog body text. Defaults to the "close dialog" i18n string. */
    message?: string;
    /** Override the confirm button label. Defaults to `common.close`. */
    confirmLabel?: string;
}

export const CloseConfirmationDialog = ({ open, onOpenChange, onConfirmClose, title, message, confirmLabel }: CloseConfirmationDialogProps) => {
    const { t } = useTranslation();

    const handleCancel = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const handleConfirm = useCallback(() => {
        onOpenChange(false);
        onConfirmClose();
    }, [onOpenChange, onConfirmClose]);

    return (
        <Dialog open={open} onOpenChange={(_event, data) => onOpenChange(data.open)} inertTrapFocus>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{title ?? t("components.edit_assistant_dialog.close_dialog_title")}</DialogTitle>
                    <DialogContent>{message ?? t("components.edit_assistant_dialog.close_dialog_message")}</DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={handleCancel}>
                            {t("common.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={handleConfirm}>
                            {confirmLabel ?? t("common.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
