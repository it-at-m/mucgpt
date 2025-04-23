import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";

import { chatApi, AskResponse, countTokensAPI, Bot, ChatResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";

import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { BotsettingsDrawer } from "../../components/BotsettingsDrawer/BotsettingsDrawer";
import { ChatLayout, SidebarSizes } from "../../components/ChatLayout/ChatLayout";
import { ClearChatButton } from "../../components/ClearChatButton";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList } from "../../components/Example/ExampleList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { ChatOptions } from "../chat/Chat";
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowMinimize24Filled, ArrowMaximize24Filled } from "@fluentui/react-icons";
import { STORAGE_KEYS } from "../layout/LayoutHelper";

const BotChat = () => {
    // useReducer für den Chat-Status
    const chatReducer = getChatReducer<Bot>();
    // Combined states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        temperature: 0.7,
        max_output_tokens: 4000,
        systemPrompt: "",
        active_chat: undefined,
        allChats: [],
        totalTokens: 0
    });

    // Destructuring for easier access
    const { answers, temperature, max_output_tokens, systemPrompt, active_chat, allChats, totalTokens } = chatState;

    // References
    const activeChatRef = useRef(active_chat);
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);

    // useEffect für den Chat-Status
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Parameter from URL
    const { id } = useParams();
    const bot_id = id || "0";

    // Context
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const { quickPrompts, setQuickPrompts } = useContext(QuickPromptContext);

    const [error, setError] = useState<unknown>();
    const [sidebarSize, setSidebarWidth] = useState<SidebarSizes>("large");
    const [question, setQuestion] = useState<string>("");
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const [showSidebar, setShowSidebar] = useState<boolean>(
        localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) === null ? true : localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) == "true"
    );

    // StorageServices
    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const botChatStorage: StorageService<ChatResponse, Bot> = botStorageService.getChatStorageService();

    //config
    const [botConfig, setBotConfig] = useState<Bot>({
        title: "Titel",
        description: "Beschreibung",
        publish: false,
        max_output_tokens: LLM.max_output_tokens,
        system_message: "",
        temperature: 0.7,
        quick_prompts: [],
        examples: []
    });

    // useEffect to load the bot config and chat history
    useEffect(() => {
        if (bot_id) {
            error && setError(undefined);
            isLoadingRef.current = true;
            botStorageService
                .getBotConfig(bot_id)
                .then(bot => {
                    if (bot) {
                        setBotConfig(bot);
                        setQuickPrompts(bot.quick_prompts || []);
                    }
                    return botStorageService
                        .getNewestChatForBot(bot_id)
                        .then(existingChat => {
                            if (existingChat) {
                                const messages = existingChat.messages;
                                dispatch({ type: "SET_ANSWERS", payload: [...answers.concat(messages)] });
                                lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
                                dispatch({ type: "SET_ACTIVE_CHAT", payload: existingChat.id });
                            }
                        })
                        .then(() => {
                            return fetchHistory();
                        });
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        }
    }, []);
    // get History-Funktion
    const fetchHistory = useCallback(() => {
        return botStorageService.getAllChatForBot(bot_id).then(chats => {
            if (chats) dispatch({ type: "SET_ALL_CHATS", payload: chats });
        });
    }, [botStorageService, bot_id]);
    // deleteBot-Funktion
    const onDeleteBot = useCallback(async () => {
        await botStorageService.deleteConfigAndChatsForBot(bot_id);
        window.location.href = "/";
    }, [botStorageService, bot_id]);
    // callApi-Funktion
    const callApi = useCallback(
        async (question: string) => {
            lastQuestionRef.current = question;
            error && setError(undefined);
            isLoadingRef.current = true;

            const askResponse: AskResponse = {} as AskResponse;
            const options: ChatOptions = {
                system: systemPrompt ?? "",
                maxTokens: max_output_tokens,
                temperature: temperature
            };
            try {
                await makeApiRequest(
                    answers,
                    question,
                    dispatch,
                    chatApi,
                    LLM,
                    activeChatRef,
                    botChatStorage,
                    options,
                    askResponse,
                    chatMessageStreamEnd,
                    isLoadingRef,
                    fetchHistory,
                    bot_id
                );
            } catch (e) {
                setError(e);
            }
            isLoadingRef.current = false;
        },
        [
            lastQuestionRef.current,
            error,
            isLoadingRef.current,
            chatState,
            answers,
            dispatch,
            chatApi,
            LLM,
            activeChatRef,
            botChatStorage,
            chatMessageStreamEnd,
            fetchHistory
        ]
    );

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoadingRef.current]);
    // useEffect für die Tokenanzahl
    useEffect(() => {
        dispatch({
            type: "SET_TOTAL_TOKENS",
            payload:
                systemPromptTokens +
                answers
                    .map((answ: { response: { user_tokens: any; tokens: any } }) => (answ.response.user_tokens || 0) + (answ.response.tokens || 0))
                    .reduce((prev: any, curr: any) => prev + curr, 0)
        });
    }, [systemPromptTokens, answers]);
    // onBotChanged-Funktion
    const onBotChanged = useCallback(
        async (newBot: Bot) => {
            await botStorageService.setBotConfig(bot_id, newBot);
            setBotConfig(newBot);
            // count tokens in case of new system message
            if (newBot.system_message !== botConfig.system_message) {
                const response = await countTokensAPI({ text: newBot.system_message, model: LLM });
                setSystemPromptTokens(response.count);
            }
        },
        [botStorageService, bot_id, LLM, botConfig.system_message]
    );

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;
        try {
            await handleRegenerate(answers, dispatch, activeChatRef.current, botChatStorage, systemPrompt, callApi, isLoadingRef);
        } catch (e) {
            setError(e);
        }
    }, [answers, botChatStorage, callApi, systemPrompt, activeChatRef.current, isLoadingRef.current]);

    // ClearChat-Funktion
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        //unset active chat
        if (activeChatRef.current) {
            dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
        }
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [lastQuestionRef.current, error, activeChatRef.current]);
    // Rollback-Funktion
    const onRollbackMessage = useCallback(
        (index: number) => {
            if (!activeChatRef.current || isLoadingRef.current) return;
            isLoadingRef.current = true;
            try {
                handleRollback(index, activeChatRef.current, dispatch, botChatStorage, lastQuestionRef, setQuestion, clearChat, fetchHistory);
            } catch (e) {
                setError(e);
            }
            isLoadingRef.current = false;
        },
        [botChatStorage, clearChat, fetchHistory, setQuestion]
    );

    // on Example Clicked-Funktion
    const onExampleClicked = useCallback(
        (example: string) => {
            callApi(example);
        },
        [callApi]
    );
    // onEdit Sidebar-Funktion
    const onEditChange = useCallback(
        (isEditable: boolean) => {
            setSidebarWidth(isEditable ? "full_width" : "large");
        },
        [setSidebarWidth]
    );

    // History component
    const history = useMemo(
        () => (
            <History
                allChats={allChats}
                currentActiveChatId={activeChatRef.current}
                onDeleteChat={async id => {
                    await botChatStorage.delete(id);
                    await fetchHistory();
                }}
                onChatNameChange={async (id, name: string) => {
                    const newName = prompt(t("components.history.newchat"), name);
                    await botChatStorage.renameChat(id, newName ? newName.trim() : name);
                    await fetchHistory();
                }}
                onFavChange={async (id: string, fav: boolean) => {
                    await botChatStorage.changeFavouritesInDb(id, fav);
                    await fetchHistory();
                }}
                onSelect={async (id: string) => {
                    const chat = await botChatStorage.get(id);
                    if (chat) {
                        dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                        lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";
                        dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
                    }
                }}
            ></History>
        ),
        [allChats, activeChatRef.current, fetchHistory, botChatStorage, t]
    );
    // Sidebar-Actions component
    const actions = useMemo(
        () => (
            <>
                <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoadingRef.current} showText={showSidebar} />
                <Tooltip content={showSidebar ? t("common.sidebar_hide") : t("common.sidebar_show")} relationship="description" positioning="below">
                    <Button
                        style={{ marginLeft: "5px" }}
                        appearance="primary"
                        icon={showSidebar ? <ArrowMinimize24Filled /> : <ArrowMaximize24Filled />}
                        onClick={() => {
                            const toggled = !showSidebar;
                            setShowSidebar(toggled);
                            localStorage.setItem(STORAGE_KEYS.SHOW_SIDEBAR, toggled.toString());
                        }}
                    />
                </Tooltip>
            </>
        ),
        [clearChat, lastQuestionRef.current, isLoadingRef.current, showSidebar]
    );
    // Sidebar component
    const sidebar = useMemo(
        () => (
            <>
                <BotsettingsDrawer
                    bot={botConfig}
                    onBotChange={onBotChanged}
                    onDeleteBot={onDeleteBot}
                    actions={actions}
                    before_content={history}
                    onEditChange={onEditChange}
                    minimized={!showSidebar}
                ></BotsettingsDrawer>
            </>
        ),
        [botConfig, onBotChanged, onDeleteBot, actions, history, onEditChange, showSidebar]
    );
    // Examples component
    const examplesComponent = useMemo(() => {
        if (botConfig.examples && botConfig.examples.length > 0) {
            return <ExampleList examples={botConfig.examples} onExampleClicked={onExampleClicked} />;
        } else {
            return <></>;
        }
    }, [botConfig.examples, onExampleClicked]);
    // Text-Input component
    const inputComponent = useMemo(
        () => (
            <QuestionInput
                clearOnSend
                placeholder={t("chat.prompt")}
                disabled={isLoadingRef.current}
                onSend={question => callApi(question)}
                tokens_used={totalTokens}
                question={question}
                setQuestion={question => setQuestion(question)}
            />
        ),
        [isLoadingRef.current, callApi, totalTokens, question]
    );
    // AnswerList component
    const answerList = useMemo(
        () => (
            <AnswerList
                answers={answers}
                regularBotMsg={(answer, index) => {
                    return (
                        <>
                            {" "}
                            {index === answers.length - 1 && (
                                <Answer
                                    key={index}
                                    answer={answer.response}
                                    onRegenerateResponseClicked={onRegenerateResponseClicked}
                                    setQuestion={question => setQuestion(question)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer.response} setQuestion={question => setQuestion(question)} />}
                        </>
                    );
                }}
                onRollbackMessage={onRollbackMessage}
                isLoading={isLoadingRef.current}
                error={error}
                makeApiRequest={() => callApi(lastQuestionRef.current)}
                chatMessageStreamEnd={chatMessageStreamEnd}
                lastQuestionRef={lastQuestionRef}
            />
        ),
        [answers, onRegenerateResponseClicked, onRollbackMessage, isLoadingRef.current, error, callApi, chatMessageStreamEnd, lastQuestionRef.current]
    );

    const layout = useMemo(
        () => (
            <ChatLayout
                sidebar={sidebar}
                examples={examplesComponent}
                answers={answerList}
                input={inputComponent}
                showExamples={!lastQuestionRef.current}
                header=""
                header_as_markdown={false}
                messages_description={t("common.messages")}
                size={showSidebar ? sidebarSize : "none"}
            ></ChatLayout>
        ),
        [sidebar, examplesComponent, answerList, inputComponent, lastQuestionRef.current, t, sidebarSize]
    );
    return layout;
};

export default BotChat;
