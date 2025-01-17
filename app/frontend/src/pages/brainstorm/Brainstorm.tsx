import { useRef, useState, useEffect, useContext } from "react";

import { AskResponse, brainstormApi, BrainstormRequest } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListBrainstorm } from "../../components/Example/ExampleListBrainstorm";
import { Mindmap } from "../../components/Mindmap";
import { useTranslation } from "react-i18next";
import { ChatStorageService } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { Sidebar } from "../../components/Sidebar/Sidebar";

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

    const storageService: ChatStorageService = new ChatStorageService({ db_name: "MUCGPT-BRAINSTORMING", objectStore_name: "brainstorming", db_version: 2 });

    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        storageService.checkStructurOfDB();
        storageService.getHighestKeyInDB().then(highestKey => {
            setIdCounter(highestKey + 1);
            setCurrentId(highestKey);
        });
        storageService.getStartDataFromDB(currentId).then(stored => {
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
            storageService.saveToDB([question, result], currentId, idCounter, setCurrentId, setIdCounter);
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
        storageService.deleteChatFromDB(currentId, setAnswers, true, lastQuestionRef);
    };

    const onRollbackMessage = (message: string) => {
        return async () => {
            let last;
            while (answers.length) {
                await storageService.popLastMessageInDB(currentId);
                last = answers.pop();
                setAnswers(answers);
                if (last && last[0] == message) {
                    break;
                }
            }
            if (answers.length == 0) {
                storageService.deleteChatFromDB(currentId, setAnswers, true, lastQuestionRef);
                storageService.deleteChatFromDB(0, setAnswers, false, lastQuestionRef);
            }
            if (last)
                lastQuestionRef.current = last[0];
            setQuestion(message);
        }
    };


    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const sidebar_content = <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />;
    const sidebar_actions = <></>;
    const sidebar = <Sidebar actions={sidebar_content} content={sidebar_actions}></Sidebar>;
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

    const answerList = (
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={
                        <UserChatMessage
                            message={answer[0]}
                            onRollbackMessage={onRollbackMessage(answer[0])}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={<Mindmap markdown={answer[1].answer}></Mindmap>}
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            onRollbackMessage={onRollbackMessage(lastQuestionRef.current)}
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
            ) : (
                <div></div>
            )}
            <div ref={chatMessageStreamEnd} />
        </>
    );
    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("brainstorm.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Brainstorm;
