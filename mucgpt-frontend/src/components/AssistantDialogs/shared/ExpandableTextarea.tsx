import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Button,
    Dialog,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Textarea
} from "@fluentui/react-components";
import { ArrowMaximize24Regular, Dismiss24Regular } from "@fluentui/react-icons";

import styles from "./ExpandableTextarea.module.css";

export interface ExpandableTextareaProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    dialogTitle?: string;
    className?: string;
}

export function ExpandableTextarea({ value, onChange, placeholder, rows, disabled, dialogTitle, className }: ExpandableTextareaProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [dialogDraft, setDialogDraft] = useState("");
    const valueOnOpenRef = useRef("");
    const dialogTextareaRef = useRef<HTMLTextAreaElement>(null);

    const handleOpen = useCallback(() => {
        valueOnOpenRef.current = value;
        setDialogDraft(value);
        setIsOpen(true);
    }, [value]);

    const handleClose = useCallback(() => {
        onChange(dialogDraft);
        setIsOpen(false);
    }, [dialogDraft, onChange]);

    useEffect(() => {
        if (!isOpen) return;
        // Wait for FluentUI Dialog focus trap to settle, then focus the textarea
        const id = setTimeout(() => {
            const el = dialogTextareaRef.current;
            if (el) {
                el.focus();
                el.setSelectionRange(el.value.length, el.value.length);
            }
        }, 50);
        return () => clearTimeout(id);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: BeforeUnloadEvent) => {
            if (dialogDraft !== valueOnOpenRef.current) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isOpen, dialogDraft]);

    return (
        <div className={`${styles.wrapper} ${className ?? ""}`}>
            <Textarea
                className={styles.inlineTextarea}
                value={value}
                placeholder={placeholder}
                rows={rows}
                resize="vertical"
                disabled={disabled}
                onChange={(_e, data) => onChange(data?.value ?? "")}
            />
            {!disabled && (
                <Button
                    className={styles.expandButton}
                    appearance="subtle"
                    size="small"
                    icon={<ArrowMaximize24Regular />}
                    aria-label={t("components.expandable_textarea.expand")}
                    onClick={handleOpen}
                />
            )}
            <Dialog open={isOpen} onOpenChange={(_e, data) => { if (!data.open) handleClose(); }} modalType="modal">
                <DialogSurface
                    style={{
                        width: "80vw",
                        maxWidth: "80vw",
                        height: "80vh",
                        maxHeight: "80vh",
                        display: "flex",
                        flexDirection: "column"
                    }}
                >
                    <DialogBody style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                        <DialogTitle
                            action={
                                <Button
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    aria-label={t("common.close")}
                                    onClick={handleClose}
                                />
                            }
                        >
                            {dialogTitle ?? t("components.expandable_textarea.default_title")}
                        </DialogTitle>
                        <DialogContent style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                            <Textarea
                                className={styles.dialogTextarea}
                                value={dialogDraft}
                                placeholder={placeholder}
                                resize="none"
                                onChange={(_e, data) => setDialogDraft(data?.value ?? "")}
                                textarea={{ ref: dialogTextareaRef }}
                            />
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
