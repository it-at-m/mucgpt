import { useRef, useState, useEffect, useContext, useCallback, useMemo, useReducer } from "react";

import { AskResponse, ChatResponse, DataSource } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList, ExampleModel } from "../../components/Example";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { CHAT_STORE, CREATIVITY_LOW } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { Model } from "../../api";
import { chatApi } from "../../api/core-client";
import { useToolsContext } from "../../components/ToolsProvider";
import { Settings24Regular } from "@fluentui/react-icons";
import { Button } from "@fluentui/react-components";
import { ChatSettingsDialog } from "../../components/ChatSettingsDialog/ChatSettingsDialog";
import { UploadedData, createUploadedDataFromContent } from "../../components/ContextManagerDialog/ContextManagerDialog";
import { getStoredParsedDocuments } from "../../service/parsedDocumentStorage";
import { useToolStatusToasts } from "../../hooks/useToolStatusToasts";
import { useUnifiedHistory, useUnifiedHistoryRegistration } from "../../components/UnifiedHistory";
import { useLocation } from "react-router-dom";

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
    creativity: string;
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

function parseStoredStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string");
}

const Chat = () => {
    const chatReducer = getChatReducer<ChatOptions>();
    // Contexts
    const { language } = useContext(LanguageContext);
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const location = useLocation();
    const { refreshHistory: refreshUnifiedHistory } = useUnifiedHistory();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { tools } = useToolsContext();

    // Independent states
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [selectedTools, setSelectedTools] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SELECTED_TOOLS);
            return stored ? parseStoredStringArray(JSON.parse(stored)) : [];
        } catch {
            return [];
        }
    });
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [uploadedData, setUploadedData] = useState<UploadedData[]>([]);

    useToolStatusToasts(toolStatuses);

    // Related states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        creativity: CREATIVITY_LOW,
        systemPrompt: "",
        active_chat: undefined,
        allChats: []
    });

    // Destructuring for easier access
    const { answers, creativity, systemPrompt, active_chat } = chatState;

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const lastAnswerRef = useRef<HTMLDivElement | null>(null);
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
            refreshUnifiedHistory();
            return chats;
        } catch (e) {
            console.error("Error fetching history:", e);
            setError(e);
            return [];
        }
    }, [refreshUnifiedHistory, storageService]);

    // Load chat by ID
    const loadChat = useCallback(
        async (id: string) => {
            try {
                setError(undefined);
                const chat = await storageService.get(id);
                if (chat) {
                    dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                    dispatch({ type: "SET_CREATIVITY", payload: chat.config.creativity });
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

    const loadNewestChat = useCallback(async () => {
        const existingData = await storageService.getNewestChat();
        if (!existingData) {
            lastQuestionRef.current = "";
            dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
            dispatch({ type: "CLEAR_ANSWERS" });
            return;
        }

        dispatch({ type: "SET_ANSWERS", payload: existingData.messages });
        dispatch({ type: "SET_CREATIVITY", payload: existingData.config.creativity });
        dispatch({ type: "SET_SYSTEM_PROMPT", payload: existingData.config.system });
        dispatch({ type: "SET_ACTIVE_CHAT", payload: existingData.id });
        lastQuestionRef.current = existingData.messages.length > 0 ? existingData.messages[existingData.messages.length - 1].user : "";
    }, [storageService]);

    // Clear chat state
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        setError(undefined);
        dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [lastQuestionRef.current]);

    useUnifiedHistoryRegistration(
        useMemo(
            () => ({
                kind: "chat",
                activeChatId: active_chat,
                resetActiveChat: (chatId: string) => {
                    if (chatId === activeChatRef.current) {
                        clearChat();
                    }
                }
            }),
            [active_chat, clearChat]
        )
    );

    // API Request mit optimiertem State Management
    const callApi = useCallback(
        async (question: string, system?: string, dataSources?: DataSource[]) => {
            lastQuestionRef.current = question;
            setError(undefined);
            isLoadingRef.current = true;

            const askResponse: ChatResponse = { answer: "", tokens: 0, user_tokens: 0 } as AskResponse;
            const options: ChatOptions = {
                system: system ?? "",
                creativity: creativity
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
                    setToolStatuses,
                    dataSources,
                    lastAnswerRef
                );
            } catch (e) {
                setError(e);
            }
            isLoadingRef.current = false;
        },
        [answers, creativity, LLM, storageService, fetchHistory, selectedTools, setToolStatuses]
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
        async (index: number) => {
            if (!activeChatRef.current || isLoadingRef.current) return;
            const activeChat = activeChatRef.current;

            try {
                isLoadingRef.current = true;
                setError(undefined);
                await handleRollback(index, activeChat, dispatch, storageService, lastQuestionRef, setQuestion, clearChat, fetchHistory);
            } catch (e) {
                setError(e);
            } finally {
                isLoadingRef.current = false;
            }
        },
        [storageService, clearChat, fetchHistory, setQuestion, isLoadingRef.current, activeChatRef.current]
    );

    // Konfigurationsänderungen mit memoisierten Callbacks
    const onCreativityChanged = useCallback(
        (newCreativity: string) => {
            dispatch({ type: "SET_CREATIVITY", payload: newCreativity });

            debouncedStorageUpdate({
                system: systemPrompt,
                creativity: newCreativity
            });
        },
        [systemPrompt, debouncedStorageUpdate]
    );

    const onSystemPromptChanged = useCallback(
        (newSystemPrompt: string) => {
            dispatch({ type: "SET_SYSTEM_PROMPT", payload: newSystemPrompt });

            debouncedStorageUpdate({
                system: newSystemPrompt,
                creativity: creativity
            });
        },
        [creativity, debouncedStorageUpdate]
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
            hashParams.delete("data");
            hashParams.delete("new");
            hashParams.delete("chatId");
            const newHashQuery = hashParams.toString();
            currentUrl.hash = newHashQuery ? `${hashPath}?${newHashQuery}` : hashPath;
        }

        // Handle search params (fallback navigation)
        if (currentUrl.search) {
            const searchParams = currentUrl.searchParams;
            searchParams.delete("q");
            searchParams.delete("question");
            searchParams.delete("tools");
            searchParams.delete("data");
            searchParams.delete("new");
            searchParams.delete("chatId");
            const newSearch = searchParams.toString();
            currentUrl.search = newSearch ? `?${newSearch}` : "";
        }

        window.history.replaceState(window.history.state, "", currentUrl.toString());
    }, []);

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find((m: Model) => m.llm_name === nextLLM);
            if (found) {
                setLLM(found);
                try {
                    localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, nextLLM);
                } catch {
                    // ignore storage errors
                }
            }
        },
        [availableLLMs, setLLM]
    );

    // Shared helper: converts UploadedData[] → DataSource[] (same logic as onSend)
    const uploadedDataToDataSources = useCallback((datas: UploadedData[]): DataSource[] => {
        return datas
            .filter(data => data.isActive && data.status === "ready" && !!data.fileContent)
            .map(data => ({
                title: data.name,
                content: data.fileContent!,
                metadata: {
                    source: data.source,
                    mime_type: data.mimeType || data.file?.type || undefined,
                    size: data.size,
                    parsed_at: data.parsedAt,
                    file_signature: data.fileSignature,
                    stored_document_id: data.storedDocumentId,
                    status: data.status
                }
            }));
    }, []);

    // State to track if initialization is complete
    const [isInitialized, setIsInitialized] = useState(false);
    const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
    // Effect to handle pending question after tools are loaded
    const scheduledQuestionRef = useRef<string | null>(null);
    const lastHandledNewChatTokenRef = useRef<string | null>(null);

    const getNavigationParams = useCallback(() => {
        const currentUrl = new URL(window.location.href);
        let queryParams = currentUrl.searchParams;

        if (currentUrl.hash && currentUrl.hash.includes("?")) {
            const [, hashQuery] = currentUrl.hash.split("?");
            queryParams = new URLSearchParams(hashQuery);
        }

        const questionFromUrl = queryParams.get("q") || queryParams.get("question");
        const toolsFromUrl = queryParams.get("tools");
        const dataFromUrl = queryParams.get("data");
        const newChatToken = queryParams.get("new");
        const chatIdFromUrl = queryParams.get("chatId");

        return {
            questionFromUrl,
            toolsFromUrl,
            dataFromUrl,
            newChatRequested: newChatToken !== null,
            newChatToken,
            chatIdFromUrl
        };
    }, [location.hash, location.search]);

    const startFreshChat = useCallback(async () => {
        scheduledQuestionRef.current = null;
        setQuestion("");
        setUploadedData([]);
        clearChat();
    }, [clearChat]);

    const isCurrentChatEmpty = useMemo(
        () => answers.length === 0 && question.trim() === "" && uploadedData.length === 0 && pendingQuestion === null,
        [answers.length, pendingQuestion, question, uploadedData.length]
    );

    // Stable ref for callApi so the pending-question effect doesn't
    // get cancelled/rescheduled every time callApi's identity changes
    // (which happens whenever answers, selectedTools, creativity, etc. update).
    const callApiRef = useRef(callApi);
    useEffect(() => {
        callApiRef.current = callApi;
    }, [callApi]);

    const hasRestoredLLMRef = useRef(false);

    useEffect(() => {
        if (hasRestoredLLMRef.current) return;
        if (!availableLLMs || availableLLMs.length === 0) return;

        const storedLLM = localStorage.getItem(STORAGE_KEYS.SETTINGS_LLM);
        if (storedLLM) {
            const preferredModel = availableLLMs.find(m => m.llm_name === storedLLM);
            if (preferredModel && preferredModel.llm_name !== LLM.llm_name) {
                setLLM(preferredModel);
            }
        }
        hasRestoredLLMRef.current = true;
    }, [availableLLMs, setLLM, LLM.llm_name]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.SELECTED_TOOLS, JSON.stringify(selectedTools));
        } catch {
            // ignore storage errors
        }
    }, [selectedTools]);

    useEffect(() => {
        if (!tools?.tools) return;

        const availableToolIds = new Set(tools.tools.map(tool => tool.id));
        setSelectedTools(prev => prev.filter(toolId => availableToolIds.has(toolId)));
    }, [tools]);

    // Initialisierung beim ersten Laden
    useEffect(() => {
        if (!isFirstRender.current) return;
        isFirstRender.current = false;

        isLoadingRef.current = true;

        // Check URL for question parameter - Handle hash router format
        const { questionFromUrl, toolsFromUrl, dataFromUrl, newChatRequested, newChatToken, chatIdFromUrl } = getNavigationParams();

        // Parse tools from URL if present
        if (toolsFromUrl) {
            const toolsArray = toolsFromUrl.split(",").filter(tool => tool.trim() !== "");
            setSelectedTools(parseStoredStringArray(toolsArray));
        } else {
            try {
                const storedTools = localStorage.getItem(STORAGE_KEYS.SELECTED_TOOLS);
                if (storedTools) {
                    setSelectedTools(parseStoredStringArray(JSON.parse(storedTools)));
                }
            } catch {
                // ignore storage errors
            }
        }

        // Parse data (file IDs) from URL if present
        if (dataFromUrl) {
            const fileIds = dataFromUrl.split(",").filter(id => id.trim() !== "");
            if (fileIds.length > 0) {
                const storedRawIds = localStorage.getItem(STORAGE_KEYS.CHAT_FILE_IDS);
                let validIds: string[] = [];
                if (storedRawIds) {
                    try {
                        const parsedIds = JSON.parse(storedRawIds);
                        // Check if the parameter IDs match the ones we stored
                        validIds = fileIds.filter(id => parsedIds.includes(id));
                    } catch (e) {
                        console.error("Failed to parse stored chat file IDs from localStorage:", e);
                    }
                }

                if (validIds.length > 0) {
                    // Look up documents from localStorage and create ready UploadedData items immediately
                    const storedDocs = getStoredParsedDocuments();
                    const restoredData: UploadedData[] = validIds
                        .map(id => {
                            const doc = storedDocs.find(d => d.id === id);
                            if (doc) {
                                return createUploadedDataFromContent(doc.content, doc.name, doc.id);
                            }
                            console.warn(`Stored document with id "${id}" not found in localStorage.`);
                            return null;
                        })
                        .filter((d): d is UploadedData => d !== null);

                    if (restoredData.length > 0) {
                        setUploadedData(restoredData);
                    } else {
                        console.warn("None of the requested documents could be restored from localStorage.");
                        clearNavigationQueryParams();
                    }
                } else {
                    console.warn("Requested files were not found in localStorage recent history. Please re-upload your files.");
                    // Clear the stale data URL parameter so it is not reprocessed
                    clearNavigationQueryParams();
                }
            }
        }

        if (chatIdFromUrl) {
            loadChat(chatIdFromUrl)
                .then(async loaded => {
                    if (!loaded) {
                        clearNavigationQueryParams();
                        await loadNewestChat();
                    }
                    return fetchHistory();
                })
                .finally(() => {
                    setIsInitialized(true);
                    isLoadingRef.current = false;
                });
        } else if (questionFromUrl || newChatRequested) {
            lastHandledNewChatTokenRef.current = newChatToken;
            setPendingQuestion(questionFromUrl);
            Promise.resolve(
                newChatRequested
                    ? startFreshChat()
                    : (() => {
                          clearChat();
                          return fetchHistory();
                      })()
            )
                .then(() => {
                    if (newChatRequested && !questionFromUrl) {
                        clearNavigationQueryParams();
                    }
                    setIsInitialized(true);
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        } else {
            // Normal initialization ohne URL-Parameter
            loadNewestChat()
                .then(() => {
                    setIsInitialized(true);
                    return fetchHistory();
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        }
    }, [clearChat, clearNavigationQueryParams, fetchHistory, getNavigationParams, loadChat, loadNewestChat]);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }

        const { chatIdFromUrl, newChatRequested, newChatToken } = getNavigationParams();

        if (chatIdFromUrl && chatIdFromUrl !== activeChatRef.current) {
            void loadChat(chatIdFromUrl).then(async loaded => {
                if (!loaded) {
                    clearNavigationQueryParams();
                    await loadNewestChat();
                    await fetchHistory();
                }
            });
            return;
        }

        if (!newChatRequested || !newChatToken || newChatToken === lastHandledNewChatTokenRef.current) {
            return;
        }

        lastHandledNewChatTokenRef.current = newChatToken;
        if (isCurrentChatEmpty) {
            clearNavigationQueryParams();
            return;
        }

        setPendingQuestion(null);
        void startFreshChat();
        clearNavigationQueryParams();
    }, [clearNavigationQueryParams, fetchHistory, getNavigationParams, isCurrentChatEmpty, isInitialized, loadChat, loadNewestChat, startFreshChat]);

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
        // Capture the current uploadedData snapshot for use inside the timeout
        const dataSnapshot = uploadedData;

        // Wait a bit more to ensure tools are properly set
        const timeoutId = window.setTimeout(() => {
            // Check if this question is still pending
            if (scheduledQuestionRef.current !== questionToAsk) {
                return;
            }
            const dataSources = uploadedDataToDataSources(dataSnapshot);
            // Use ref so this effect doesn't depend on callApi's identity
            callApiRef.current(questionToAsk, systemPrompt, dataSources.length > 0 ? dataSources : undefined);

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
    }, [isInitialized, pendingQuestion, tools, uploadedData, uploadedDataToDataSources, systemPrompt, clearNavigationQueryParams]);

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
                lastAnswerRef={lastAnswerRef}
            />
        ),
        [
            answers,
            onRegenerateResponseClicked,
            onRollbackMessage,
            error,
            callApi,
            systemPrompt,
            isLoadingRef.current,
            lastQuestionRef,
            chatMessageStreamEnd,
            lastAnswerRef
        ]
    );

    const examplesComponent = useMemo(() => <ExampleList examples={CHAT_EXAMPLES} onExampleClicked={onExampleClicked} />, [onExampleClicked]);

    const inputComponent = useMemo(
        () => (
            <QuestionInput
                clearOnSend
                disabled={isLoadingRef.current || error !== undefined}
                onSend={(question, datas) => {
                    const dataSources = uploadedDataToDataSources(datas);
                    callApi(question, systemPrompt, dataSources.length > 0 ? dataSources : undefined);
                }}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={tools}
                uploadedData={uploadedData}
                setUploadedData={setUploadedData}
            />
        ),
        [callApi, systemPrompt, question, t, isLoadingRef.current, selectedTools, tools, uploadedData, uploadedDataToDataSources]
    );

    const layout = useMemo(
        () => (
            <>
                <ChatSettingsDialog
                    open={isSettingsOpen}
                    onOpenChange={setIsSettingsOpen}
                    creativity={creativity}
                    setCreativity={onCreativityChanged}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={onSystemPromptChanged}
                />
                <ChatLayout
                    examples={examplesComponent}
                    answers={answerList}
                    input={inputComponent}
                    showExamples={!lastQuestionRef.current}
                    header={t("chat.header")}
                    welcomeMessage={t("chat.header")}
                    header_as_markdown={false}
                    messages_description={t("common.messages")}
                    llmOptions={availableLLMs}
                    defaultLLM={LLM.llm_name}
                    onLLMSelectionChange={onLLMSelectionChange}
                    actions={
                        <Button
                            appearance="transparent"
                            icon={<Settings24Regular />}
                            onClick={() => setIsSettingsOpen(true)}
                            aria-label={t("components.chattsettingsdrawer.title")}
                        />
                    }
                />
            </>
        ),
        [
            examplesComponent,
            answerList,
            inputComponent,
            lastQuestionRef.current,
            t,
            availableLLMs,
            LLM.llm_name,
            onLLMSelectionChange,
            clearChat,
            isLoadingRef.current,
            isSettingsOpen,
            creativity,
            onCreativityChanged,
            systemPrompt,
            onSystemPromptChanged
        ]
    );

    return layout;
};

export default Chat;
