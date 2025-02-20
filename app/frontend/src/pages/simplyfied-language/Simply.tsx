import { useRef, useState, useEffect, useContext, ReactNode } from "react";

import { AskResponse, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SIMPLY_STORE } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ChatMessage } from "../chat/Chat";
import styles from "./Simply.module.css";

type SimplyMessage = DBMessage<AskResponse>;

const Simply = () => {
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<SimplyMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const storageService: StorageService<AskResponse, {}> = new StorageService<AskResponse, {}>(SIMPLY_STORE, active_chat);

    const clearChat = handleDeleteChat(lastQuestionRef, error, setError, storageService, setAnswers, setActiveChat);
    const onRollbackMessage = handleRollback(storageService, setAnswers, lastQuestionRef, setQuestion);

    useEffect(() => {
        setupStore(error, setError, setIsLoading, storageService, setAnswers, answers, lastQuestionRef, setActiveChat);
    }, []);

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };

    const makeApiRequest = async (question: string) => {
        error && setError(undefined);
        lastQuestionRef.current = question;
        setIsLoading(true);
        try {
            const request: SimplyRequest = {
                topic: question,
                model: LLM.llm_name,
                temperature: 0,
            };
            const parsedResponse: SimplyResponse = await simplyApi(request);
            const askResponse: AskResponse = { answer: parsedResponse.content, error: parsedResponse.error };
            const completeAnswer: SimplyMessage = { user: question, response: askResponse };

            setAnswers([...answers, completeAnswer]);
            if (storageService.getActiveChatId()) await storageService.appendMessage(completeAnswer);
            else {
                const id = await storageService.create([completeAnswer], undefined);
                setActiveChat(id);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);


    const sidebar_actions = <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />;
    const sidebar = <Sidebar actions={sidebar_actions} content={<div className={styles.description}>{t("simply.plain_description")}</div>}></Sidebar>;

    const examplesComponent = <ExampleListSimply onExampleClicked={onExampleClicked} />;
    const inputComponent = (
        <QuestionInput
            clearOnSend
            placeholder={t("simply.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question)}
            tokens_used={0}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    );
    const answerList = (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer: ChatMessage, index: number) => {
                return <Answer key={index} answer={answer.response} setQuestion={question => setQuestion(question)} />;
            }}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoading}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    );
    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("chat.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Simply;
