import { Stack } from "@fluentui/react";
import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useEffect, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    tokens_used: number;
    token_limit_tracking?: boolean;
    question: string;
    setQuestion: (question: string) => void;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, tokens_used, token_limit_tracking = true, question, setQuestion }: Props) => {
    const { t } = useTranslation();
    const { LLM } = useContext(LLMContext);
    const [description, setDescription] = useState<string>("0");

    useEffect(() => {
        const actual = countWords(question) + tokens_used;
        let text;
        if (token_limit_tracking) {
            text = `${actual}/ ${LLM.max_input_tokens} ${t("components.questioninput.tokensused")}`;
            if (actual > LLM.max_input_tokens) text += `${t("components.questioninput.limit")}`;
        } else text = `${actual} ${t("components.questioninput.tokensused")}`;
        setDescription(text);
    }, [tokens_used, LLM.max_input_tokens]);

    const sendQuestion = useCallback(() => {
        if (disabled || !question.trim()) {
            return;
        }

        onSend(question);

        if (clearOnSend) {
            setQuestion("");
        }
    }, [disabled, question, onSend, clearOnSend, setQuestion]);

    const onEnterPress = useCallback(
        (ev: React.KeyboardEvent<Element>) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                sendQuestion();
            }
        },
        [sendQuestion]
    );

    function countWords(str: string) {
        return str.trim().split(/\s+/).length;
    }

    const onQuestionChange = useCallback((_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (!newValue?.value) {
            setQuestion("");
        } else {
            setQuestion(newValue.value);
        }
    }, []);

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
                {tokens_used == 0 ? <div> </div> : <div>{description}</div>}
                <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                <div className={styles.questionInputButtonsContainer}>
                    <Tooltip content={placeholder || ""} relationship="label">
                        <Button size="large" appearance="subtle" icon={<Send28Filled />} disabled={disabled || !question.trim()} onClick={sendQuestion} />
                    </Tooltip>
                </div>
            </div>
        </Stack>
    );
};
