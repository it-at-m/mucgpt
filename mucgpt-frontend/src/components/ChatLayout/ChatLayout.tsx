import { ReactNode } from "react";
import styles from "./ChatLayout.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { Model } from "../../api";
import { Button } from "@fluentui/react-components";
import { ChatAdd24Regular, ChevronDoubleRight20Regular } from "@fluentui/react-icons";

export type SidebarSizes = "small" | "medium" | "large" | "full_width" | "none";

interface Props {
    sidebar: ReactNode;
    examples: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showExamples: boolean;
    header: string;
    header_as_markdown: boolean;
    messages_description: string;
    size: SidebarSizes;
    onToggleMinimized?: () => void;
    // LLM Selector props
    onLLMSelectionChange: (nextLLM: string) => void;
    clearChat: () => void;
    clearChatDisabled: boolean;
    llmOptions?: Model[];
    defaultLLM?: string;
}

export const ChatLayout = ({
    sidebar,
    examples,
    answers,
    input,
    showExamples,
    header,
    header_as_markdown,
    messages_description,
    size,
    llmOptions,
    defaultLLM,
    onLLMSelectionChange,
    onToggleMinimized,
    clearChat,
    clearChatDisabled
}: Props) => {
    const sidebarWidth = { small: "200px", medium: "300px", large: "460px", full_width: "80%", none: "0px" }[size];
    return (
        <div className={styles.container} style={{ "--sidebarWidth": sidebarWidth } as React.CSSProperties}>
            <aside hidden={size === "none"} className={styles.sidebar}>
                {sidebar}
            </aside>
            <div hidden={size !== "none"} className={styles.sidebarOpener}>
                <Button appearance="subtle" onClick={onToggleMinimized}>
                    <ChevronDoubleRight20Regular />
                </Button>
                <Button disabled={clearChatDisabled} appearance="subtle" onClick={clearChat}>
                    <ChatAdd24Regular />
                </Button>
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                {header_as_markdown ? (
                                    <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                        <div className={styles.answerText}>
                                            <Markdown remarkPlugins={[remarkGfm]}>{header}</Markdown>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className={styles.chatEmptyStateSubtitle}> {header}</h2>
                                )}
                                {llmOptions && defaultLLM && onLLMSelectionChange && (
                                    <div>
                                        <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={defaultLLM} options={llmOptions} />
                                    </div>
                                )}
                            </div>
                            {examples}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 0" }}>
                                {llmOptions && defaultLLM && onLLMSelectionChange && (
                                    <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={defaultLLM} options={llmOptions} />
                                )}
                            </div>
                            <ul className={styles.allChatMessages} aria-description={messages_description}>
                                {answers}
                            </ul>
                        </>
                    )}
                    <div className={styles.chatInput}>{input}</div>
                </div>
            </div>
        </div>
    );
};
