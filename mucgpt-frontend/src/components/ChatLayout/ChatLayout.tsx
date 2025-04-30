import { ReactNode } from "react";
import styles from "./ChatLayout.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

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
}

export const ChatLayout = ({ sidebar: sidebar, examples, answers, input, showExamples, header, header_as_markdown, messages_description, size }: Props) => {
    const sidebarWidth = { small: "200px", medium: "300px", large: "460px", full_width: "80%", none: "0px" }[size];
    return (
        <div className={styles.container} style={{ "--sidebarWidth": sidebarWidth } as React.CSSProperties}>
            <aside className={styles.sidebar} style={size != "none" ? { borderRight: "1px solid" } : {}}>
                {sidebar}
            </aside>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer} style={size == "none" ? { marginLeft: "35px" } : {}}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            {header_as_markdown ? (
                                <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                    <Markdown className={styles.answerText} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {header}
                                    </Markdown>
                                </div>
                            ) : (
                                <h2 className={styles.chatEmptyStateSubtitle}> {header}</h2>
                            )}
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
