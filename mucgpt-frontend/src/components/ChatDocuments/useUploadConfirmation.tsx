import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from "@fluentui/react-components";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SensitivityFinding } from "../../api/models";
import { Button } from "../../ui/Button";
import { describeFindings } from "./sensitivity";

type Decision = { name: string; findings: SensitivityFinding[]; resolve: (save: boolean) => void };

export function useUploadConfirmation(scope?: string) {
    const { t } = useTranslation();
    const pending = useRef<Decision[]>([]);
    const [current, setCurrent] = useState<Decision>();
    const generation = useRef(0);
    useEffect(() => {
        setCurrent(undefined);
        return () => {
            generation.current++;
            pending.current.splice(0).forEach(item => item.resolve(false));
        };
    }, [scope]);
    const createConfirmation = useCallback(() => {
        const started = generation.current;
        return (name: string, findings: SensitivityFinding[]) =>
            new Promise<boolean>(resolve => {
                if (generation.current !== started) return resolve(false);
                pending.current.push({ name, findings, resolve });
                setCurrent(pending.current[0]);
            });
    }, []);
    const decide = (save: boolean) => {
        if (!current || pending.current[0] !== current) return;
        pending.current.shift();
        current.resolve(save);
        setCurrent(pending.current[0]);
    };
    const dialog = current && (
        <Dialog open onOpenChange={(_, data) => !data.open && decide(false)}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>{t("document_library.save_question")}</DialogTitle>
                    <DialogContent>
                        {current.name} — {t("document_library.sensitivity_badge_hint", { findings: describeFindings(current.findings, t) })}
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => decide(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button appearance="primary" onClick={() => decide(true)}>
                            {t("document_library.save_document")}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
    return { createConfirmation, dialog };
}
