import { Stack } from "@fluentui/react";
import { Button, Textarea, TextareaOnChangeData, Tooltip, Badge } from "@fluentui/react-components";
import { Send28Filled, Toolbox24Color } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useContext, useEffect, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { ToolsSelector } from "../ToolsSelector/ToolsSelector";
import { ToolInfo, ToolListResponse } from "../../api/models";
import { getTools } from "../../api/api";

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
    const [toolsSelectorOpen, setToolsSelectorOpen] = useState(false);
    const [tools, setTools] = useState<ToolListResponse | null>(null);
    const [selectedTools, setSelectedTools] = useState<ToolInfo[]>([]);

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

    const fetchTools = async () => {
        try {
            const result = await getTools();
            setTools(result);
        } catch {
            setTools({ tools: [] });
        }
        setToolsSelectorOpen(true);
    };

    return (
        <>
            <ToolsSelector
                open={toolsSelectorOpen}
                onClose={tools => {
                    setToolsSelectorOpen(false);
                    if (tools) setSelectedTools(tools);
                }}
                tools={tools}
                selectedTools={selectedTools}
            />
            <Stack horizontal className={styles.questionInputContainer}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
                        <div className={styles.errorhintSection}>
                            {tokens_used == 0 ? <div> </div> : <div>{description}</div>}
                            <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                        </div>
                        <div className={styles.toolBadgesSection}>
                            {selectedTools.map(tool => {
                                // Generate a random color for each badge (stable per tool)
                                const colorList = [
                                    "#1976d2",
                                    "#388e3c",
                                    "#d32f2f",
                                    "#fbc02d",
                                    "#7b1fa2",
                                    "#0288d1",
                                    "#c2185b",
                                    "#ffa000",
                                    "#388e3c",
                                    "#455a64"
                                ];
                                let hash = 0;
                                for (let i = 0; i < tool.name.length; i++) hash = tool.name.charCodeAt(i) + ((hash << 5) - hash);
                                const color = colorList[Math.abs(hash) % colorList.length];
                                return (
                                    <Badge
                                        key={tool.name}
                                        appearance="filled"
                                        className={styles.toolBadge}
                                        style={{ background: color }}
                                        size="medium"
                                        shape="rounded"
                                        onClick={() => setSelectedTools(selectedTools.filter(t => t.name !== tool.name))}
                                        icon={
                                            <span className={styles.toolBadgeIcon} aria-label={`Entferne ${tool.name}`}>
                                                ×
                                            </span>
                                        }
                                    >
                                        {tool.name}
                                    </Badge>
                                );
                            })}
                        </div>
                        <div className={styles.questionInputButtonsContainer}>
                            <Tooltip content={t("components.questioninput.toolsselectorbutton_tooltip") || "Select tools"} relationship="label">
                                <Button
                                    appearance="subtle"
                                    size="large"
                                    icon={<Toolbox24Color />}
                                    onClick={fetchTools}
                                    disabled={disabled}
                                    aria-label={t("components.questioninput.toolsselectorbutton_tooltip") || "Select tools"}
                                />
                            </Tooltip>
                            <Tooltip content={placeholder || ""} relationship="label">
                                <Button
                                    size="large"
                                    appearance="subtle"
                                    icon={<Send28Filled />}
                                    aria-label={t("components.questioninput.sendbutton_tooltip") || "Send question"}
                                    disabled={disabled || !question.trim()}
                                    onClick={sendQuestion}
                                />
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </Stack>
        </>
    );
};
