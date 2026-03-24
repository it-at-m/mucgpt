import { Button, Textarea, TextareaOnChangeData, Tooltip } from "@fluentui/react-components";
import { Send28Filled, Checkmark24Regular, QuestionCircle16Regular } from "@fluentui/react-icons";

import styles from "./QuestionInput.module.css";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef } from "react";
import { ToolListResponse } from "../../api/models";

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
    allowToolSelection?: boolean;
    variant?: "default" | "home";
}

const TOOL_TUTORIAL_MAP: Record<string, string> = {
    Brainstorming: "/tutorials/brainstorm",
    Vereinfachen: "/tutorials/simplify"
};

export const QuestionInput = ({
    onSend,
    disabled,
    placeholder,
    clearOnSend,
    question,
    setQuestion,
    selectedTools,
    setSelectedTools,
    tools,
    allowToolSelection = true,
    variant = "default"
}: Props) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);
    const isHomeVariant = variant === "home";

    useEffect(() => {
        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const hadFocus = document.activeElement === textarea;
            const selectionStart = textarea.selectionStart;
            const selectionEnd = textarea.selectionEnd;

            textarea.style.height = "auto";

            const maxHeight = 200;
            const scrollHeight = textarea.scrollHeight;
            const newHeight = Math.min(scrollHeight, maxHeight);

            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";

            if (hadFocus) {
                textarea.focus();
                textarea.setSelectionRange(selectionStart, selectionEnd);
            }
        };

        resizeTextarea();

        if (question === "") {
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = "auto";
                textarea.style.overflowY = "hidden";
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
            setQuestion(newValue?.value || "");
        },
        [setQuestion]
    );

    const toggleTool = useCallback(
        (toolId: string) => {
            if (!allowToolSelection || !setSelectedTools) return;

            if (selectedTools.includes(toolId)) {
                setSelectedTools(selectedTools.filter(t => t !== toolId));
            } else {
                setSelectedTools([...selectedTools, toolId]);
            }
        },
        [selectedTools, setSelectedTools, allowToolSelection]
    );

    const openTutorial = useCallback((toolId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const tutorialRoute = TOOL_TUTORIAL_MAP[toolId];
        if (tutorialRoute) {
            window.open(`#${tutorialRoute}`, "_blank");
        }
    }, []);

    const showToolSelection = !isHomeVariant && !!tools?.tools?.length;
    const containerClasses = [styles.questionInputContainer, (!tools || !tools.tools || tools.tools.length === 0) && styles.noTools, isHomeVariant && styles.questionInputContainerHome]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={`${styles.questionInputWrapper} ${isHomeVariant ? styles.questionInputWrapperHome : ""}`}>
            {showToolSelection && (
                <div className={styles.toolBadgesHeader}>
                    <span className={styles.toolBadgesLabel}>{t("components.questioninput.tool_header", "Zusätzliche Tools zu wählen:")}</span>
                    <div className={styles.toolButtonsRow}>
                        {tools.tools.map(tool => {
                            const isSelected = selectedTools.includes(tool.id);
                            const hasTutorial = TOOL_TUTORIAL_MAP[tool.id];

                            return (
                                <div key={tool.id} className={styles.toolButtonWrapper}>
                                    <Button
                                        appearance={isSelected ? "primary" : "secondary"}
                                        size="medium"
                                        className={styles.toolButton}
                                        onClick={allowToolSelection ? () => toggleTool(tool.id) : undefined}
                                        disabled={!allowToolSelection}
                                        icon={isSelected ? <Checkmark24Regular /> : undefined}
                                    >
                                        <span>{tool.id}</span>
                                    </Button>
                                    {hasTutorial && (
                                        <Tooltip content={t("components.questioninput.tutorial_help", "Tutorial öffnen")} relationship="label">
                                            <button
                                                className={styles.toolHelpButton}
                                                onClick={e => openTutorial(tool.id, e)}
                                                aria-label={t("components.questioninput.tutorial_help_aria", { tool: tool.id })}
                                            >
                                                <QuestionCircle16Regular />
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className={containerClasses}>
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
                <div className={styles.questionInputButtons}>
                    <Tooltip content={placeholder || ""} relationship="label">
                        <Button
                            ref={sendButtonRef}
                            size="large"
                            appearance="subtle"
                            icon={<Send28Filled />}
                            aria-label={t("components.questioninput.send_question", "Frage senden")}
                            disabled={disabled || !question.trim()}
                            onClick={sendQuestion}
                        />
                    </Tooltip>
                </div>
            </div>

            {!isHomeVariant && (
                <div className={styles.errorhintSection}>
                    <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                </div>
            )}
        </div>
    );
};
