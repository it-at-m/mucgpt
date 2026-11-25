import { useState } from "react";
import { Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";

import { allowForSession, dismissExternalLink, openExternalUrl, useExternalLinkRequest } from "./externalLinkGuard";
import styles from "./MarkdownRenderer.module.css";

/**
 * Global confirmation dialog for non-whitelisted link activations: shows the
 * sanitized target, offers a session-only remember option, and opens the URL
 * only on explicit confirmation. Mounted once beside the global toast
 * handler; request sources are the chat link policy and the canvas editor.
 */
export const ExternalLinkDialog = () => {
    const { t } = useTranslation();
    const pendingUrl = useExternalLinkRequest();
    const [remember, setRemember] = useState(false);

    const close = () => {
        setRemember(false);
        dismissExternalLink();
    };

    const confirm = () => {
        if (pendingUrl) {
            if (remember) allowForSession(pendingUrl);
            openExternalUrl(pendingUrl);
        }
        close();
    };

    return (
        <Dialog open={pendingUrl !== null} onOpenChange={(_, data) => !data.open && close()}>
            <DialogSurface aria-describedby={undefined}>
                <DialogBody>
                    <DialogTitle>{t("external_link.title")}</DialogTitle>
                    <DialogContent>
                        <p>{t("external_link.description")}</p>
                        {pendingUrl && <span className={styles.externalLinkUrl}>{pendingUrl}</span>}
                        <Checkbox label={t("external_link.allow_session")} checked={remember} onChange={(_, data) => setRemember(!!data.checked)} />
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={close}>
                            {t("external_link.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={confirm}>
                            {t("external_link.open")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
