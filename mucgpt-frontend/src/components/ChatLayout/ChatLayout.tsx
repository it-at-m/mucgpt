import { ReactNode, CSSProperties, useEffect, useState } from "react";
import styles from "./ChatLayout.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { Model } from "../../api";
import { Button } from "@fluentui/react-components";
import { ChevronDoubleRight20Regular, ChevronDoubleLeft20Regular } from "@fluentui/react-icons";

export type SidebarSizes = "small" | "medium" | "large" | "full_width" | "none";

interface Props {
    sidebar: ReactNode;
    examples: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showExamples: boolean;
    header: string; // Used for Top Bar Title
    welcomeMessage: string; // Used for Empty State Title
    header_as_markdown: boolean;
    messages_description: string;
    size: SidebarSizes;
    onToggleMinimized?: () => void;
    onHeaderClick?: () => void;
    infoDrawerOpen?: boolean;
    // LLM Selector props
    onLLMSelectionChange: (nextLLM: string) => void;
    llmOptions?: Model[];
    defaultLLM?: string;
    actions?: ReactNode;
}

export const ChatLayout = ({
    sidebar,
    examples,
    answers,
    input,
    showExamples,
    header,
    welcomeMessage,
    header_as_markdown,
    messages_description,
    size,
    llmOptions,
    defaultLLM,
    onLLMSelectionChange,
    onToggleMinimized,
    onHeaderClick,
    infoDrawerOpen,
    actions
}: Props) => {
    const infoDrawerWidth = infoDrawerOpen ? "400px" : "0px";
    const sidebarWidth = { small: "200px", medium: "300px", large: "460px", full_width: "80%", none: "0px" }[size];

    const [isCompact, setIsCompact] = useState(() => window.matchMedia("(max-width: 640px)").matches);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 640px)");
        const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    return (
        <div
            className={styles.container}
            style={{ "--sidebarWidth": sidebarWidth } as CSSProperties}
            data-info-open={infoDrawerOpen ?? false}
        >
            <aside hidden={size === "none"} className={styles.sidebar}>
                {sidebar}
            </aside>

            <header className={styles.headerBar}>
                <div className={styles.leftGroup}>
                    <div className={styles.sidebarOpener} role="group" aria-label="Sidebar controls">
                        <Button appearance="subtle" size="small" onClick={onToggleMinimized} aria-label={size === "none" ? "Open sidebar" : "Close sidebar"}>
                            {size === "none" ? <ChevronDoubleRight20Regular /> : <ChevronDoubleLeft20Regular />}
                        </Button>
                    </div>
                    <h1
                        className={onHeaderClick ? `${styles.headerTitle} ${styles.headerTitleClickable}` : styles.headerTitle}
                        onClick={onHeaderClick}
                    >
                        {header}
                    </h1>
                </div>

                <div className={styles.controlsContainer}>
                    {llmOptions && defaultLLM && onLLMSelectionChange && (
                        <div aria-label="LLM selector container" role="group">
                            <LLMSelector
                                onSelectionChange={onLLMSelectionChange}
                                defaultLLM={defaultLLM}
                                options={llmOptions}
                                compact={isCompact}
                            />
                        </div>
                    )}
                    {actions}
                </div>
            </header>

            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                {header_as_markdown ? (
                                    <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                        <div className={styles.answerText}>
                                            <Markdown remarkPlugins={[remarkGfm]}>{welcomeMessage}</Markdown>
                                        </div>
                                    </div>
                                ) : (
                                    <h2 className={styles.chatEmptyStateSubtitle}> {welcomeMessage}</h2>
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
