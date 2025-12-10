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
}

// Map tool IDs to their tutorial routes
const TOOL_TUTORIAL_MAP: Record<string, string> = {
    Brainstorming: "/tutorials/brainstorm",
    Vereinfachen: "/tutorials/simplify"
    // Add more tool-to-tutorial mappings here as needed
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
    allowToolSelection = true
}: Props) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const sendButtonRef = useRef<HTMLButtonElement | null>(null);

    // Auto-resize functionality
    useEffect(() => {
        const resizeTextarea = () => {
            const textarea = textareaRef.current;
            if (textarea) {
                // Check if textarea currently has focus
                const hadFocus = document.activeElement === textarea;

                // Store current cursor position
                const selectionStart = textarea.selectionStart;
                const selectionEnd = textarea.selectionEnd;

                // Reset height first to get accurate scrollHeight
                textarea.style.height = "auto";

                // Calculate new height
                const newHeight = textarea.scrollHeight;
                textarea.style.height = `${newHeight}px`;

                // Only restore focus and cursor position if textarea had focus before
                if (hadFocus) {
                    textarea.focus();
                    textarea.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        };

        resizeTextarea();

        // Reset height when question is cleared
        if (question === "") {
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = "auto";
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
        event.stopPropagation(); // Prevent toggling the tool
        const tutorialRoute = TOOL_TUTORIAL_MAP[toolId];
        if (tutorialRoute) {
            window.open(`#${tutorialRoute}`, "_blank");
        }
    }, []);

    return (
        <>
            <div className={styles.questionInputWrapper}>
                {/* Tool badges at the top - show all tools */}
                {tools && tools.tools && tools.tools.length > 0 && (
                    <div className={styles.toolBadgesHeader}>
                        <span className={styles.toolBadgesLabel}>{t("components.questioninput.tool_header", "Zusätzliche Tools zu wählen:")}</span>
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
                                        icon={isSelected ? <Checkmark24Regular style={{ color: "var(--onPrimaryVariant)" }} /> : undefined}
                                        style={isSelected ? { color: "var(--onPrimaryVariant)" } : undefined}
                                    >
                                        <span style={isSelected ? { color: "var(--onPrimaryVariant)" } : undefined}>
                                            {tool.id}
                                        </span>
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
                )}

                {/* Input container with textarea and buttons */}
                <div className={`${styles.questionInputContainer} ${!tools || !tools.tools || tools.tools.length === 0 ? styles.noTools : ""}`}>
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
                                appearance={"subtle"}
                                icon={<Send28Filled />}
                                aria-label={t("components.questioninput.send_question", "Frage senden")}
                                disabled={disabled || !question.trim()}
                                onClick={sendQuestion}
                            />
                        </Tooltip>
                    </div>
                </div>

                {/* Error hint at the bottom */}
                <div className={styles.errorhintSection}>
                    <div className={styles.errorhint}>{t("components.questioninput.errorhint")}</div>
                </div>
            </div>
        </>
    );
};
