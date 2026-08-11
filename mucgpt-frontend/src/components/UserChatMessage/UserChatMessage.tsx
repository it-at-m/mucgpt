import styles from "./UserChatMessage.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { RollBackMessage } from "./RollbackMessage";

interface Props {
    message: string;
    onRollbackMessage?: () => void;
}

export const UserChatMessage = ({ message, onRollbackMessage: onRollbackMessage }: Props) => {
    return (
        <div className={styles.messageWrapper}>
            <div className={styles.message}>
                <div className={styles.answerText}>
                    <MarkdownRenderer>{message}</MarkdownRenderer>
                </div>
            </div>
            {onRollbackMessage && (
                <div className={styles.messageActions}>
                    <RollBackMessage onRollback={onRollbackMessage} />
                </div>
            )}
        </div>
    );
};
