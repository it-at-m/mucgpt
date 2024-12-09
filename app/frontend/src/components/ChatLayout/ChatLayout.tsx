import { ReactNode } from "react";
import styles from "./ChatLayout.module.css";

interface Props {
    commands: ReactNode[];
    examples: ReactNode;
    answers: ReactNode;
    input: ReactNode;
    showExamples: boolean;
    header: string;
    messages_description: string;
}

export const ChatLayout = ({ commands, examples, answers, input, showExamples, header, messages_description }: Props) => {
    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                {commands.map((command, index) => (
                    <div key={index} className={styles.command}>
                        {command}
                    </div>
                ))}
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {showExamples ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{header}</h2>
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
