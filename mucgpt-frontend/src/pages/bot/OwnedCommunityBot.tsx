import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";

import {
    chatApi,
    AskResponse,
    countTokensAPI,
    Bot,
    ChatResponse,
    getTools,
    getCommunityAssistantApi,
    deleteCommunityAssistantApi,
    updateCommunityAssistantApi
} from "../../api";
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
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { MinimizeSidebarButton } from "../../components/MinimizeSidebarButton/MinimizeSidebarButton";
import { AssistantUpdateInput, ToolListResponse } from "../../api/models";
import { DEFAULTHEADER, HeaderContext } from "../layout/HeaderContextProvider";
import ToolStatusDisplay from "../../components/ToolStatusDisplay";
import { ToolStatus } from "../../utils/ToolStreamHandler";

const OwnedCommunityBotChat = () => {
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
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { setHeader } = useContext(HeaderContext);

    const [error, setError] = useState<unknown>();
    const [sidebarSize] = useState<SidebarSizes>("large");
    const [question, setQuestion] = useState<string>("");
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const [showSidebar, setShowSidebar] = useState<boolean>(
        localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) === null ? true : localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) == "true"
    );
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const [tools, setTools] = useState<ToolListResponse | undefined>(undefined);
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);

    useEffect(() => {
        const fetchTools = async () => {
            try {
                const result = await getTools();
                setTools(result);
            } catch {
                setTools({ tools: [] });
            }
        };
        fetchTools();
    }, []);

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
        version: "0"
    });

    // useEffect to load the bot config and chat history
    useEffect(() => {
        if (bot_id) {
            getCommunityAssistantApi(bot_id)
                .then(response => {
                    const latest = response.latest_version;
                    const bot: Bot = {
                        id: bot_id,
                        title: latest.name,
                        description: latest.description || "",
                        system_message: latest.system_prompt,
                        publish: true,
                        temperature: latest.temperature || 0.7,
                        max_output_tokens: latest.max_output_tokens || LLM.max_output_tokens,
                        version: latest.version.toString(),
                        examples: latest.examples,
                        quick_prompts: latest.quick_prompts,
                        tags: latest.tags,
                        owner_ids: latest.owner_ids,
                        hirachical_access: latest.hierarchical_access
                    };
                    setHeader(bot.title || DEFAULTHEADER);
                    setBotConfig(bot);
                    dispatch({ type: "SET_SYSTEM_PROMPT", payload: bot.system_message });
                    dispatch({ type: "SET_TEMPERATURE", payload: bot.temperature });
                    dispatch({ type: "SET_MAX_TOKENS", payload: bot.max_output_tokens });
                    setQuickPrompts(bot.quick_prompts || []);
                    botStorageService
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
        if (bot_id) await deleteCommunityAssistantApi(bot_id);
        window.location.href = "/";
    }, [bot_id]);
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
                    selectedTools,
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
            selectedTools
        ]
    );

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [answers.length]);
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
            setError(undefined);
            const updateInput: AssistantUpdateInput = {
                name: newBot.title,
                description: newBot.description,
                system_prompt: newBot.system_message,
                hierarchical_access: newBot.hirachical_access,
                temperature: newBot.temperature,
                max_output_tokens: newBot.max_output_tokens,
                tools: [],
                owner_ids: newBot.owner_ids,
                examples: newBot.examples?.map(e => ({ text: e.text, value: e.value })) || [],
                quick_prompts: newBot.quick_prompts || [],
                tags: newBot.tags || [],
                version: Number(newBot.version)
            };
            await updateCommunityAssistantApi(bot_id, updateInput);
            if (newBot.system_message !== botConfig.system_message) {
                const response = await countTokensAPI({ text: newBot.system_message, model: LLM });
                setSystemPromptTokens(response.count);
            }
        },
        [bot_id, LLM, botConfig.system_message]
    );

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find(m => m.llm_name === nextLLM);
            if (found) setLLM(found);
        },
        [availableLLMs, setLLM]
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
                <MinimizeSidebarButton showSidebar={showSidebar} setShowSidebar={setShowSidebar} />
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
                    minimized={!showSidebar}
                    isOwned={true}
                ></BotsettingsDrawer>
            </>
        ),
        [botConfig, onBotChanged, onDeleteBot, actions, history, showSidebar]
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
                disabled={isLoadingRef.current || error !== undefined}
                onSend={question => callApi(question)}
                tokens_used={totalTokens}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={tools}
            />
        ),
        [isLoadingRef.current, callApi, totalTokens, question, selectedTools, tools]
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
            onLLMSelectionChange
        ]
    );
    return layout;
};

export default OwnedCommunityBotChat;
