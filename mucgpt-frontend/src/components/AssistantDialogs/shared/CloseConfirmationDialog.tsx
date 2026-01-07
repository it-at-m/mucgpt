import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Button } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";

interface CloseConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirmClose: () => void;
}

export const CloseConfirmationDialog = ({ open, onOpenChange, onConfirmClose }: CloseConfirmationDialogProps) => {
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
                <DialogTitle>{t("components.edit_assistant_dialog.close_dialog_title")}</DialogTitle>
                <DialogBody>{t("components.edit_assistant_dialog.close_dialog_message")}</DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={handleCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button appearance="primary" onClick={handleConfirm}>
                        {t("common.close")}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    );
};
