import { ReactNode } from "react";
import styles from "./ChatLayout.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Props {
    sidebar: ReactNode;
    examples: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showExamples: boolean;
    header: string;
    header_as_markdown: boolean;
    messages_description: string;
}

export const ChatLayout = ({ sidebar: sidebar, examples, answers, input, showExamples, header, header_as_markdown, messages_description }: Props) => {
    return (
        <div className={styles.container}>
            <aside className={styles.sidebar}>
                {sidebar}
            </aside>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            {header_as_markdown ? (
                                <div className={styles.chatEmptyStateSubtitleMarkdown}>
                                    <Markdown
                                        className={styles.answerText}
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        children={header}
                                    ></Markdown>
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
