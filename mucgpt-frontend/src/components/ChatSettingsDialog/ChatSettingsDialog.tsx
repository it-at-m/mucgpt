import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, Button } from "@fluentui/react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatSettingsContent } from "../ChatsettingsDrawer/ChatSettingsContent";
import styles from "./ChatSettingsDialog.module.css";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creativity: string;
    setCreativity: (creativity: string) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
}

export const ChatSettingsDialog = ({ open, onOpenChange, creativity, setCreativity, systemPrompt, setSystemPrompt }: Props) => {
    const { t } = useTranslation();
    const wasOpenRef = useRef(open);
    const [initialValues, setInitialValues] = useState({ creativity, systemPrompt });
    const [draftValues, setDraftValues] = useState({ creativity, systemPrompt });

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            const nextValues = { creativity, systemPrompt };
            setInitialValues(nextValues);
            setDraftValues(nextValues);
        }
        wasOpenRef.current = open;
    }, [open, creativity, systemPrompt]);

    const hasChanges = useMemo(
        () => draftValues.creativity !== initialValues.creativity || draftValues.systemPrompt !== initialValues.systemPrompt,
        [draftValues, initialValues]
    );

    const setDraftCreativity = useCallback((nextCreativity: string) => {
        setDraftValues(current => ({ ...current, creativity: nextCreativity }));
    }, []);

    const setDraftSystemPrompt = useCallback((nextSystemPrompt: string) => {
        setDraftValues(current => ({ ...current, systemPrompt: nextSystemPrompt }));
    }, []);

    const cancelChanges = useCallback(() => {
        setDraftValues(initialValues);
        onOpenChange(false);
    }, [initialValues, onOpenChange]);

    const saveChanges = useCallback(() => {
        setCreativity(draftValues.creativity);
        setSystemPrompt(draftValues.systemPrompt);
        setInitialValues(draftValues);
        onOpenChange(false);
    }, [draftValues, onOpenChange, setCreativity, setSystemPrompt]);

    const handleOpenChange = useCallback(
        (_: unknown, data: { open: boolean }) => {
            if (!data.open) {
                cancelChanges();
                return;
            }

            onOpenChange(true);
        },
        [cancelChanges, onOpenChange]
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogSurface className={styles.surface}>
                <DialogBody className={styles.body}>
                    <DialogTitle className={styles.title}>{t("components.chattsettingsdrawer.title")}</DialogTitle>
                    <DialogContent className={styles.content}>
                        <ChatSettingsContent
                            creativity={draftValues.creativity}
                            setCreativity={setDraftCreativity}
                            systemPrompt={draftValues.systemPrompt}
                            setSystemPrompt={setDraftSystemPrompt}
                        />
                    </DialogContent>
                    <div className={styles.actions}>
                        <Button appearance="secondary" onClick={cancelChanges}>
                            {t("common.cancel")}
                        </Button>
                        {hasChanges && (
                            <Button appearance="primary" onClick={saveChanges}>
                                {t("components.assistant_editor.save")}
                            </Button>
                        )}
                    </div>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
