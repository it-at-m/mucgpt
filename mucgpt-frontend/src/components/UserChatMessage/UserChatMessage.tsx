import styles from "./UserChatMessage.module.css";
import { MarkdownRenderer } from "../MarkdownRenderer/MarkdownRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";
import { Stack } from "@fluentui/react";
import { RollBackMessage } from "./RollbackMessage";

interface Props {
    message: string;
    onRollbackMessage?: () => void;
}

export const UserChatMessage = ({ message, onRollbackMessage: onRollbackMessage }: Props) => {
    return (
        <div className={styles.message}>
            <Stack horizontal horizontalAlign="space-between">
                <ChatMessageIcon aria-hidden></ChatMessageIcon>
                {onRollbackMessage && <RollBackMessage onRollback={onRollbackMessage} />}
            </Stack>
            <div className={styles.answerText}>
                <MarkdownRenderer>{message}</MarkdownRenderer>
            </div>
        </div>
    );
};
