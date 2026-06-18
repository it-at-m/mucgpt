import styles from "./UserChatMessage.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";
import { RollBackMessage } from "./RollbackMessage";

interface Props {
    message: string;
    onRollbackMessage?: () => void;
}

export const UserChatMessage = ({ message, onRollbackMessage: onRollbackMessage }: Props) => {
    return (
        <div className={styles.message}>
            <div className={styles.messageHeader}>
                <ChatMessageIcon aria-hidden></ChatMessageIcon>
                {onRollbackMessage && <RollBackMessage onRollback={onRollbackMessage} />}
            </div>
            <div className={styles.answerText}>
                <MarkdownRenderer>{message}</MarkdownRenderer>
            </div>
        </div>
    );
};
