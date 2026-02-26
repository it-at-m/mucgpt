import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions, Button } from "@fluentui/react-components";
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
                <DialogBody>
                    <DialogTitle>{t("components.edit_assistant_dialog.close_dialog_title")}</DialogTitle>
                    <DialogContent>{t("components.edit_assistant_dialog.close_dialog_message")}</DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={handleCancel}>
                            {t("common.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={handleConfirm}>
                            {t("common.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
