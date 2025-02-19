import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatTurnComponent } from "../ChatTurnComponent/ChatTurnComponent";
import { UserChatMessage } from "../UserChatMessage";
import { AnswerLoading } from "../Answer/AnswerLoading";
import { AnswerError } from "../Answer/AnswerError";
import { ChatMessage } from "../../pages/chat/Chat";

interface Props {
    answers: ChatMessage[];
    regularBotMsg: (answer: ChatMessage, index: number) => ReactNode;
    onRollbackMessage: (message: string) => () => void;
    isLoading: boolean;
    error: unknown;
    makeApiRequest: () => void;
    chatMessageStreamEnd: React.RefObject<HTMLDivElement>;
    lastQuestionRef: React.MutableRefObject<string>;
}

export const AnswerList = ({ answers, regularBotMsg, onRollbackMessage, isLoading, error, makeApiRequest, chatMessageStreamEnd, lastQuestionRef }: Props) => {
    const { t } = useTranslation();

    const [answersComponent, setAnswersComponent] = useState<JSX.Element[]>([]);

    useEffect(() => {
        setAnswersComponent(
            answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={<UserChatMessage message={answer.user} onRollbackMessage={onRollbackMessage(answer.user)} />}
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={regularBotMsg(answer, index)}
                ></ChatTurnComponent>
            ))
        );
    }, [answers, isLoading]);

    return (
        <>
            {answersComponent}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={<UserChatMessage message={lastQuestionRef.current} onRollbackMessage={onRollbackMessage(lastQuestionRef.current)} />}
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={t("chat.answer_loading")} />}
                            {error ? <AnswerError error={error.toString()} onRetry={makeApiRequest} /> : null}
                        </>
                    }
                ></ChatTurnComponent>
            ) : (
                <div></div>
            )}
            <div ref={chatMessageStreamEnd} />
        </>
    );
};
