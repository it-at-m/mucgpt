import { useRef, useState, useEffect, useContext, ReactNode } from "react";

import { AskResponse, brainstormApi, BrainstormRequest } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListBrainstorm } from "../../components/Example/ExampleListBrainstorm";
import { Mindmap } from "../../components/Mindmap";
import { useTranslation } from "react-i18next";
import { checkStructurOfDB, deleteChatFromDB, getHighestKeyInDB, getStartDataFromDB, indexedDBStorage, saveToDB } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";

const Brainstorm = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);
    const [question, setQuestion] = useState<string>("");

    const storage: indexedDBStorage = { db_name: "MUCGPT-BRAINSTORMING", objectStore_name: "brainstorming", db_version: 2 };

    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        checkStructurOfDB(storage);
        getHighestKeyInDB(storage).then(highestKey => {
            setIdCounter(highestKey + 1);
            setCurrentId(highestKey);
        });
        getStartDataFromDB(storage, currentId).then(stored => {
            if (stored) {
                setAnswers([...answers.concat(stored.Data.Answers)]);
                lastQuestionRef.current = stored.Data.Answers[stored.Data.Answers.length - 1][0];
            }
        });
        setIsLoading(false);
    }, []);

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: BrainstormRequest = {
                topic: question,
                language: language,
                model: LLM.llm_name
            };
            const result = await brainstormApi(request);
            setAnswers([...answers, [question, result]]);
            saveToDB([question, result], storage, currentId, idCounter, setCurrentId, setIdCounter);
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        setAnswers([]);
        deleteChatFromDB(storage, currentId, setAnswers, true, lastQuestionRef);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const commands = [<ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />];
    const inputComponent = (
        <QuestionInput
            clearOnSend
            placeholder={t("brainstorm.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question)}
            tokens_used={0}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    );
    const examplesComponent = <ExampleListBrainstorm onExampleClicked={onExampleClicked} />;
    const answerList: ReactNode = (
        <>
            {answers.map((answer, index): ReactNode => (
                <ChatTurnComponent
                    key={index}
                    usermsg={
                        <UserChatMessage
                            message={answer[0]}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage}
                            lastQuestionRef={lastQuestionRef}
                            current_id={currentId}
                            is_bot={false}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={<Mindmap markdown={answer[1].answer}></Mindmap>}
                ></ChatTurnComponent>
            ))}
            {(isLoading || error) && (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage}
                            lastQuestionRef={lastQuestionRef}
                            current_id={currentId}
                            is_bot={false}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={t("brainstorm.answer_loading")} />}
                            {error ? <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} /> : null}
                        </>
                    }
                ></ChatTurnComponent>
            )}
            <div ref={chatMessageStreamEnd} />
        </>
    );
    return (
        <ChatLayout
            commands={commands}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("brainstorm.header")}
            messages_description={t("common.messages")}
        ></ChatLayout>
    );
};

export default Brainstorm;
