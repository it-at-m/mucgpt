import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
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

    return (
        <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
            <DialogSurface>
                <DialogBody>
                    <div className={styles.header}>
                        <DialogTitle>{t("components.chattsettingsdrawer.title")}</DialogTitle>
                        <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => onOpenChange(false)} aria-label={t("common.close")} />
                    </div>
                    <DialogContent className={styles.content}>
                        <ChatSettingsContent
                            creativity={creativity}
                            setCreativity={setCreativity}
                            systemPrompt={systemPrompt}
                            setSystemPrompt={setSystemPrompt}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="primary" onClick={() => onOpenChange(false)}>
                            {t("common.close")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
