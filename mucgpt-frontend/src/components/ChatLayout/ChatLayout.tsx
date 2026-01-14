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

            <div className={styles.llmContainer}>
                <div hidden={size !== "none"} className={styles.sidebarOpener} role="toolbar" aria-label="Sidebar controls">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Button appearance="subtle" onClick={onToggleMinimized} aria-label="Toggle sidebar">
                            <ChevronDoubleRight20Regular />
                        </Button>

                        <Button disabled={clearChatDisabled} appearance="subtle" onClick={clearChat} aria-label="New chat">
                            <ChatAdd24Regular />
                        </Button>
                    </div>
                </div>

                {llmOptions && defaultLLM && onLLMSelectionChange && (
                    <div aria-label="LLM selector container">
                        <LLMSelector onSelectionChange={onLLMSelectionChange} defaultLLM={defaultLLM} options={llmOptions} />
                    </div>
                )}
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
                            </div>
                            {examples}
                        </div>
                    ) : (
                        <>
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
