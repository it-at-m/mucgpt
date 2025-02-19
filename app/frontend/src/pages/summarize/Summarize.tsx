import { useRef, useState, useEffect, useContext } from "react";

import { sumApi, SumarizeMessage, SumRequest, SumResponse } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ExampleListSum } from "../../components/Example/ExampleListSum";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { SumAnswer } from "../../components/SumAnswer";
import { SumInput } from "../../components/SumInput";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SummarizeSidebar } from "../../components/SummarizeSidebar/SummarizeSidebar";
import { SUMMARIZE_STORE } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { SumAnswerList } from "../../components/AnswerList/SumAnswerList";

const STORAGE_KEY_LEVEL_OF_DETAIL = "SUM_LEVEL_OF_DETAIL";

const Summarize = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const detaillevel_pref = (localStorage.getItem(STORAGE_KEY_LEVEL_OF_DETAIL) as "long" | "medium" | "short") || "short";

    const [detaillevel, setDetaillevel] = useState<"long" | "medium" | "short">(detaillevel_pref);

    const [answers, setAnswers] = useState<SumarizeMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const storageService: StorageService<SumResponse, {}> = new StorageService<SumResponse, {}>(SUMMARIZE_STORE, active_chat);

    const clearChat = handleDeleteChat(lastQuestionRef, error, setError, storageService, setAnswers, setActiveChat);
    const onRollbackMessage = handleRollback(storageService, setAnswers, lastQuestionRef, setQuestion);

    useEffect(() => {
        setupStore(error, setError, setIsLoading, storageService, setAnswers, answers, lastQuestionRef, setActiveChat);
    }, []);

    const onExampleClicked = (example: string) => {
        makeApiRequest(example, undefined);
    };

    const makeApiRequest = async (question: string, file?: File) => {
        let questionText = file ? file.name : question;
        lastQuestionRef.current = questionText;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: SumRequest = {
                text: questionText,
                detaillevel: detaillevel,
                language: language,
                model: LLM.llm_name
            };
            const result = await sumApi(request, file);
            const completeAnswer: SumarizeMessage = { user: questionText, response: result };

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

    const onDetaillevelChanged = (newValue: string) => {
        setDetaillevel(newValue as "long" | "medium" | "short");
        localStorage.setItem(STORAGE_KEY_LEVEL_OF_DETAIL, newValue);
    };

    const examplesComponent = <ExampleListSum onExampleClicked={onExampleClicked} />;
    const sidebar_actions = <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />;
    const sidebar_content = <SummarizeSidebar onDetaillevelChanged={onDetaillevelChanged} detaillevel_pref={detaillevel_pref} />;
    const sidebar = <Sidebar actions={sidebar_actions} content={sidebar_content}></Sidebar>;

    const answerList = (
        <SumAnswerList
            answers={answers}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoading}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    );
    const inputComponent = (
        <SumInput
            clearOnSend
            placeholder={t("sum.prompt")}
            disabled={isLoading}
            onSend={(question, file) => makeApiRequest(question, file)}
            tokens_used={0}
            token_limit_tracking={false}
            question={question}
            setQuestion={setQuestion}
        />
    );
    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("sum.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Summarize;
