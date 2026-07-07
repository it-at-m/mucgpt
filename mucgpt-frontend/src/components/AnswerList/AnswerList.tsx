import React, { ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChatTurnComponent } from "../ChatTurnComponent/ChatTurnComponent";
import { UserChatMessage } from "../UserChatMessage";
import { AnswerLoading } from "../Answer/AnswerLoading";
import { AnswerError } from "../Answer/AnswerError";
import { ChatMessage } from "../../pages/chat/Chat";
import { FollowUpActionModel } from "../FollowUpAction";

interface Props {
    answers: ChatMessage[];
    regularAssistantMsg: (answer: ChatMessage, index: number, followUpActions?: FollowUpActionModel[]) => ReactNode;
    onRollbackMessage?: (index: number) => void;
    isLoading: boolean;
    error: unknown;
    makeApiRequest: () => void;
    chatMessageStreamEnd: React.MutableRefObject<HTMLDivElement | null>;
    lastQuestionRef: React.MutableRefObject<string>;
    onRollbackError?: () => void;
    lastAnswerRef?: React.Ref<HTMLDivElement>;
}

export const AnswerList = ({
    answers,
    regularAssistantMsg,
    onRollbackMessage,
    isLoading,
    error,
    makeApiRequest,
    chatMessageStreamEnd,
    lastQuestionRef,
    onRollbackError,
    lastAnswerRef
}: Props) => {
    const { t } = useTranslation();

    const loadingTurnRef = useRef<HTMLDivElement | null>(null);

    const shownAnswers = useMemo(() => {
        if (error) {
            return answers.slice(0, -1);
        }
        return answers;
    }, [answers, error]);

    useLayoutEffect(() => {
        if (!isLoading) {
            return;
        }

        requestAnimationFrame(() => {
            if (loadingTurnRef.current) {
                loadingTurnRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
            }
        });
    }, [isLoading, shownAnswers.length, chatMessageStreamEnd]);

    const answerList = useMemo(() => {
        return (
            <>
                {shownAnswers.map((answer, index) => {
                    const isLastAnswer = index === shownAnswers.length - 1;
                    return (
                        <ChatTurnComponent
                            key={index}
                            innerRef={isLastAnswer ? lastAnswerRef : undefined}
                            usermsg={
                                <UserChatMessage message={answer.user} onRollbackMessage={onRollbackMessage ? () => onRollbackMessage(index - 1) : undefined} />
                            }
                            usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                            assistantmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                            assistantmsg={regularAssistantMsg(answer, index)}
                        ></ChatTurnComponent>
                    );
                })}
                {error ? (
                    <ChatTurnComponent
                        usermsg={<UserChatMessage message={lastQuestionRef.current} onRollbackMessage={onRollbackError} />}
                        usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsg={<AnswerError error={error.toString()} onRetry={makeApiRequest} />}
                    ></ChatTurnComponent>
                ) : (
                    <div></div>
                )}
                {isLoading ? (
                    <ChatTurnComponent
                        innerRef={loadingTurnRef}
                        usermsg={<UserChatMessage message={lastQuestionRef.current} />}
                        usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsg={<AnswerLoading text={t("chat.answer_loading")} />}
                    ></ChatTurnComponent>
                ) : (
                    <div></div>
                )}
                <div ref={chatMessageStreamEnd} />
            </>
        );
    }, [
        shownAnswers,
        onRollbackMessage,
        lastAnswerRef,
        t,
        regularAssistantMsg,
        error,
        lastQuestionRef,
        onRollbackError,
        makeApiRequest,
        answers.length,
        isLoading,
        chatMessageStreamEnd
    ]);

    return answerList;
};
