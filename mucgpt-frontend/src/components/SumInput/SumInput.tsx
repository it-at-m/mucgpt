import { useCallback, useState } from "react";
import { Stack } from "@fluentui/react";
import { Button, Tooltip, Textarea, TextareaOnChangeData } from "@fluentui/react-components";
import { Delete24Regular, Send28Filled } from "@fluentui/react-icons";

import styles from "./SumInput.module.css";
import { useTranslation } from "react-i18next";

interface Props {
    onSend: (question: string, file?: File) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    question: string;
    setQuestion: (question: string) => void;
}

export const SumInput = ({ onSend, disabled, placeholder, clearOnSend, question, setQuestion }: Props) => {
    const { t } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | undefined>(undefined);
    const sendQuestionDisabled = disabled || (!question.trim() && !file);

    // remove documents
    const removeDocuments = useCallback(() => {
        setFile(undefined);
        setDragging(false);
    }, []);

    // send question
    const sendQuestion = useCallback(() => {
        if (disabled || (!question.trim() && !file)) {
            return;
        }
        onSend(question, file);

        if (clearOnSend) {
            setQuestion("");
            removeDocuments();
        }
    }, [disabled, question, file, onSend, clearOnSend, removeDocuments]);

    // enter press
    const onEnterPress = useCallback(
        (ev: React.KeyboardEvent<Element>) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    // question change
    const onQuestionChange = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (!newValue?.value) {
            setQuestion("");
        } else {
            setQuestion(newValue.value);
        }
    }, []);

    // file drag n drop
    const handleDrop = useCallback((e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        const files = e.dataTransfer.files;

        if (files.length > 0) setFile(files[0]);

        setDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            {file ? (
                <div className={styles.documentContainer}>
                    <p className={styles.paddingDocumentName}>{file.name}</p>

                    <Tooltip content={t("components.suminput.removedocument")} relationship="description" positioning="above">
                        <Button icon={<Delete24Regular />} disabled={disabled} onClick={removeDocuments} size="large"></Button>
                    </Tooltip>
                </div>
            ) : (
                <Textarea
                    textarea={{ style: { borderStyle: "dashed", borderWidth: "4px" } }}
                    root={{ style: { borderStyle: "hidden" } }}
                    placeholder={placeholder}
                    resize="vertical"
                    value={question}
                    size="large"
                    onChange={onQuestionChange}
                    onKeyDown={onEnterPress}
                    onDrop={handleDrop}
                    draggable={dragging}
                    onDragOver={handleDragOver}
                />
            )}
            <div className={styles.questionInputContainerFooter}>
                <div></div>
                <div className={styles.questionInputButtonsContainer}>
                    <Tooltip content={placeholder || ""} relationship="label">
                        <Button size="large" appearance="subtle" icon={<Send28Filled />} disabled={sendQuestionDisabled} onClick={sendQuestion} />
                    </Tooltip>
                </div>
            </div>
        </Stack>
    );
};
