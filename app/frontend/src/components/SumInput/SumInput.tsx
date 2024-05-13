import { DragEventHandler, useState } from "react";
import { Stack, classNamesFunction, } from "@fluentui/react";
import { Button, Tooltip, Textarea, TextareaOnChangeData, } from "@fluentui/react-components";
import { Delete24Regular, Send28Filled } from "@fluentui/react-icons";

import styles from "./SumInput.module.css";
import { useTranslation } from 'react-i18next';

interface Props {
    onSend: (question: string, file?: File) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    tokens_used: number
    token_limit_tracking?: boolean;
    question: string;
    setQuestion: (question: string) => void;
}

export const SumInput = ({ onSend, disabled, placeholder, clearOnSend, tokens_used, token_limit_tracking = true, question, setQuestion }: Props) => {

    const { t, i18n } = useTranslation();
    const [dragging, setDragging] = useState(false);
    const [file, setFile] = useState<File | undefined>(undefined);
    const wordCount = 4000;
    const getDescription = () => {
        let actual = countWords(question) + tokens_used;
        let text;
        if (token_limit_tracking) {
            text = `${actual}/ ${wordCount} ${t('components.suminput.tokensused')}`;
            if (actual > wordCount)
                text += `${t('components.suminput.limit')}`
        }
        else
            text = `${actual} ${t('components.suminput.tokensused')}`;
        return text;
    }

    const sendQuestion = () => {
        if (disabled || (!question.trim() && !file)) {
            return;
        }
        onSend(question, file);

        if (clearOnSend) {
            setQuestion("");
            removeDocuments();
        }
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    function countWords(str: string) {
        return str.trim().split(/\s+/).length;
    }

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (!newValue?.value) {
            setQuestion("");
        } else {
            setQuestion(newValue.value);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        const files = e.dataTransfer.files;

        if (files.length > 0)
            setFile(files[0]);

        setDragging(false);

    }


    const handleDragOver = (e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.preventDefault();
        setDragging(true);
    }

    const removeDocuments = () => {
        setFile(undefined);
        setDragging(true);
    }

    const sendQuestionDisabled = disabled || (!question.trim() && !file);

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            {file ? (
                <div className={styles.documentContainer}>

                    <p className={styles.paddingDocumentName}>{file.name}</p>

                    <Tooltip content={t('components.suminput.removedocument')} relationship="description" positioning="above">
                        <Button icon={<Delete24Regular />} disabled={disabled} onClick={removeDocuments} size="large">
                        </Button>
                    </Tooltip>

                </div>) : (
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
            )
            }
            <div className={styles.questionInputContainerFooter}>
                {file ? (<div></div>) : (
                    <div
                    >
                        {getDescription()}
                    </div>)
                }
                < div className={styles.questionInputButtonsContainer}>
                    <Tooltip content={placeholder || ""} relationship="label">
                        <Button size="large" appearance="subtle" icon={<Send28Filled />} disabled={sendQuestionDisabled} onClick={sendQuestion} />
                    </Tooltip>
                </div>
            </div>
        </Stack >
    );
};
