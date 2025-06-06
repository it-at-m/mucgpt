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
    onRollbackError?: () => void;
}

export const AnswerList = ({ answers, regularBotMsg, onRollbackMessage, isLoading, error, makeApiRequest, chatMessageStreamEnd, lastQuestionRef, onRollbackError }: Props) => {
    const { t } = useTranslation();

    const [answersComponent, setAnswersComponent] = useState<JSX.Element[]>([]);

    useEffect(() => {
        let shownAnswers = answers;
        if (error) {
            shownAnswers = answers.slice(0, -1); // Exclude the last answer if there is an error
        }
        setAnswersComponent(
            shownAnswers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={<UserChatMessage message={answer.user} onRollbackMessage={() => onRollbackMessage(index - 1)} />}
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={regularBotMsg(answer, index)}
                ></ChatTurnComponent>
            ))
        );
    }, [answers, isLoading, error]);

    const answerList = useMemo(() => {
        return (
            <>
                {answersComponent}
                {error ? (
                    <ChatTurnComponent
                        usermsg={<UserChatMessage message={lastQuestionRef.current} onRollbackMessage={onRollbackError} />}
                        usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                        botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                        botmsg={<AnswerError error={error.toString()} onRetry={makeApiRequest} />}
                    ></ChatTurnComponent>
                ) : (
                    <div></div>
                )}
                {isLoading ? (
                    <ChatTurnComponent
                        usermsg={<UserChatMessage message={lastQuestionRef.current} />}
                        usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                        botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                        botmsg={<AnswerLoading text={t("chat.answer_loading")} />}
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
