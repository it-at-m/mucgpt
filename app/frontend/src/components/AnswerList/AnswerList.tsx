import { ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatTurnComponent } from "../ChatTurnComponent/ChatTurnComponent";
import { UserChatMessage } from "../UserChatMessage";
import { AnswerLoading } from "../Answer/AnswerLoading";
import { AnswerError } from "../Answer/AnswerError";
import { ChatMessage } from "../../pages/chat/Chat";
import { QuickPrompt } from "../QuickPrompt/QuickPrompt";

interface Props {
    answers: ChatMessage[];
    regularBotMsg: (answer: ChatMessage, index: number, quickPrompts?: QuickPrompt[]) => ReactNode;
    onRollbackMessage: (index: number) => void;
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
                    usermsg={<UserChatMessage message={answer.user} onRollbackMessage={() => onRollbackMessage(index)} />}
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={regularBotMsg(answer, index)}
                ></ChatTurnComponent>
            ))
        );
    }, [answers, isLoading]);

    const answerList = useMemo(() => {
        return (
            <>
                {answersComponent}
                {error || isLoading ? (
                    <ChatTurnComponent
                        usermsg={<UserChatMessage message={lastQuestionRef.current} />}
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
    }, [answers, isLoading, error, makeApiRequest, chatMessageStreamEnd, lastQuestionRef, t, answersComponent]);

    return answerList;
};
