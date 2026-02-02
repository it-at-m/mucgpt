import { useCallback, useEffect, useState } from "react";

import { Stack } from "@fluentui/react";

import styles from "./Answer.module.css";

import { AskResponse } from "../../api";
import { AnswerIcon } from "./AnswerIcon";
import { useTranslation } from "react-i18next";
import { ArrowSync24Regular, CheckmarkSquare24Regular, ContentView24Regular, Copy24Regular, ChevronDown20Regular, ChevronRight20Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { QuickPromptList } from "../QuickPrompt/QuickPromptList";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";

interface Props {
    answer: AskResponse;
    onRegenerateResponseClicked?: () => void;
    onQuickPromptSend?: (prompt: string) => void;
}

export const Answer = ({ answer, onRegenerateResponseClicked, onQuickPromptSend }: Props) => {
    const { t } = useTranslation();

    const [copied, setCopied] = useState<boolean>(false);
    const [formatted, setFormatted] = useState<boolean>(true);
    const [ref, setRef] = useState<HTMLElement | null>();
    const [reasoningExpanded, setReasoningExpanded] = useState<boolean>(false);

    const [processedText, setProcessedText] = useState<string>("");
    const [processedReasoning, setProcessedReasoning] = useState<string>("");
    const oncopy = useCallback(() => {
        setCopied(true);
        navigator.clipboard.writeText(answer.answer);
        setTimeout(() => {
            setCopied(false);
        }, 1000);
    }, [navigator.clipboard, answer.answer]);

    useEffect(() => {
        if (answer.answer === "" || answer.answer === undefined) {
            setProcessedText("");
            return;
        }
        setProcessedText(
            answer.answer
                .replace(/\\\[/g, "$$$") // Replace \[ with $$ (display math start)
                .replace(/\\\]/g, "$$$") // Replace \] with $$ (display math end)
                .replace(/\\\(/g, "$$$") // Replace \( with $ (inline math start)
                .replace(/\\\)/g, "$$$") // Replace \) with $ (inline math end)
        );
    }, [answer.answer]); // Run this effect only when the message changes

    useEffect(() => {
        if (answer.reasoning_content === "" || answer.reasoning_content === undefined) {
            setProcessedReasoning("");
            return;
        }
        setProcessedReasoning(
            answer.reasoning_content
                .replace(/\\\[/g, "$$$")
                .replace(/\\\]/g, "$$$")
                .replace(/\\\(/g, "$$$")
                .replace(/\\\)/g, "$$$")
        );
    }, [answer.reasoning_content]);

    return (
        <Stack className={styles.answerContainer} verticalAlign="space-between">
            <Stack.Item>
                <Stack horizontal horizontalAlign="space-between">
                    <AnswerIcon aria-hidden />
                    <div>
                        <Tooltip content={t("components.answer.copy")} relationship="description" positioning={{ target: ref }}>
                            <Button
                                ref={setRef}
                                appearance="subtle"
                                aria-label={t("components.answer.copy")}
                                icon={
                                    !copied ? (
                                        <Copy24Regular className={styles.iconRightMargin} />
                                    ) : (
                                        <CheckmarkSquare24Regular className={styles.iconRightMargin} />
                                    )
                                }
                                size="large"
                                onClick={() => {
                                    oncopy();
                                }}
                            ></Button>
                        </Tooltip>

                        <Tooltip content={t("components.answer.unformat")} relationship="description" positioning="above">
                            <Button
                                appearance="subtle"
                                aria-label={t("components.answer.unformat")}
                                icon={<ContentView24Regular className={styles.iconRightMargin} />}
                                onClick={() => setFormatted(!formatted)}
                                size="large"
                            ></Button>
                        </Tooltip>

                        {onRegenerateResponseClicked && (
                            <Tooltip content={t("components.answer.regenerate")} relationship="description" positioning="above">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.answer.regenerate")}
                                    icon={<ArrowSync24Regular className={styles.iconRightMargin} />}
                                    onClick={() => onRegenerateResponseClicked()}
                                    size="large"
                                ></Button>
                            </Tooltip>
                        )}
                    </div>
                </Stack>
            </Stack.Item>

            <Stack.Item className={styles.growItem} grow>
                {/* Reasoning Section - Show if reasoning content exists */}
                {processedReasoning && (
                    <div style={{ marginBottom: "16px", borderLeft: "3px solid #0078d4", paddingLeft: "12px", backgroundColor: "#f3f2f1" }}>
                        <div
                            onClick={() => setReasoningExpanded(!reasoningExpanded)}
                            style={{ cursor: "pointer", padding: "8px", display: "flex", alignItems: "center", fontWeight: "600" }}
                        >
                            {reasoningExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                            <span style={{ marginLeft: "8px" }}>Reasoning</span>
                        </div>
                        {reasoningExpanded && (
                            <div style={{ padding: "8px", fontSize: "0.9em", color: "#605e5c" }}>
                                {formatted ? (
                                    <MarkdownRenderer>{processedReasoning}</MarkdownRenderer>
                                ) : (
                                    <div style={{ whiteSpace: "pre-wrap" }}>{processedReasoning}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Answer Section */}
                {formatted && (
                    <div className={styles.answerText}>
                        <MarkdownRenderer>{processedText}</MarkdownRenderer>
                    </div>
                )}
                {!formatted && (
                    <div className={styles.unformattedAnswer} tabIndex={0}>
                        {processedText}
                    </div>
                )}
            </Stack.Item>
            {onRegenerateResponseClicked && onQuickPromptSend && (
                <Stack.Item>
                    <QuickPromptList onSend={prompt => onQuickPromptSend(prompt)} />
                </Stack.Item>
            )}
        </Stack>
    );
};
