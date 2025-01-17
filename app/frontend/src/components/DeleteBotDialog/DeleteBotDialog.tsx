import { Delete24Filled, Dismiss24Regular } from "@fluentui/react-icons";
import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
} from "@fluentui/react-components";

import styles from "./DeleteBotDialog.module.css";
import { useTranslation } from "react-i18next";

interface Props {
    showDialog: boolean;
    setShowDialog: (showDialogInput: boolean) => void;
    bot_name: string;
    deleteBot: () => void;
}

export const DeletBotDialog = ({ showDialog, setShowDialog, bot_name, deleteBot }: Props) => {
    const { t } = useTranslation();

    return (
        <Dialog modalType="alert" defaultOpen={false} open={showDialog}>
            <DialogSurface className={styles.dialog}>
                <DialogTitle>{bot_name}</DialogTitle>
                <DialogBody className={styles.dialogContent}>
                    <DialogContent>
                        {t('components.deletebotdialog.confirm')}
                    </DialogContent>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary" size="small" onClick={() => setShowDialog(false)}>
                                <Dismiss24Regular /> {t('components.deletebotdialog.back')}
                            </Button>
                        </DialogTrigger>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary" size="small" onClick={deleteBot}>
                                <Delete24Filled /> {t('components.deletebotdialog.delete')}
                            </Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
