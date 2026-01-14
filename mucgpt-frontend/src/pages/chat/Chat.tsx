import { useRef, useState, useEffect, useContext, useCallback, useMemo, useReducer } from "react";

import { AskResponse, ChatResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList, ExampleModel } from "../../components/Example";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";
import { History } from "../../components/History/History";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { CHAT_STORE, DEFAULT_MAX_OUTPUT_TOKENS } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { MinimizeSidebarButton } from "../../components/MinimizeSidebarButton/MinimizeSidebarButton";
import { HeaderContext } from "../layout/HeaderContextProvider";
import ToolStatusDisplay from "../../components/ToolStatusDisplay";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { Model } from "../../api";
import { chatApi } from "../../api/core-client";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { useToolsContext } from "../../components/ToolsProvider";

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the provided function
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout !== null) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(later, wait);
    };
}

export type ChatMessage = DBMessage<ChatResponse>;

export interface ChatOptions {
    system: string;
    maxTokens: number;
    temperature: number;
}

// Define constants outside the component
const CHAT_EXAMPLES: ExampleModel[] = [
    {
        text: "Du bist König Ludwig II. von Bayern. Schreibe einen Brief an alle Mitarbeiter*innen der Stadtverwaltung München.",
        value: "Du bist König Ludwig II. von Bayern. Schreibe einen Brief an alle Mitarbeiter*innen der Stadtverwaltung München, indem Du Dich für die tolle Leistung bedankst und den Bau eines neuen Schlosses (noch beeindruckender als Neuschwanstein) in der Stadt München wünschst."
    },
    {
        text: "Stell dir vor, es ist schlechtes Wetter.",
        value: `Stell dir vor, es ist schlechtes Wetter und du sitzt lustlos im Büro. Alle möglichen Leute wollen etwas von Dir und Du spürst eine Stimmung, als ob irgendeine Kleinigkeit gleich eskalieren wird. Schreibe mir etwas, das dir in dieser Situation gut tut und dich aufmuntert.`
    },
    {
        text: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?",
        value: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?"
    }
];

// Custom hook for storage operations
function useStorageService(activeChatId: string | undefined) {
    // Use useMemo for the instance so that it is only recreated when activeChatId changes
    return useMemo(() => new StorageService<ChatResponse, ChatOptions>(CHAT_STORE), [activeChatId]);
}

const Chat = () => {
    const chatReducer = getChatReducer<ChatOptions>();
    // Contexts
    const { language } = useContext(LanguageContext);
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { setHeader } = useContext(HeaderContext);
    const headerTitle = t("header.chat");
    useEffect(() => {
        setHeader(headerTitle);
    }, [setHeader, headerTitle]);
    const { tools } = useToolsContext();
    const llmMaxOutputTokens = LLM.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

    // Independent states
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [showSidebar, setShowSidebar] = useState<boolean>(
        localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) === null ? false : localStorage.getItem(STORAGE_KEYS.SHOW_SIDEBAR) == "true"
    );
    const setAndStoreShowSidebar = (value: boolean) => {
        setShowSidebar(value);
        localStorage.setItem(STORAGE_KEYS.SHOW_SIDEBAR, value.toString());
    };
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);

    // Related states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        temperature: 0.7,
        max_output_tokens: 4000,
        systemPrompt: "",
        active_chat: undefined,
        allChats: []
    });

    // Destructuring for easier access
    const { answers, temperature, max_output_tokens, systemPrompt, active_chat, allChats } = chatState;

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const isFirstRender = useRef(true);
    const activeChatRef = useRef(active_chat);
    const isLoadingRef = useRef(false);

    // Update activeChatRef whenever active_chat changes
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Storage Service mit useMemo
    const storageService = useStorageService(activeChatRef.current);

    // Add a scroll function
    const scrollToBottom = useCallback(() => {
        if (chatMessageStreamEnd.current) {
            chatMessageStreamEnd.current.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // Debounced Storage-Update
    const debouncedStorageUpdate = useMemo(
        () =>
            debounce((options: ChatOptions) => {
                if (activeChatRef.current) {
                    storageService.update(activeChatRef.current, undefined, options);
                }
            }, 500),
        [activeChatRef.current, storageService]
    );

    // Fetch chat history
    const fetchHistory = useCallback(async () => {
        try {
            const chats = await storageService.getAll();
            if (chats) {
                dispatch({ type: "SET_ALL_CHATS", payload: chats });
            }
            return chats;
        } catch (e) {
            console.error("Error fetching history:", e);
            setError(e);
            return [];
        }
    }, [storageService]);

    // Load chat by ID
    const loadChat = useCallback(
        async (id: string) => {
            try {
                setError(undefined);
                const chat = await storageService.get(id);
                if (chat) {
                    dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                    dispatch({ type: "SET_TEMPERATURE", payload: chat.config.temperature });
                    dispatch({ type: "SET_MAX_TOKENS", payload: chat.config.maxTokens });
                    dispatch({ type: "SET_SYSTEM_PROMPT", payload: chat.config.system });
                    dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
                    lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";

                    // Scroll to bottom after a short delay to ensure DOM is updated
                    setTimeout(() => {
                        scrollToBottom();
                    }, 100);

                    return true;
                }
                return false;
            } catch (e) {
                console.error("Error loading chat:", e);
                setError(e);
                return false;
            }
        },
        [storageService, scrollToBottom]
    );

    // Clear chat state
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        setError(undefined);
        dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [lastQuestionRef.current]);

    // API Request mit optimiertem State Management
    const callApi = useCallback(
        async (question: string, system?: string) => {
            lastQuestionRef.current = question;
            setError(undefined);
            isLoadingRef.current = true;

            const askResponse: ChatResponse = { answer: "", tokens: 0, user_tokens: 0 } as AskResponse;
            const options: ChatOptions = {
                system: system ?? "",
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
                    storageService,
                    options,
                    askResponse,
                    chatMessageStreamEnd,
                    isLoadingRef,
                    fetchHistory,
                    undefined,
                    selectedTools,
                    setToolStatuses
                );
            } catch (e) {
                setError(e);
            }
            isLoadingRef.current = false;
        },
        [
            isLoadingRef.current,
            answers,
            language,
            temperature,
            max_output_tokens,
            activeChatRef.current,
            LLM.llm_name,
            storageService,
            fetchHistory,
            selectedTools
        ]
    );

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;

        try {
            await handleRegenerate(answers, dispatch, activeChatRef.current, storageService, systemPrompt, callApi, isLoadingRef);
        } catch (e) {
            setError(e);
        }
    }, [answers, storageService, callApi, systemPrompt, activeChatRef.current, isLoadingRef.current]);

    // Rollback-Funktion
    const onRollbackMessage = useCallback(
        (index: number) => {
            if (!activeChatRef.current || isLoadingRef.current) return;

            try {
                isLoadingRef.current = true;
                setError(undefined);
                handleRollback(index, activeChatRef.current, dispatch, storageService, lastQuestionRef, setQuestion, clearChat, fetchHistory);
            } catch (e) {
                setError(e);
            } finally {
                isLoadingRef.current = false;
            }
        },
        [storageService, clearChat, fetchHistory, setQuestion, isLoadingRef.current, activeChatRef.current]
    );

    // Konfigurationsänderungen mit memoisierten Callbacks
    const onTemperatureChanged = useCallback(
        (temp: number) => {
            dispatch({ type: "SET_TEMPERATURE", payload: temp });

            debouncedStorageUpdate({
                system: systemPrompt,
                maxTokens: max_output_tokens,
                temperature: temp
            });
        },
        [systemPrompt, max_output_tokens, debouncedStorageUpdate]
    );

    const onMaxTokensChanged = useCallback(
        (maxTokens: number) => {
            const limit = llmMaxOutputTokens;
            const finalTokens = limit > 1 && maxTokens > limit ? limit : maxTokens;

            dispatch({ type: "SET_MAX_TOKENS", payload: finalTokens });

            debouncedStorageUpdate({
                system: systemPrompt,
                maxTokens: finalTokens,
                temperature: temperature
            });
        },
        [llmMaxOutputTokens, systemPrompt, temperature, debouncedStorageUpdate]
    );

    const onSystemPromptChanged = useCallback(
        (newSystemPrompt: string) => {
            dispatch({ type: "SET_SYSTEM_PROMPT", payload: newSystemPrompt });

            debouncedStorageUpdate({
                system: newSystemPrompt,
                maxTokens: max_output_tokens,
                temperature: temperature
            });
        },
        [max_output_tokens, temperature, debouncedStorageUpdate]
    );

    const clearNavigationQueryParams = useCallback(() => {
        const currentUrl = new URL(window.location.href);

        // Handle hash-based routing (e.g., #/chat?q=...)
        if (currentUrl.hash && currentUrl.hash.includes("?")) {
            const [hashPath, hashQuery] = currentUrl.hash.split("?");
            const hashParams = new URLSearchParams(hashQuery);
            hashParams.delete("q");
            hashParams.delete("question");
            hashParams.delete("tools");
            const newHashQuery = hashParams.toString();
            currentUrl.hash = newHashQuery ? `${hashPath}?${newHashQuery}` : hashPath;
        }

        // Handle search params (fallback navigation)
        if (currentUrl.search) {
            const searchParams = currentUrl.searchParams;
            searchParams.delete("q");
            searchParams.delete("question");
            searchParams.delete("tools");
            const newSearch = searchParams.toString();
            currentUrl.search = newSearch ? `?${newSearch}` : "";
        }

        window.history.replaceState(window.history.state, "", currentUrl.toString());
    }, []);

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find((m: Model) => m.llm_name === nextLLM);
            if (found) setLLM(found);
        },
        [availableLLMs, setLLM]
    );

    // State to track if initialization is complete
    const [isInitialized, setIsInitialized] = useState(false);
    const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
    // Effect to handle pending question after tools are loaded
    const scheduledQuestionRef = useRef<string | null>(null);

    const hasRestoredLLMRef = useRef(false);

    useEffect(() => {
        if (hasRestoredLLMRef.current) return;
        const storedLLM = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM);
        if (storedLLM) {
            const preferredModel = availableLLMs.find(m => m.llm_name === storedLLM);
            if (preferredModel && preferredModel.llm_name !== LLM.llm_name) {
                setLLM(preferredModel);
            }
        }
        hasRestoredLLMRef.current = true;
    }, [availableLLMs, setLLM, LLM.llm_name]);

    // Initialisierung beim ersten Laden
    useEffect(() => {
        if (!isFirstRender.current) return;
        isFirstRender.current = false;

        isLoadingRef.current = true;

        // Check URL for question parameter - Handle hash router format
        let questionFromUrl;
        let toolsFromUrl;
        const hashPart = window.location.hash;

        // For hash router format like #/chat?q=something&tools=tool1,tool2
        if (hashPart && hashPart.includes("?")) {
            const queryPart = hashPart.split("?")[1];
            const hashParams = new URLSearchParams(queryPart);
            questionFromUrl = hashParams.get("q") || hashParams.get("question");
            toolsFromUrl = hashParams.get("tools");
        } else {
            // Fallback to regular URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            questionFromUrl = urlParams.get("q") || urlParams.get("question");
            toolsFromUrl = urlParams.get("tools");
        }

        // Parse tools from URL if present
        if (toolsFromUrl) {
            const toolsArray = toolsFromUrl.split(",").filter(tool => tool.trim() !== "");
            setSelectedTools(toolsArray);
        }

        if (questionFromUrl) {
            setPendingQuestion(questionFromUrl);
            storageService
                .getNewestChat()
                .then(() => {
                    clearChat(); // Clear any existing chat
                    setIsInitialized(true);
                    return fetchHistory();
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        } else {
            // Normal initialization without URL parameter
            storageService
                .getNewestChat()
                .then(existingData => {
                    if (existingData) {
                        dispatch({ type: "SET_ANSWERS", payload: existingData.messages });
                        dispatch({ type: "SET_TEMPERATURE", payload: existingData.config.temperature });
                        dispatch({ type: "SET_MAX_TOKENS", payload: existingData.config.maxTokens });
                        dispatch({ type: "SET_SYSTEM_PROMPT", payload: existingData.config.system });
                        dispatch({ type: "SET_ACTIVE_CHAT", payload: existingData.id });

                        lastQuestionRef.current = existingData.messages.length > 0 ? existingData.messages[existingData.messages.length - 1].user : "";
                    }
                    setIsInitialized(true);
                    return fetchHistory();
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        }
    }, [fetchHistory, storageService, clearChat]);

    useEffect(() => {
        if (!isInitialized || !pendingQuestion || tools === undefined) {
            return;
        }

        // Prevent scheduling the same question multiple times
        if (scheduledQuestionRef.current === pendingQuestion) {
            return;
        }

        scheduledQuestionRef.current = pendingQuestion;
        const questionToAsk = pendingQuestion;

        // Wait a bit more to ensure tools are properly set
        const timeoutId = window.setTimeout(() => {
            // Check if this question is still pending
            if (scheduledQuestionRef.current !== questionToAsk) {
                return;
            }
            callApi(questionToAsk, systemPrompt);

            // Clear state and hash param once the question is sent
            scheduledQuestionRef.current = null;
            setPendingQuestion(current => (current === questionToAsk ? null : current));
            clearNavigationQueryParams();
        }, 200);

        return () => {
            window.clearTimeout(timeoutId);
            if (scheduledQuestionRef.current === questionToAsk) {
                scheduledQuestionRef.current = null;
            }
        };
    }, [isInitialized, pendingQuestion, tools, callApi, systemPrompt, clearNavigationQueryParams]);

    // Update max tokens if LLM changes
    useEffect(() => {
        if (llmMaxOutputTokens > 1 && max_output_tokens > llmMaxOutputTokens) {
            onMaxTokensChanged(llmMaxOutputTokens);
        }
    }, [llmMaxOutputTokens, max_output_tokens, onMaxTokensChanged]);

    // Set up quick prompts
    useEffect(() => {
        setQuickPrompts([
            {
                label: t("chat.quickprompts.shorter", { lng: language }),
                prompt: t("chat.quickprompts.shorter_prompt", { lng: language }),
                tooltip: t("chat.quickprompts.shorter_tooltip", { lng: language })
            },
            {
                label: t("chat.quickprompts.formal", { lng: language }),
                prompt: t("chat.quickprompts.formal_prompt", { lng: language }),
                tooltip: t("chat.quickprompts.formal_tooltip", { lng: language })
            },
            {
                label: t("chat.quickprompts.informal", { lng: language }),
                prompt: t("chat.quickprompts.informal_prompt", { lng: language }),
                tooltip: t("chat.quickprompts.informal_tooltip", { lng: language })
            },
            {
                label: t("chat.quickprompts.longer", { lng: language }),
                prompt: t("chat.quickprompts.longer_prompt", { lng: language }),
                tooltip: t("chat.quickprompts.longer_tooltip", { lng: language })
            }
        ]);
    }, [language, t, setQuickPrompts]);

    // Click handlers
    const onExampleClicked = useCallback(
        (example: string, system?: string) => {
            if (system) onSystemPromptChanged(system);
            callApi(example, system);
        },
        [callApi, onSystemPromptChanged]
    );
    // Memo components
    const answerList = useMemo(
        () => (
            <AnswerList
                answers={answers}
                regularAssistantMsg={(answer, index) => {
                    return (
                        <>
                            {index === answers.length - 1 && (
                                <Answer
                                    key={`answer-${index}`}
                                    answer={answer.response}
                                    onRegenerateResponseClicked={onRegenerateResponseClicked}
                                    onQuickPromptSend={prompt => callApi(prompt, systemPrompt)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={`answer-${index}`} answer={answer.response} />}
                        </>
                    );
                }}
                onRollbackMessage={onRollbackMessage}
                isLoading={isLoadingRef.current}
                error={error}
                makeApiRequest={() => {
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                    callApi(lastQuestionRef.current, systemPrompt);
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
        [answers, onRegenerateResponseClicked, onRollbackMessage, error, callApi, systemPrompt, isLoadingRef.current, lastQuestionRef, chatMessageStreamEnd]
    );

    const examplesComponent = useMemo(() => <ExampleList examples={CHAT_EXAMPLES} onExampleClicked={onExampleClicked} />, [onExampleClicked]);

    const inputComponent = useMemo(
        () => (
            <QuestionInput
                clearOnSend
                placeholder={t("chat.prompt")}
                disabled={isLoadingRef.current || error !== undefined}
                onSend={question => callApi(question, systemPrompt)}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={tools}
            />
        ),
        [callApi, systemPrompt, question, t, isLoadingRef.current, selectedTools, tools]
    );

    const sidebar_actions = useMemo(
        () => (
            <>
                <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoadingRef.current} showText={showSidebar} />
                <MinimizeSidebarButton showSidebar={showSidebar} setShowSidebar={setAndStoreShowSidebar} />
            </>
        ),
        [clearChat, lastQuestionRef.current, isLoadingRef.current, showSidebar]
    );

    const sidebar_history = useMemo(
        () => (
            <History
                allChats={allChats}
                currentActiveChatId={active_chat}
                onDeleteChat={async id => {
                    await storageService.delete(id);
                    await fetchHistory();
                }}
                onChatNameChange={async (id, name: string) => {
                    const newName = prompt(t("components.history.newchat"), name);
                    await storageService.renameChat(id, newName ? newName.trim() : name);
                    await fetchHistory();
                }}
                onFavChange={async (id: string, fav: boolean) => {
                    await storageService.changeFavouritesInDb(id, fav);
                    await fetchHistory();
                }}
                onSelect={async (id: string) => {
                    loadChat(id);
                }}
            ></History>
        ),
        [allChats, active_chat, fetchHistory, storageService, loadChat, t]
    );

    const sidebar_chat_settings = useMemo(
        () => (
            <ChatsettingsDrawer
                temperature={temperature}
                setTemperature={onTemperatureChanged}
                max_output_tokens={max_output_tokens}
                setMaxTokens={onMaxTokensChanged}
                systemPrompt={systemPrompt}
                setSystemPrompt={onSystemPromptChanged}
            />
        ),
        [temperature, max_output_tokens, systemPrompt, onTemperatureChanged, onMaxTokensChanged, onSystemPromptChanged]
    );

    const sidebar = useMemo(
        () => (
            <Sidebar
                actions={sidebar_actions}
                content={
                    <>
                        {sidebar_chat_settings}
                        {sidebar_history}
                    </>
                }
            ></Sidebar>
        ),
        [sidebar_actions, sidebar_history, sidebar_chat_settings]
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
                    header={t("chat.header")}
                    header_as_markdown={false}
                    messages_description={t("common.messages")}
                    size={showSidebar ? "large" : "none"}
                    llmOptions={availableLLMs}
                    defaultLLM={LLM.llm_name}
                    onLLMSelectionChange={onLLMSelectionChange}
                    onToggleMinimized={() => setAndStoreShowSidebar(true)}
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
            showSidebar,
            toolStatuses,
            availableLLMs,
            LLM.llm_name,
            onLLMSelectionChange,
            clearChat,
            isLoadingRef.current
        ]
    );

    return layout;
};

export default Chat;
