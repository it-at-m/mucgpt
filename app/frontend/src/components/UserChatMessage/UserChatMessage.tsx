import styles from "./UserChatMessage.module.css";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw'
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";

interface Props {
    message: string;
}

export const UserChatMessage = ({ message }: Props) => {
    return (
        <div className={styles.container}>
            <div className={styles.message}>          
                 <Markdown 
                    className={styles.answerText}
                    remarkPlugins={[remarkGfm]} 
                    rehypePlugins={[rehypeRaw]}
                    children={message}
                    components={{
                        "code": CodeBlockRenderer
                      }}/>
            </div>
        </div>
    );
};
