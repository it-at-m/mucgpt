import { useRef, useState, useEffect, useContext, useReducer, useMemo, useCallback } from "react";

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
import { getChatReducer, handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList, ExampleModel } from "../../components/Example";
import { ChatMessage, ChatOptions } from "../chat/Chat";


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
    // getChatReducer function to handle chat state changes
    const chatReducer = getChatReducer<ChatOptions>()

    // Zusammenhängende States mit useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        temperature: 0.7,
        max_output_tokens: 4000,
        systemPrompt: "",
        active_chat: undefined,
        allChats: [],
        totalTokens: 0
    });

    // Destrukturierung für einfacheren Zugriff
    const {
        answers,
        temperature,
        max_output_tokens,
        systemPrompt,
        active_chat,
        allChats,
        totalTokens
    } = chatState;

    // Context
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const activeChatRef = useRef(active_chat);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");

    // StorageService
    const storageService: StorageService<AskResponse, {}> = new StorageService<AskResponse, {}>(BRAINSTORM_STORE);

    // useEffect to update the active chat reference whenever the active chat changes
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // useEffect to set up the store and load the initial data
    useEffect(() => {
        setupStore(error, setError, setIsLoading, storageService, (answers: ChatMessage[]) => dispatch({ type: 'SET_ANSWERS', payload: answers }), answers, lastQuestionRef, (id: string | undefined) => dispatch({ type: 'SET_ACTIVE_CHAT', payload: id }));
    }, []);

    // clearChat function to delete the current chat and reset the state
    const clearChat = handleDeleteChat(activeChatRef.current, lastQuestionRef, error, setError, storageService, (answers: ChatMessage[]) => dispatch({ type: 'SET_ANSWERS', payload: answers }), (id: string | undefined) => dispatch({ type: 'SET_ACTIVE_CHAT', payload: id }));

    // onRollbackMessage function to handle the rollback of messages in the chat
    const onRollbackMessage = (index: number) => {
        if (!activeChatRef.current) return;
        handleRollback(index, activeChatRef.current, dispatch, storageService, lastQuestionRef, setQuestion, clearChat, undefined);
    }

    // makeApiRequest function to call the API and handle the response
    const makeApiRequest = useCallback(async (question: string) => {
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

            dispatch({ type: "SET_ANSWERS", payload: [...answers, completeAnswer] });
            if (activeChatRef.current) await storageService.appendMessage(completeAnswer, activeChatRef.current);
            else {
                const id = await storageService.create([completeAnswer], undefined);
                dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    }, [lastQuestionRef.current, error, language, LLM, storageService, answers, dispatch, brainstormApi, activeChatRef.current]);

    // onClick handler for example list
    const onExampleClicked = useCallback((example: string) => {
        makeApiRequest(example);
    }, [makeApiRequest]);

    // Scroll to the bottom of the chat when a new message is added
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    // Sidebar content
    const sidebar_content = useMemo(() => (<ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />), [clearChat, isLoading, lastQuestionRef.current]);

    // Sidebar component
    const sidebar = useMemo(() => (<Sidebar actions={sidebar_content} content={<></>}></Sidebar>), [sidebar_content]);

    // TextInput component
    const inputComponent = useMemo(() => (
        <QuestionInput
            clearOnSend
            placeholder={t("brainstorm.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question)}
            tokens_used={0}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    ), [question, isLoading, makeApiRequest]);

    // ExampleList component
    const examplesComponent = useMemo(() => (<ExampleList examples={EXAMPLES} onExampleClicked={onExampleClicked} />), [onExampleClicked]);

    // AnswerList component
    const answerList = useMemo(() => (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer, _) => {
                return <Mindmap markdown={answer.response.answer} />;
            }}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoading}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    ), [answers, isLoading, error, makeApiRequest, onRollbackMessage, chatMessageStreamEnd, lastQuestionRef]);

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
