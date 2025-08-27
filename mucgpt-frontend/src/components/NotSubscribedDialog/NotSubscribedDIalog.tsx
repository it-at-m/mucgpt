import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Text } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { Info24Regular, People24Regular, ErrorCircle24Regular } from "@fluentui/react-icons";
import styles from "./NotSubscribedDialog.module.css";

interface NotSubscribedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    hasAccess: boolean;
    assistantTitle?: string;
    onSubscribe?: () => void;
}

export const NotSubscribedDialog = ({ open, onOpenChange, hasAccess, assistantTitle = "Assistent", onSubscribe }: NotSubscribedDialogProps) => {
    const { t } = useTranslation();

    const handleSubscribe = () => {
        if (onSubscribe) {
            onSubscribe();
        }
        onOpenChange(false);
    };

    const handleClose = () => {
        onOpenChange(false);
        window.location.href = "/"; // Redirect to home page
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)} modalType="alert">
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        {hasAccess ? (
                            <>
                                <People24Regular className={styles.icon} />
                                {t("components.not_subscribed_dialog.subscribe_title")}
                            </>
                        ) : (
                            <>
                                <ErrorCircle24Regular className={styles.icon} />
                                {t("components.not_subscribed_dialog.no_access_title")}
                            </>
                        )}
                    </DialogTitle>
                    <DialogContent>
                        {hasAccess ? (
                            <div className={styles.content}>
                                <Text>{t("components.not_subscribed_dialog.subscribe_message", { assistantTitle })}</Text>
                                <div className={styles.infoSection}>
                                    <Info24Regular className={styles.infoIcon} />
                                    <Text size={200} className={styles.infoText}>
                                        {t("components.not_subscribed_dialog.subscribe_info")}
                                    </Text>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.content}>
                                <Text>{t("components.not_subscribed_dialog.no_access_message", { assistantTitle })}</Text>
                                <div className={styles.infoSection}>
                                    <Info24Regular className={styles.infoIcon} />
                                    <Text size={200} className={styles.infoText}>
                                        {t("components.not_subscribed_dialog.no_access_info")}
                                    </Text>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {hasAccess ? (
                            <>
                                <Button appearance="secondary" onClick={handleClose}>
                                    {t("common.cancel")}
                                </Button>
                                <Button appearance="primary" onClick={handleSubscribe}>
                                    {t("components.not_subscribed_dialog.subscribe_button")}
                                </Button>
                            </>
                        ) : (
                            <Button appearance="primary" onClick={handleClose}>
                                {t("common.ok")}
                            </Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};

export default NotSubscribedDialog;
