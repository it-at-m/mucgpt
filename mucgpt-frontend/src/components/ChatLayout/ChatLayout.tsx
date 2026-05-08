import { ReactNode, useEffect, useState } from "react";
import { Button } from "@fluentui/react-components";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./ChatLayout.module.css";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { Model } from "../../api";

interface Props {
    examples: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showExamples: boolean;
    header: string;
    welcomeMessage: string;
    header_as_markdown: boolean;
    messages_description: string;
    onHeaderClick?: () => void;
    infoDrawerOpen?: boolean;
    onLLMSelectionChange: (nextLLM: string) => void;
    llmOptions?: Model[];
    defaultLLM?: string;
    actions?: ReactNode;
}

export const ChatLayout = ({
    examples,
    answers,
    input,
    showExamples,
    header,
    welcomeMessage,
    header_as_markdown,
    messages_description,
    llmOptions,
    defaultLLM,
    onLLMSelectionChange,
    onHeaderClick,
    infoDrawerOpen,
    actions
}: Props) => {
    const [isCompact, setIsCompact] = useState(() =>
        typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 640px)").matches : false
    );

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mq = window.matchMedia("(max-width: 640px)");
        const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return (
        <div className={styles.container} data-info-open={infoDrawerOpen ?? false}>
            <header className={styles.headerBar}>
                <div className={styles.leftGroup}>
                    <h1 className={styles.headerTitle}>
                        {onHeaderClick ? (
                            <Button appearance="transparent" className={styles.headerTitleButton} onClick={onHeaderClick}>
                                {header}
                            </Button>
                        ) : (
                            header
                        )}
                    </h1>
                </div>

                <div className={styles.controlsContainer}>
                    {llmOptions && defaultLLM && onLLMSelectionChange && (
                        <div aria-label="LLM selector container" role="group">
                            <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={defaultLLM} options={llmOptions} compact={isCompact} />
                        </div>
                    )}
                    {actions}
                </div>
            </header>

            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <div className={styles.welcomeMessageContainer}>
                                {header_as_markdown ? (
                                    <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                        <div className={styles.answerText}>
                                            <Markdown remarkPlugins={[remarkGfm]}>{welcomeMessage}</Markdown>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className={styles.chatEmptyStateSubtitle}>{welcomeMessage}</h2>
                                )}
                            </div>
                            {examples}
                        </div>
                    ) : (
                        <ul className={styles.allChatMessages} aria-description={messages_description}>
                            {answers}
                        </ul>
                    )}
                    <div className={styles.chatInput}>{input}</div>
                </div>
            </div>
        </div>
    );
};
