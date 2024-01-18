import { useState } from "react";
import { Stack } from "@fluentui/react";
import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from 'react-i18next';

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    tokens_used: number
    token_limit_tracking?: boolean;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, tokens_used, token_limit_tracking = true }: Props) => {
    const [question, setQuestion] = useState<string>("");
    const { t, i18n } = useTranslation();
    const wordCount = 4000;
    const getDescription = () => {
        let actual = countWords(question) + tokens_used;
        let text;
        if (token_limit_tracking) {
            text = `${actual}/ ${wordCount} ${t('components.questioninput.tokensused')}`;
            if (actual > wordCount)
                text += `${t('components.questioninput.limit')}`
        }
        else
            text = `${actual} ${t('components.questioninput.tokensused')}`;
        return text;
    }

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            return;
        }

        onSend(question);

        if (clearOnSend) {
            setQuestion("");
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

    const sendQuestionDisabled = disabled || !question.trim();

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            <Textarea
                textarea={styles.questionInputTextArea}
                placeholder={placeholder}
                resize="vertical"
                value={question}
                size="large"
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
            />
            <div className={styles.questionInputContainerFooter}>
                <div>
                    {getDescription()}
                </div>
                <div className={styles.questionInputButtonsContainer}>
                    <Tooltip content={placeholder || ""} relationship="label">
                        <Button size="large" appearance="subtle" icon={<Send28Filled />} disabled={sendQuestionDisabled} onClick={sendQuestion} />
                    </Tooltip>
                </div>
            </div>
        </Stack>
    );
};
