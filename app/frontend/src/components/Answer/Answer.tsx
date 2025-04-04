import { useEffect, useState } from "react";
import { Stack } from "@fluentui/react";

import styles from "./Answer.module.css";

import { AskResponse } from "../../api";
import { AnswerIcon } from "./AnswerIcon";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ArrowSync24Regular, CheckmarkSquare24Regular, ContentView24Regular, Copy24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { QuickPromptList } from "../QuickPrompt/QuickPromptList";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

interface Props {
    answer: AskResponse;
    onRegenerateResponseClicked?: () => void;
    setQuestion: (question: string) => void;
}

export const Answer = ({ answer, onRegenerateResponseClicked, setQuestion }: Props) => {
    const { t } = useTranslation();

    const [copied, setCopied] = useState<boolean>(false);
    const [formatted, setFormatted] = useState<boolean>(true);
    const [ref, setRef] = useState<HTMLElement | null>();
    const [processedText, setProcessedText] = useState<string>("");
    const oncopy = () => {
        setCopied(true);
        navigator.clipboard.writeText(answer.answer);
        setTimeout(() => {
            setCopied(false);
        }, 1000);
    };
    useEffect(() => {
        setProcessedText(answer.answer
            .replace(/\\\[/g, '$$$')  // Replace all occurrences of \[ with $$
            .replace(/\\\]/g, '$$$') // Replace all occurrences of \] with $$
            .replace(/\\\(/g, '$$$')  // Replace all occurrences of \( with $$
            .replace(/\\\)/g, '$$$')); // Replace all occurrences of \) with $$
    }
        , [answer.answer]); // Run this effect only when the message changes

    const remarkMathOptions = {
        singleDollarTextMath: false,
    };
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
                {formatted && (
                    <Markdown
                        className={styles.answerText}
                        remarkPlugins={[[remarkMath, remarkMathOptions], remarkGfm]} // Pass options as the second element of the array
                        rehypePlugins={[rehypeRaw, rehypeKatex]} // Include rehypeRaw for HTML, rehypeKatex for LaTeX
                        components={{
                            code: CodeBlockRenderer
                        }}
                    >
                        {processedText}
                    </Markdown>
                )}
                {!formatted && (
                    <div className={styles.unformattedAnswer} tabIndex={0}>
                        {processedText}
                    </div>
                )}
            </Stack.Item>
            {onRegenerateResponseClicked && (
                <Stack.Item>
                    <QuickPromptList setQuestion={question => setQuestion(question)} />
                </Stack.Item>
            )}
        </Stack>
    );
};
