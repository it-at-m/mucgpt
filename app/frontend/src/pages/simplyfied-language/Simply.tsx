import { useRef, useState, useEffect, useContext, ReactNode } from "react";

import { AskResponse, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SimplySidebar } from "../../components/SimplySidebar/SimplySidebar";
import { SIMPLY_STORE, STORAGE_KEYS_SIMPLY } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ChatMessage } from "../chat/Chat";

type SimplyMessage = DBMessage<AskResponse>;

const Simply = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const outputType_pref = localStorage.getItem(STORAGE_KEYS_SIMPLY.SIMPLY_OUTPUT_TYPE) || "plain";
    const [outputType, setOutputType] = useState<string>(outputType_pref);

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
                output_type: outputType
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

    const onOutputTypeChanged = (newValue: string) => {
        setOutputType(newValue);
        localStorage.setItem(STORAGE_KEYS_SIMPLY.SIMPLY_OUTPUT_TYPE, newValue);
    };

    const sidebar_actions = <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />;
    const sidebar_content = <SimplySidebar onOutputTypeChanged={onOutputTypeChanged} outputType={outputType} />;
    const sidebar = <Sidebar actions={sidebar_actions} content={sidebar_content}></Sidebar>;

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
