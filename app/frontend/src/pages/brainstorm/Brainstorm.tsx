import { useRef, useState, useEffect, useContext } from "react";

import { AskResponse, brainstormApi, BrainstormRequest } from "../../api";
import { QuestionInput } from "../../components/QuestionInput";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { Mindmap } from "../../components/Mindmap";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { BRAINSTORM_STORE } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList, ExampleModel } from "../../components/Example";

type BrainstormMessage = DBMessage<AskResponse>;

const EXAMPLES: ExampleModel[] = [
    {
        text: "Maßnahmen für Städte um besser mit dem Klimawandel zurechtzukommen",
        value: "Maßnahmen für Städte um besser mit dem Klimawandel zurechtzukommen"
    },
    {
        text: "Gründe in München zu wohnen",
        value: "Gründe in München zu wohnen"
    },
    {
        text: "Wie bereite ich mich am Besten fürs Oktoberfest vor",
        value: "Wie bereite ich mich am Besten fürs Oktoberfest vor"
    }
];

const Brainstorm = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<BrainstormMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const storageService: StorageService<AskResponse, {}> = new StorageService<AskResponse, {}>(BRAINSTORM_STORE, active_chat);

    const clearChat = handleDeleteChat(lastQuestionRef, error, setError, storageService, setAnswers, setActiveChat);
    const onRollbackMessage = handleRollback(storageService, setAnswers, lastQuestionRef, setQuestion);

    useEffect(() => {
        setupStore(error, setError, setIsLoading, storageService, setAnswers, answers, lastQuestionRef, setActiveChat);
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
            const completeAnswer: BrainstormMessage = { user: question, response: result };

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
    const examplesComponent = <ExampleList examples={EXAMPLES} onExampleClicked={onExampleClicked} />;

    const answerList = (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer, index) => {
                return <Mindmap markdown={answer.response.answer} />;
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
            header={t("brainstorm.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Brainstorm;
