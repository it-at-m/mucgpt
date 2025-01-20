import { Checkmark24Filled, Dismiss24Regular } from "@fluentui/react-icons";
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

import styles from "./PublishBotDialog.module.css";
import { useTranslation } from "react-i18next";

interface Props {
    showDialog: boolean;
    setShowDialog: (showDialog: boolean) => void;
    isFirstTime: boolean;
    publishBot: () => void;
}

export const PublishBotDialog = ({ showDialog, setShowDialog, isFirstTime, publishBot }: Props) => {

    const { t } = useTranslation();

    const onCancelButtonClicked = () => {
        setShowDialog(false);
    };


    return (
        <div>
            {isFirstTime ?
                <Dialog modalType="alert" defaultOpen={false} open={showDialog}>
                    <DialogSurface className={styles.dialog}>
                        <DialogBody className={styles.dialogContent}>
                            <DialogTitle>{t('components.publishDialog.title')}</DialogTitle>
                            <DialogContent>
                                <p dangerouslySetInnerHTML={{ __html: t('components.publishDialog.content') }} />
                                <strong>{t('components.publishDialog.confirm')}</strong>

                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                                        <Dismiss24Regular /> {t('components.publishDialog.cancel')}
                                    </Button>
                                </DialogTrigger>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" onClick={() => { setShowDialog(false); publishBot(); }}>
                                        <Checkmark24Filled /> {t('components.publishDialog.publish')}
                                    </Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog> :
                <Dialog modalType="alert" defaultOpen={false} open={showDialog}>
                    <DialogSurface className={styles.dialog}>
                        <DialogBody className={styles.dialogContent}>
                            <DialogContent>
                                <p>{t('components.publishDialog.updated')}</p>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                                        <Checkmark24Filled /> {t('components.publishDialog.understood')}
                                    </Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            }
        </div>

    );
};
