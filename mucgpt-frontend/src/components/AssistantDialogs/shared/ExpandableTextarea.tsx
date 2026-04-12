import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogBody, DialogContent, DialogSurface, DialogTitle, Textarea } from "@fluentui/react-components";
import { ArrowMaximize20Regular, Dismiss24Regular } from "@fluentui/react-icons";

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
    const [hasScrollbar, setHasScrollbar] = useState(false);
    const valueOnOpenRef = useRef("");
    const dialogTextareaRef = useRef<HTMLTextAreaElement>(null);
    const inlineTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = inlineTextareaRef.current;
        if (!el) return;
        const check = () => setHasScrollbar(el.scrollHeight > el.clientHeight);
        check();
        const observer = new ResizeObserver(check);
        observer.observe(el);
        return () => observer.disconnect();
    }, [value]);

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
                textarea={{ ref: inlineTextareaRef }}
            />
            {!disabled && (
                <Button
                    className={styles.expandButton}
                    appearance="primary"
                    size="small"
                    icon={<ArrowMaximize20Regular />}
                    aria-label={t("components.expandable_textarea.default_title")}
                    style={{ right: hasScrollbar ? 12 : 4 }}
                    onClick={handleOpen}
                />
            )}
            <Dialog
                open={isOpen}
                onOpenChange={(_e, data) => {
                    if (!data.open) handleClose();
                }}
                modalType="modal"
            >
                <DialogSurface className={styles.dialogSurface}>
                    <DialogBody className={styles.dialogBody}>
                        <DialogTitle action={<Button appearance="subtle" icon={<Dismiss24Regular />} aria-label={t("common.close")} onClick={handleClose} />}>
                            {dialogTitle ?? t("components.expandable_textarea.default_title")}
                        </DialogTitle>
                        <DialogContent className={styles.dialogContent}>
                            <Textarea
                                style={{ flex: 1, width: "100%", display: "flex" }}
                                textarea={{ ref: dialogTextareaRef, style: { flex: 1, maxHeight: "none" } }}
                                value={dialogDraft}
                                placeholder={placeholder}
                                resize="none"
                                onChange={(_e, data) => setDialogDraft(data?.value ?? "")}
                            />
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
