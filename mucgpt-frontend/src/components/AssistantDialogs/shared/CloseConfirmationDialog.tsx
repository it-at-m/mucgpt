import { Dialog, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions, Button } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import styles from "./CloseConfirmationDialog.module.css";

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
    /** Disable the confirm button (e.g. while an action is in flight). */
    confirmDisabled?: boolean;
    /** Render the confirm action with destructive styling. */
    confirmIntent?: "default" | "danger";
}

export const CloseConfirmationDialog = ({
    open,
    onOpenChange,
    onConfirmClose,
    title,
    message,
    confirmLabel,
    confirmDisabled,
    confirmIntent = "default"
}: CloseConfirmationDialogProps) => {
    const { t } = useTranslation();

    const handleCancel = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const handleConfirm = useCallback(() => {
        if (confirmDisabled) {
            return;
        }

        onOpenChange(false);
        onConfirmClose();
    }, [confirmDisabled, onOpenChange, onConfirmClose]);

    return (
        <Dialog open={open} onOpenChange={(_event, data) => onOpenChange(data.open)} inertTrapFocus>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{title ?? t("components.assistant_editor.discard_title")}</DialogTitle>
                    <DialogContent>{message ?? t("components.assistant_editor.discard_message")}</DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={handleCancel}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            appearance="primary"
                            onClick={handleConfirm}
                            disabled={confirmDisabled}
                            className={confirmIntent === "danger" ? styles.dangerConfirmButton : undefined}
                        >
                            {confirmLabel ?? t("common.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
