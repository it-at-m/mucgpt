import styles from "./UserChatMessage.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";
import { Stack } from "@fluentui/react";
import { RollBackMessage } from "./RollbackMessage";

interface Props {
    message: string;
    onRollbackMessage: () => void;
}

export const UserChatMessage = ({ message, onRollbackMessage: onRollbackMessage }: Props) => {
    return (
        <div className={styles.message}>
            <Stack horizontal horizontalAlign="space-between">
                <ChatMessageIcon aria-hidden></ChatMessageIcon>
                <RollBackMessage onRollback={onRollbackMessage} />
            </Stack>
            <Markdown
                className={styles.answerText}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    code: CodeBlockRenderer
                }}
            >
                {message}
            </Markdown>
        </div>
    );
};
