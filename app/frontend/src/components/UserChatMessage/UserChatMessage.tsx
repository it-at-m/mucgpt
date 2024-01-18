import styles from "./UserChatMessage.module.css";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";

interface Props {
    message: string;
    token?: number;
}

export const UserChatMessage = ({ message, token }: Props) => {
    return (
        <div className={styles.container}>
            <div className={styles.message}>

                <ChatMessageIcon></ChatMessageIcon>
                <Markdown
                    className={styles.answerText}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    children={message}
                    components={{
                        "code": CodeBlockRenderer
                    }} />
            </div>
        </div>
    );
};
