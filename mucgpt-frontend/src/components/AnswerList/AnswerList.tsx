import React, { CSSProperties, ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChatTurnComponent } from "../ChatTurnComponent/ChatTurnComponent";
import { UserChatMessage } from "../UserChatMessage";
import { AnswerLoading } from "../Answer/AnswerLoading";
import { AnswerError } from "../Answer/AnswerError";
import { ChatMessage } from "../../pages/chat/Chat";
import { FollowUpActionModel } from "../FollowUpAction";
import type { RunActivity } from "../../utils/agUiActivity";
import { findScrollContainer, scrollIntoNearestContainer } from "../../utils/scrollIntoNearestContainer";

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
    /** Live AG-UI run activity shown in the loading indicator. */
    loadingActivity?: RunActivity;
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
    lastAnswerRef,
    loadingActivity
}: Props) => {
    const { t } = useTranslation();

    const loadingTurnRef = useRef<HTMLDivElement | null>(null);

    // The turn sent in this session reserves one viewport of height, so it can be
    // scrolled to the top of the list with room for the streamed answer below it.
    // It is the loading turn while loading and the finished answer at the same index afterwards.
    const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null);
    const [viewportHeight, setViewportHeight] = useState(0);

    useLayoutEffect(() => {
        if (isLoading) {
            setActiveTurnIndex(answers.length);
        } else if (activeTurnIndex !== null && answers.length !== activeTurnIndex && answers.length !== activeTurnIndex + 1) {
            // Another chat was opened or the history was rolled back.
            setActiveTurnIndex(null);
        }
    }, [isLoading, answers.length, activeTurnIndex]);

    useLayoutEffect(() => {
        const container = activeTurnIndex !== null && chatMessageStreamEnd.current ? findScrollContainer(chatMessageStreamEnd.current) : null;
        if (!container) return;

        const measure = () => {
            const { paddingTop, paddingBottom } = getComputedStyle(container);
            setViewportHeight(container.clientHeight - (parseFloat(paddingTop) || 0) - (parseFloat(paddingBottom) || 0));
        };
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [activeTurnIndex, chatMessageStreamEnd]);

    const activeTurnStyle = useMemo<CSSProperties | undefined>(
        () => (viewportHeight > 0 ? { minHeight: `calc(${viewportHeight}px - var(--chatTurnScrollMargin, 0px))` } : undefined),
        [viewportHeight]
    );

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
                scrollIntoNearestContainer(loadingTurnRef.current, { block: "start" });
            } else {
                scrollIntoNearestContainer(chatMessageStreamEnd.current);
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
                            style={index === activeTurnIndex ? activeTurnStyle : undefined}
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
                        style={activeTurnStyle}
                        usermsg={<UserChatMessage message={lastQuestionRef.current} />}
                        usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                        assistantmsg={<AnswerLoading activity={loadingActivity} />}
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
        chatMessageStreamEnd,
        loadingActivity,
        activeTurnIndex,
        activeTurnStyle
    ]);

    return answerList;
};
