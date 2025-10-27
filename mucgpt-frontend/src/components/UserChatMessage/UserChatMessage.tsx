import styles from "./UserChatMessage.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";
import { Stack } from "@fluentui/react";
import { RollBackMessage } from "./RollbackMessage";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import rehypeExternalLinks from "rehype-external-links";

interface Props {
    message: string;
    onRollbackMessage?: () => void;
}

export const UserChatMessage = ({ message, onRollbackMessage: onRollbackMessage }: Props) => {
    const remarkMathOptions = {
        singleDollarTextMath: false
    };
    const rehypeKatexOptions = {
        output: "mathml"
    };
    const rehypeExternalLinksOptions = {
        target: "_blank",
        rel: ["nofollow", "noopener", "noreferrer"]
    };
    return (
        <div className={styles.message}>
            <Stack horizontal horizontalAlign="space-between">
                <ChatMessageIcon aria-hidden></ChatMessageIcon>
                {onRollbackMessage && <RollBackMessage onRollback={onRollbackMessage} />}
            </Stack>
            <div className={styles.answerText}>
                <Markdown
                    remarkPlugins={[[remarkMath, remarkMathOptions], remarkGfm]}
                    rehypePlugins={[[rehypeKatex, rehypeKatexOptions], [rehypeExternalLinks, rehypeExternalLinksOptions]]}
                    components={{
                        code: CodeBlockRenderer
                    }}
                >
                    {message}
                </Markdown>
            </div>
        </div>
    );
};
