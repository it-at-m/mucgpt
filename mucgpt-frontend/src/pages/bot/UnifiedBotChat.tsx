import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";
import { AskResponse, Bot, ChatResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { BotsettingsDrawer } from "../../components/BotsettingsDrawer/BotsettingsDrawer";
import { ChatLayout, SidebarSizes } from "../../components/ChatLayout/ChatLayout";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList } from "../../components/Example/ExampleList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { ChatOptions } from "../chat/Chat";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { HeaderContext } from "../layout/HeaderContextProvider";
import ToolStatusDisplay from "../../components/ToolStatusDisplay";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { BotStrategy, CommunityBotStrategy } from "./BotStrategy";
import { chatApi } from "../../api/core-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { getOwnedCommunityBots, getUserSubscriptionsApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { NotSubscribedDialog } from "../../components/NotSubscribedDialog/NotSubscribedDIalog";

interface UnifiedBotChatProps {
    strategy: BotStrategy;
}

const UnifiedBotChat = ({ strategy }: UnifiedBotChatProps) => {
    // useReducer für den Chat-Status
    const chatReducer = getChatReducer<Bot>();
    // Combined states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        temperature: 0.7,
        max_output_tokens: 4000,
        systemPrompt: "",
        active_chat: undefined,
        allChats: []
    });

    const { showError, showSuccess } = useGlobalToastContext();

    // Destructuring for easier access
    const { answers, temperature, max_output_tokens, systemPrompt, active_chat, allChats } = chatState;

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
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { setHeader } = useContext(HeaderContext);

    const [error, setError] = useState<unknown>();
    const [sidebarSize] = useState<SidebarSizes>("large");
    const [question, setQuestion] = useState<string>("");
    const [showSidebar, setShowSidebar] = useState<boolean>(
        localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) === null ? true : localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) == "true"
    );
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const [showNotSubscribedDialog, setShowNotSubscribedDialog] = useState<boolean>(false);
    const [noAccess, setNoAccess] = useState<boolean>(false);

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
        examples: [],
        version: "0",
        is_visible: true
    });

    // useEffect to load the bot config and chat history
    useEffect(() => {
        const loadData = async () => {
            if (bot_id) {
                if (error) setError(undefined);
                isLoadingRef.current = true;
                console.log("Strategy:", strategy);
                console.log(strategy instanceof CommunityBotStrategy);
                let notSubscribed = false;
                if (strategy instanceof CommunityBotStrategy) {
                    const owned = await getOwnedCommunityBots();
                    const userIsOwner = owned.some(bot => bot.id === bot_id);

                    if (userIsOwner) {
                        window.location.href = `/#/owned/communitybot/${bot_id}`;
                        return;
                    } else {
                        const subscriptions = await getUserSubscriptionsApi();
                        const isSubscribed = subscriptions && subscriptions.length > 0 && subscriptions.some(sub => sub.id === bot_id);
                        console.log("Is Subscribed:", isSubscribed);
                        if (!isSubscribed) {
                            notSubscribed = true;
                        }
                    }
                }

                strategy
                    .loadBotConfig(bot_id, botStorageService)
                    .then(bot => {
                        if (bot) {
                            setBotConfig(bot);
                            setHeader("");
                            dispatch({ type: "SET_SYSTEM_PROMPT", payload: bot.system_message });
                            dispatch({ type: "SET_TEMPERATURE", payload: bot.temperature });
                            dispatch({ type: "SET_MAX_TOKENS", payload: bot.max_output_tokens });
                            setQuickPrompts(bot.quick_prompts || []);

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
                                .then(() => fetchHistory())
                                .catch(err => {
                                    console.error("Error loading chat history:", err);
                                    showError(t("components.bot_chat.load_chat_failed"), t("components.bot_chat.load_chat_failed_message"));
                                });
                        } else {
                            showError(t("components.bot_chat.load_bot_failed"), t("components.bot_chat.bot_not_found"));
                            // wait a moment before redirecting to home
                            setTimeout(() => {
                                window.location.href = "/";
                            }, 2000);
                        }
                    })
                    .catch(err => {
                        if (err.response?.status === 403 && notSubscribed) {
                            setNoAccess(true);
                        } else {
                            console.error("Error loading bot configuration:", err);
                            showError(
                                t("components.bot_chat.load_bot_failed"),
                                err instanceof Error ? err.message : t("components.bot_chat.load_bot_failed_message")
                            );
                            // wait a moment before redirecting to home
                            setTimeout(() => {
                                window.location.href = "/";
                            }, 2000);
                        }
                    })
                    .finally(() => {
                        console.log("Not Subscribed:", notSubscribed);
                        setShowNotSubscribedDialog(notSubscribed);
                        isLoadingRef.current = false;
                    });
            }
        };
        loadData();
    }, [bot_id, strategy, t, showError]);

    // get History-Funktion
    const fetchHistory = useCallback(() => {
        return botStorageService.getAllChatForBot(bot_id).then(chats => {
            if (chats) dispatch({ type: "SET_ALL_CHATS", payload: chats });
        });
    }, [botStorageService, bot_id]);

    // deleteBot-Funktion
    const onDeleteBot = useCallback(async () => {
        try {
            await strategy.deleteBot(bot_id, botStorageService);
            showSuccess(t("components.bot_chat.delete_bot_success"), t("components.bot_chat.delete_bot_success_message", { title: botConfig.title }));
            window.location.href = "/";
        } catch (err) {
            console.error("Error deleting bot:", err);
            showError(t("components.bot_chat.delete_bot_failed"), err instanceof Error ? err.message : t("components.bot_chat.delete_bot_failed_message"));
        }
    }, [strategy, bot_id, botStorageService, showError, showSuccess, t, botConfig.title]);

    // callApi-Funktion
    const callApi = useCallback(
        async (question: string) => {
            lastQuestionRef.current = question;
            if (error) setError(undefined);
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
                    bot_id,
                    botConfig.tools ? botConfig.tools.map(tool => tool.id) : [],
                    setToolStatuses
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
            fetchHistory,
            botConfig
        ]
    );

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [answers.length]);

    // Add a scroll function
    const scrollToBottom = useCallback(() => {
        if (chatMessageStreamEnd.current) {
            chatMessageStreamEnd.current.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // onBotChanged-Funktion
    const onBotChanged = useCallback(
        async (newBot: Bot) => {
            if (!strategy.canEdit) return;

            setError(undefined);
            try {
                const result = await strategy.updateBot?.(bot_id, newBot);

                if (result?.updatedBot) {
                    setBotConfig(result.updatedBot);
                    setQuickPrompts(result.updatedBot.quick_prompts || []);
                    showSuccess(
                        t("components.bot_chat.update_bot_success"),
                        t("components.bot_chat.update_bot_success_message", { title: result.updatedBot.title })
                    );
                }
            } catch (err) {
                console.error("Error updating bot:", err);
                showError(t("components.bot_chat.update_bot_failed"), err instanceof Error ? err.message : t("components.bot_chat.update_bot_failed_message"));
            }
        },
        [strategy, bot_id, botConfig, LLM, setQuickPrompts, showError, showSuccess, t]
    );

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;
        try {
            setError(undefined);
            await handleRegenerate(answers, dispatch, activeChatRef.current, botChatStorage, systemPrompt, callApi, isLoadingRef);
        } catch (e) {
            setError(e);
        }
    }, [answers, botChatStorage, callApi, systemPrompt, activeChatRef.current, isLoadingRef.current]);

    // ClearChat-Funktion
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        if (error) setError(undefined);
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
                setError(undefined);
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

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find(m => m.llm_name === nextLLM);
            if (found) setLLM(found);
        },
        [availableLLMs, setLLM]
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
                        setError(undefined);
                        dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                        lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";
                        dispatch({ type: "SET_ACTIVE_CHAT", payload: id });

                        // Scroll to bottom after a short delay to ensure DOM is updated
                        setTimeout(() => {
                            scrollToBottom();
                        }, 100);
                    }
                }}
            ></History>
        ),
        [allChats, activeChatRef.current, fetchHistory, botChatStorage, t, scrollToBottom]
    );

    // Sidebar component
    const toggleSidebar = useCallback(() => {
        setShowSidebar(!showSidebar);
        localStorage.setItem(STORAGE_KEYS.SHOW_SIDEBAR, (!showSidebar).toString());
    }, [showSidebar]);

    const sidebar = useMemo(
        () => (
            <>
                <BotsettingsDrawer
                    bot={botConfig}
                    onBotChange={strategy.canEdit ? onBotChanged : () => {}}
                    onDeleteBot={onDeleteBot}
                    history={history}
                    minimized={!showSidebar}
                    isOwned={strategy.isOwned}
                    clearChat={clearChat}
                    clearChatDisabled={!lastQuestionRef.current || isLoadingRef.current}
                    onToggleMinimized={toggleSidebar}
                    strategy={strategy}
                ></BotsettingsDrawer>
            </>
        ),
        [botConfig, onBotChanged, onDeleteBot, history, showSidebar, strategy.canEdit, strategy.isOwned, strategy]
    );

    // Examples component
    const examplesComponent = useMemo(() => {
        if (botConfig.examples && botConfig.examples.length > 0) {
            return <ExampleList examples={botConfig.examples} onExampleClicked={onExampleClicked} />;
        } else {
            return null;
        }
    }, [botConfig.examples, onExampleClicked]);

    // Text-Input component
    const inputComponent = useMemo(
        () => (
            <QuestionInput
                clearOnSend
                placeholder={t("chat.prompt")}
                disabled={isLoadingRef.current || error !== undefined}
                onSend={question => callApi(question)}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={botConfig.tools ? botConfig.tools.map(tool => tool.id) : []}
            />
        ),
        [isLoadingRef.current, callApi, question, t, error, botConfig.tools]
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
                makeApiRequest={() => {
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                    callApi(lastQuestionRef.current);
                }}
                chatMessageStreamEnd={chatMessageStreamEnd}
                lastQuestionRef={lastQuestionRef}
                onRollbackError={() => {
                    setQuestion(lastQuestionRef.current);
                    setError(undefined);
                    lastQuestionRef.current = answers.length > 1 ? answers[answers.length - 1].user : "";
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                }}
            />
        ),
        [answers, onRegenerateResponseClicked, onRollbackMessage, isLoadingRef.current, error, callApi, chatMessageStreamEnd, lastQuestionRef.current]
    );

    const layout = useMemo(
        () => (
            <>
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
                    llmOptions={availableLLMs}
                    defaultLLM={LLM.llm_name}
                    onLLMSelectionChange={onLLMSelectionChange}
                    onToggleMinimized={toggleSidebar}
                    clearChat={clearChat}
                    clearChatDisabled={!lastQuestionRef.current || isLoadingRef.current}
                />
                <ToolStatusDisplay activeTools={toolStatuses} />
            </>
        ),
        [
            sidebar,
            examplesComponent,
            answerList,
            inputComponent,
            lastQuestionRef.current,
            t,
            sidebarSize,
            toolStatuses,
            availableLLMs,
            LLM.llm_name,
            onLLMSelectionChange,
            showSidebar,
            clearChat,
            isLoadingRef.current
        ]
    );

    return (
        <>
            {layout}
            <NotSubscribedDialog
                open={showNotSubscribedDialog}
                onOpenChange={setShowNotSubscribedDialog}
                hasAccess={!noAccess}
                botTitle={botConfig.title}
                onSubscribe={async () => {
                    await subscribeToAssistantApi(bot_id);
                    setShowNotSubscribedDialog(false);
                    setNoAccess(false);
                    showSuccess(
                        t("components.not_subscribed_dialog.subscribe_success"),
                        t("components.not_subscribed_dialog.subscribe_success_message", { botTitle: botConfig.title })
                    );
                }}
            />
        </>
    );
};

export default UnifiedBotChat;
