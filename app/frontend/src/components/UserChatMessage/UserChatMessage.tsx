import styles from "./UserChatMessage.module.css";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { ChatMessageIcon } from "./ChatMessageIcon";
import { Stack } from "@fluentui/react";
import { indexedDBStorage } from "../../service/storage";
import { RollBackMessage } from "./RollbackMessage";
import { MutableRefObject } from "react";

interface Props {
    message: string;
    token?: number;
    setQuestion: (question: string) => void;
    answers: any[];
    setAnswers: (answers: any[]) => void;
    storage: indexedDBStorage;
    lastQuestionRef: MutableRefObject<string>;
    current_id: number;
    is_bot: boolean;
}

export const UserChatMessage = ({ message, token, setQuestion, answers, setAnswers, storage, lastQuestionRef, current_id, is_bot }: Props) => {
    return (
        <div className={styles.message}>
            <Stack horizontal horizontalAlign="space-between">
                <ChatMessageIcon aria-hidden></ChatMessageIcon>
                <RollBackMessage
                    message={message}
                    setQuestion={setQuestion}
                    answers={answers}
                    setAnswers={setAnswers}
                    storage={storage}
                    lastQuestionRef={lastQuestionRef}
                    current_id={current_id}
                    is_bot={is_bot}
                />
            </Stack>
            <Markdown
                className={styles.answerText}
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                children={message}
                components={{
                    code: CodeBlockRenderer
                }}
            />
        </div>
    );
};
