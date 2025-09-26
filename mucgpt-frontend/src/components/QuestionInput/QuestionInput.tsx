import { Stack } from "@fluentui/react";
import { Button, Textarea, TextareaOnChangeData, Tooltip, Badge } from "@fluentui/react-components";
import { Dismiss24Regular, Send28Filled, Toolbox24Color } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { ToolsSelector } from "../ToolsSelector/ToolsSelector";
import { ToolListResponse } from "../../api/models";

const TOOL_BADGE_COLOR_LIST = ["#4285f4", "#34a853", "#ea4335", "#6c5ce7", "#00b894", "#0984e3", "#e84393", "#fdcb6e", "#00cec9", "#636e72"];

interface Props {
    onSend: (question: string) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
    question: string;
    setQuestion: (question: string) => void;
    selectedTools: string[];
    setSelectedTools?: (tools: string[]) => void;
    tools?: ToolListResponse;
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, question, setQuestion, selectedTools, setSelectedTools, tools }: Props) => {
    const { t } = useTranslation();
    const [toolsSelectorOpen, setToolsSelectorOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);

    // Auto-resize functionality with scrolling to the send button
    useEffect(() => {
        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (textarea) {
                // Store current cursor position
                const selectionStart = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;
                const originalHeight = textarea.offsetHeight;

                // Reset height first to get accurate scrollHeight
                textarea.style.height = "auto";

                // Add a small offset (4px) to prevent exact overlap
                const newHeight = textarea.scrollHeight + 4;
                textarea.style.height = `${newHeight}px`; // Scroll to send button if height increased
                if (newHeight > originalHeight) {
                    // Use requestAnimationFrame to ensure DOM has updated
                    requestAnimationFrame(() => {
                        // Restore focus and cursor position
                        textarea.focus();
                        textarea.setSelectionRange(selectionStart, selectionEnd);
                    });
                }
            }
        };

        resizeTextarea();

        // Reset height when question is cleared
        if (question === "") {
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = "40px";
            }
        }
    }, [question]);

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

    const onQuestionChange = useCallback(
        (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
            if (!newValue?.value) {
                setQuestion("");
            } else {
                setQuestion(newValue.value);
            }
        },
        [setQuestion]
    );

    return (
        <>
            <ToolsSelector
                open={toolsSelectorOpen}
                onClose={tools => {
                    setToolsSelectorOpen(false);
                    if (tools && setSelectedTools) setSelectedTools(tools.map(t => t.id));
                }}
                tools={tools}
                selectedTools={tools ? tools.tools.filter(t => selectedTools.includes(t.id)) : []}
            />
            <Stack horizontal className={styles.questionInputContainer}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ position: "relative" }}>
                        <Textarea
                            className={styles.questionInputTextArea}
                            placeholder={placeholder}
                            resize="none"
                            value={question}
                            size="large"
                            onChange={onQuestionChange}
                            onKeyDown={onEnterPress}
                            ref={textareaRef}
                        />
                    </div>
                    <div className={styles.questionInputContainerFooter}>
                        <div className={styles.errorhintSection}>
                            <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                        </div>
                        <div className={styles.toolBadgesSection}>
                            {selectedTools.map(toolName => {
                                let hash = 0;
                                for (let i = 0; i < toolName.length; i++) hash = toolName.charCodeAt(i) + ((hash << 5) - hash);
                                const color = TOOL_BADGE_COLOR_LIST[Math.abs(hash) % TOOL_BADGE_COLOR_LIST.length];
                                return (
                                    <Badge
                                        key={toolName}
                                        appearance="filled"
                                        className={styles.toolBadge}
                                        style={{ background: color }}
                                        size="small"
                                        shape="rounded"
                                        onClick={() => {
                                            if (setSelectedTools) setSelectedTools(selectedTools.filter(t => t !== toolName));
                                        }}
                                        icon={
                                            setSelectedTools && (
                                                <Dismiss24Regular className={styles.toolBadgeIcon} aria-label={`Entferne ${toolName}`} />
                                            )
                                        }
                                    >
                                        {toolName}
                                    </Badge>
                                );
                            })}
                        </div>
                        <div className={styles.questionInputButtonsContainer}>
                            {tools && setSelectedTools && (
                                <Tooltip content={t("components.questioninput.toolsselectorbutton_tooltip") || "Select tools"} relationship="label">
                                    <Button
                                        appearance="subtle"
                                        size="large"
                                        icon={<Toolbox24Color />}
                                        onClick={() => setToolsSelectorOpen(true)}
                                        disabled={disabled}
                                        aria-label={t("components.questioninput.toolsselectorbutton_tooltip") || "Select tools"}
                                    />
                                </Tooltip>
                            )}
                            <Tooltip content={placeholder || ""} relationship="label">
                                <Button
                                    ref={sendButtonRef}
                                    size="large"
                                    appearance={question.trim() ? "primary" : "subtle"}
                                    icon={<Send28Filled />}
                                    aria-label={"Send question"}
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
