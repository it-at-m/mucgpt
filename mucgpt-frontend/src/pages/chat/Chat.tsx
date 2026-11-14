import { useRef, useState, useEffect, useContext, useCallback, useMemo, useReducer } from "react";

import { AskResponse, ChatResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { CHAT_STORE, CREATIVITY_LOW } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { FollowUpActionContext } from "../../components/FollowUpAction";
import { CanvasWiring, getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { getConversationActionCapabilities } from "../../utils/conversationActions";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { initialRunActivity, type RunActivity } from "../../utils/agUiActivity";
import { Model } from "../../api";
import { useToolsContext } from "../../components/ToolsProvider";
import { Code24Regular, Settings24Regular } from "@fluentui/react-icons";
import { Button } from "@fluentui/react-components";
import { ChatSettingsDialog } from "../../components/ChatSettingsDialog/ChatSettingsDialog";
import {
    getSelectedDocumentIds,
    isLibraryDocument,
    isSendBlockedByDocuments,
    restoreDocumentSelection,
    toChatDocument,
    type ChatDocument
} from "../../components/ChatDocuments/documentSelection";
import { listDocumentsApi } from "../../api/documents-client";
import { useToolApproval } from "../../hooks/useToolApproval";
import { useToolStatusToasts } from "../../hooks/useToolStatusToasts";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { useCanvasController } from "../../hooks/useCanvasController";
import { CanvasSplitView } from "../../components/Canvas/CanvasSplitView";
import { useUnifiedHistory, useUnifiedHistoryRegistration } from "../../components/UnifiedHistory";
import { useLocation, useNavigate } from "react-router-dom";
import { UserContext } from "../layout/UserContextProvider";
import { AgUiEventDrawer, type AgUiEventLogEntry } from "../../components/AgUiEventDrawer/AgUiEventDrawer";
import { scrollIntoNearestContainer } from "../../utils/scrollIntoNearestContainer";
import { loadConversation } from "../../service/conversationHistory";
import { CANVAS_TOOL_IDS, setCopyIntoCanvasHandler } from "../../utils/canvasStream";
import { useCanvasLimits } from "../../components/Canvas/canvasLimits";

const requestPersist = true;
const conversationActions = getConversationActionCapabilities(requestPersist);

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
    document_ids?: string[];
}

const WELCOME_MESSAGE_KEYS = ["home.chat_header"];
const NAMELESS_WELCOME_MESSAGE_KEY = "chat.header";

function pickWelcomeMessageKey(): string {
    return WELCOME_MESSAGE_KEYS[Math.floor(Math.random() * WELCOME_MESSAGE_KEYS.length)];
}

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
    const navigate = useNavigate();
    const { refreshHistory: refreshUnifiedHistory } = useUnifiedHistory();
    const { setFollowUpActions } = useContext(FollowUpActionContext);
    const { tools } = useToolsContext();
    const { user } = useContext(UserContext);
    // The raw AG-UI event log is a debugging aid; users see the run activity instead.
    const showAgUiEventLog = import.meta.env.DEV;

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
    const [runActivity, setRunActivity] = useState<RunActivity>(initialRunActivity);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [chatDocuments, setChatDocuments] = useState<ChatDocument[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // True from the moment a request is sent until the answer has fully finished streaming.
    // Unlike `isLoading` (which only covers the wait for the first token), this stays true for the
    // whole generation, so follow-up actions can be hidden until the message is completely rendered.
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
    const [agUiEvents, setAgUiEvents] = useState<AgUiEventLogEntry[]>([]);

    useToolStatusToasts(toolStatuses);
    const toolApproval = useToolApproval();
    const { requestApproval: requestToolApproval, cancel: cancelToolApproval } = toolApproval;
    const { showWarning } = useGlobalToastContext();

    // Related states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        creativity: CREATIVITY_LOW,
        systemPrompt: "",
        active_chat: undefined,
        allChats: []
    });

    // Destructuring for easier access
    const { answers, creativity, systemPrompt, active_chat, allChats } = chatState;
    const canvas = useCanvasController(active_chat);
    const canvasRef = useRef(canvas);
    canvasRef.current = canvas;
    const activeChatName = useMemo(() => allChats.find(chat => chat.id === active_chat)?.name, [active_chat, allChats]);

    // Picked once per mount so the greeting doesn't change while the empty state is visible.
    const welcomeMessageKeyRef = useRef(pickWelcomeMessageKey());
    const username = user?.given_name || user?.name || "";
    const welcomeMessageKey = username ? welcomeMessageKeyRef.current : NAMELESS_WELCOME_MESSAGE_KEY;
    const welcomeMessage = t(welcomeMessageKey, { user: username, defaultValue: "Hallo {{user}}, was hast du heute vor?" });

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const lastAnswerRef = useRef<HTMLDivElement | null>(null);
    const isFirstRender = useRef(true);
    const activeChatRef = useRef(active_chat);
    const documentSelectionRequestTokenRef = useRef(0);
    const isLoadingRef = useRef(false);

    const setLoadingState = useCallback((nextLoading: boolean) => {
        isLoadingRef.current = nextLoading;
        setIsLoading(nextLoading);
    }, []);

    const handleAgUiEvent = useCallback((event: AgUiEventLogEntry["event"]) => {
        setAgUiEvents(current => [...current, { event, receivedAt: new Date().toISOString() }].slice(-200));
    }, []);

    // Invalidate pending document selections only on a real chat switch; StrictMode re-runs this effect on mount.
    useEffect(() => {
        if (activeChatRef.current !== active_chat) documentSelectionRequestTokenRef.current += 1;
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Storage Service mit useMemo
    const storageService = useStorageService(activeChatRef.current);

    // Add a scroll function
    const scrollToBottom = useCallback(() => {
        if (chatMessageStreamEnd.current) {
            scrollIntoNearestContainer(chatMessageStreamEnd.current);
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

    const resetInputState = useCallback(() => {
        setQuestion("");
        setChatDocuments([]);
    }, []);
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
                cancelToolApproval();
                ++documentSelectionRequestTokenRef.current;
                setError(undefined);
                const chat = await loadConversation(storageService, id, id, { system: "", creativity: CREATIVITY_LOW });
                if (chat) {
                    // The transcript must load even when the document library is
                    // unreachable: fall back to an empty selection with a warning.
                    let selection: ChatDocument[] = [];
                    try {
                        selection = await restoreDocumentSelection(chat.documentIds ?? [], chat.documentNames);
                    } catch (restoreError) {
                        console.error("Could not restore document selection:", restoreError);
                        showWarning(t("document_library.restore_failed_title"), t("document_library.restore_failed_message"));
                    }
                    dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                    dispatch({ type: "SET_CREATIVITY", payload: chat.config.creativity });
                    dispatch({ type: "SET_SYSTEM_PROMPT", payload: chat.config.system });
                    dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
                    resetInputState();
                    setChatDocuments(selection);
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
        [storageService, scrollToBottom, resetInputState, showWarning, t, cancelToolApproval]
    );

    // Clear chat state
    const clearChat = useCallback(() => {
        cancelToolApproval();
        lastQuestionRef.current = "";
        setError(undefined);
        dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [lastQuestionRef.current, cancelToolApproval]);

    useUnifiedHistoryRegistration(
        useMemo(
            () => ({
                kind: "chat",
                activeChatId: active_chat,
                resetActiveChat: (chatId: string) => {
                    if (chatId === activeChatRef.current) {
                        resetInputState();
                        clearChat();
                    }
                }
            }),
            [active_chat, clearChat, resetInputState]
        )
    );

    // Canvas ↔ chat wiring: the request carries the current
    // canvas state, and stream events + run lifecycle are routed into the editor.
    // The ref keeps the wiring stable while the controller identity changes.
    const canvasLimits = useCanvasLimits();
    const canvasWiring = useMemo<CanvasWiring>(() => {
        let runHadCanvasActivity = false;
        return {
            getCanvasState: () => canvasRef.current.toCanvasState(),
            streamContentLimit: canvasLimits.editorLimitChars,
            onStreamEvent: event => {
                const c = canvasRef.current;
                if (!runHadCanvasActivity && event.state === "STARTED") {
                    runHadCanvasActivity = true;
                    // Pre-edit snapshot exactly when the agent starts writing (the
                    // editor still holds the pre-edit content); runs without canvas
                    // activity stay out of the revision rings entirely.
                    if (c.getMarkdown().trim()) c.snapshot("agent");
                    // The canvas is always editable: an agent change while the
                    // panel is closed opens the view so the user follows along.
                    if (!c.isOpen) c.setIsOpen(true);
                }
                c.applyStreamEvent(event);
            },
            onRunStarted: () => {
                const c = canvasRef.current;
                runHadCanvasActivity = false;
                // The guard reset and lock must run for every run: even a closed
                // canvas is sent with the request (its content rides along), so
                // the agent may write — the first canvas event auto-opens the view.
                c.beginRun();
            },
            onRunFinished: () => {
                const c = canvasRef.current;
                if (runHadCanvasActivity && c.isOpen && c.getMarkdown().trim()) c.snapshot("agent");
                runHadCanvasActivity = false;
                c.unlock();
            }
        };
    }, []);

    // "Copy into Canvas" from the legacy fenced fallback: fragments have no
    // access to the page, so they call through the canvasStream bridge.
    useEffect(() => {
        setCopyIntoCanvasHandler(markdown => {
            canvasRef.current.setMarkdown(markdown);
            canvasRef.current.setIsOpen(true);
        });
        return () => setCopyIntoCanvasHandler(undefined);
    }, []);

    // Selection context menu: quote the selection into the chat input, or
    // insert the agent-revise instruction template.
    const insertCanvasSelectionIntoChat = useCallback((markdown: string) => {
        const quote =
            markdown
                .split("\n")
                .map(line => `> ${line}`)
                .join("\n") + "\n\n";
        setQuestion(prev => (prev ? prev.trimEnd() + "\n\n" : "") + quote);
    }, []);
    const insertCanvasReviseRequest = useCallback(
        (markdown: string) => {
            setQuestion(t("canvas.context_menu.agent_revise_template", { selection: markdown }));
        },
        [t]
    );

    // Follow-ups, regenerate and URL questions bypass the composer's send button, so they check the attachments here.
    const ensureDocumentsSendable = useCallback(() => {
        if (!isSendBlockedByDocuments(chatDocuments)) return true;
        showWarning(t("document_library.send_blocked_title"), t("document_library.send_blocked_message"));
        return false;
    }, [chatDocuments, showWarning, t]);

    // API Request mit optimiertem State Management
    const callApi = useCallback(
        async (question: string, system?: string) => {
            if (!ensureDocumentsSendable()) return;
            lastQuestionRef.current = question;
            setError(undefined);
            setLoadingState(true);
            setIsStreaming(true);

            const askResponse: ChatResponse = { answer: "", tokens: 0, user_tokens: 0 } as AskResponse;
            const options: ChatOptions = {
                system: system ?? "",
                creativity: creativity,
                document_ids: getSelectedDocumentIds(chatDocuments)
            };
            try {
                await makeApiRequest(
                    answers,
                    question,
                    dispatch,
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
                    undefined,
                    lastAnswerRef,
                    setLoadingState,
                    requestPersist,
                    showAgUiEventLog ? handleAgUiEvent : undefined,
                    setRunActivity,
                    canvasWiring,
                    requestToolApproval
                );
            } catch (e) {
                setError(e);
            } finally {
                setLoadingState(false);
                setIsStreaming(false);
            }
        },
        [
            answers,
            creativity,
            LLM,
            storageService,
            fetchHistory,
            selectedTools,
            setToolStatuses,
            setLoadingState,
            showAgUiEventLog,
            handleAgUiEvent,
            canvasWiring,
            chatDocuments,
            ensureDocumentsSendable,
            requestToolApproval
        ]
    );

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (!conversationActions.canRegenerate || answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;
        // Regenerate drops the last answer before sending, so it must check before that, not only in callApi.
        if (!ensureDocumentsSendable()) return;

        try {
            await handleRegenerate(answers, dispatch, activeChatRef.current, storageService, systemPrompt, callApi, isLoadingRef, requestPersist);
        } catch (e) {
            setError(e);
        }
    }, [answers, storageService, callApi, ensureDocumentsSendable, systemPrompt, activeChatRef.current, isLoadingRef.current]);

    // Rollback-Funktion
    const onRollbackMessage = useCallback(
        async (index: number) => {
            if (!activeChatRef.current || isLoadingRef.current) return;
            const activeChat = activeChatRef.current;

            try {
                setLoadingState(true);
                setError(undefined);
                await handleRollback(index, activeChat, dispatch, storageService, lastQuestionRef, setQuestion, clearChat, fetchHistory);
            } catch (e) {
                setError(e);
            } finally {
                setLoadingState(false);
            }
        },
        [storageService, clearChat, fetchHistory, setQuestion, isLoadingRef.current, activeChatRef.current, setLoadingState]
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
            hashParams.delete("documents");
            hashParams.delete("new");
            hashParams.delete("chatId");
            hashParams.delete("canvas");
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
            searchParams.delete("documents");
            searchParams.delete("new");
            searchParams.delete("chatId");
            searchParams.delete("canvas");
            const newSearch = searchParams.toString();
            currentUrl.search = newSearch ? `?${newSearch}` : "";
        }

        window.history.replaceState(window.history.state, "", currentUrl.toString());
    }, []);

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find((m: Model) => m.id === nextLLM);
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

    // State to track if initialization is complete
    const [isInitialized, setIsInitialized] = useState(false);
    const [isDocumentSelectionReady, setIsDocumentSelectionReady] = useState(false);
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
        const documentsFromUrl = queryParams.get("documents");
        const newChatToken = queryParams.get("new");
        const chatIdFromUrl = queryParams.get("chatId");
        const canvasRequested = queryParams.get("canvas") !== null;

        return {
            questionFromUrl,
            toolsFromUrl,
            documentsFromUrl,
            newChatRequested: newChatToken !== null,
            newChatToken,
            chatIdFromUrl,
            canvasRequested
        };
    }, [location.hash, location.search]);

    const startFreshChat = useCallback(async () => {
        scheduledQuestionRef.current = null;
        resetInputState();
        clearChat();
    }, [clearChat, resetInputState]);

    const isCurrentChatEmpty = useMemo(
        () => answers.length === 0 && question.trim() === "" && chatDocuments.length === 0 && pendingQuestion === null,
        [answers.length, pendingQuestion, question, chatDocuments.length]
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
            const preferredModel = availableLLMs.find(m => m.id === storedLLM);
            if (preferredModel && preferredModel.id !== LLM.id) {
                setLLM(preferredModel);
            }
        }
        hasRestoredLLMRef.current = true;
    }, [availableLLMs, setLLM, LLM.id]);

    useEffect(() => {
        try {
            // Canvas tool ids never belong to the persisted selection (base tools,
            // hidden from the selector); filter them out in case stale storage
            // still contains them from earlier versions.
            localStorage.setItem(STORAGE_KEYS.SELECTED_TOOLS, JSON.stringify(selectedTools.filter(id => !(CANVAS_TOOL_IDS as readonly string[]).includes(id))));
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
        const { questionFromUrl, toolsFromUrl, documentsFromUrl, newChatRequested, newChatToken, chatIdFromUrl, canvasRequested } = getNavigationParams();

        if (documentsFromUrl && !chatIdFromUrl) {
            const ids = documentsFromUrl.split(",");
            const documentSelectionRequestToken = documentSelectionRequestTokenRef.current;
            listDocumentsApi()
                .then(documents => {
                    if (documentSelectionRequestToken !== documentSelectionRequestTokenRef.current) return;
                    const selected = documents.filter(document => ids.includes(document.id) && document.status === "ready");
                    if (selected.length !== new Set(ids).size) throw new Error("Selected documents are unavailable.");
                    setChatDocuments(previous => [
                        ...previous.filter(document => !isLibraryDocument(document)),
                        ...selected.map(document => toChatDocument(document))
                    ]);
                    setIsDocumentSelectionReady(true);
                })
                .catch(() => {
                    if (documentSelectionRequestToken !== documentSelectionRequestTokenRef.current) return;
                    // The pending question must not stall forever: proceed without
                    // documents and surface why the selection was not applied.
                    showWarning(t("document_library.restore_failed_title"), t("document_library.restore_failed_message"));
                    setIsDocumentSelectionReady(true);
                });
        } else {
            setIsDocumentSelectionReady(true);
        }

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

        if (chatIdFromUrl) {
            loadChat(chatIdFromUrl)
                .then(async loaded => {
                    if (!loaded) {
                        clearNavigationQueryParams();
                        resetInputState();
                        clearChat();
                    }
                    return fetchHistory();
                })
                .finally(() => {
                    setIsInitialized(true);
                    isLoadingRef.current = false;
                });
        } else if (questionFromUrl || newChatRequested) {
            lastHandledNewChatTokenRef.current = newChatToken;
            if (newChatRequested && canvasRequested) {
                canvasRef.current.requestOpen();
            }
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
            Promise.resolve(clearChat())
                .then(() => {
                    setIsInitialized(true);
                    return fetchHistory();
                })
                .finally(() => {
                    isLoadingRef.current = false;
                });
        }
    }, [clearChat, clearNavigationQueryParams, fetchHistory, getNavigationParams, loadChat, resetInputState]);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }

        const { chatIdFromUrl, newChatRequested, newChatToken, canvasRequested } = getNavigationParams();

        if (chatIdFromUrl && chatIdFromUrl !== activeChatRef.current) {
            void loadChat(chatIdFromUrl).then(async loaded => {
                if (!loaded) {
                    clearNavigationQueryParams();
                    resetInputState();
                    clearChat();
                    await fetchHistory();
                }
            });
            return;
        }

        if (!newChatRequested || !newChatToken || newChatToken === lastHandledNewChatTokenRef.current) {
            return;
        }

        lastHandledNewChatTokenRef.current = newChatToken;
        if (canvasRequested) {
            canvasRef.current.requestOpen();
        }
        if (isCurrentChatEmpty) {
            clearNavigationQueryParams();
            return;
        }

        setPendingQuestion(null);
        void startFreshChat();
        clearNavigationQueryParams();
    }, [clearNavigationQueryParams, fetchHistory, getNavigationParams, isCurrentChatEmpty, isInitialized, loadChat, resetInputState, startFreshChat]);

    useEffect(() => {
        if (!isInitialized || !isDocumentSelectionReady || !pendingQuestion || tools === undefined) {
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
            // Use ref so this effect doesn't depend on callApi's identity
            callApiRef.current(questionToAsk, systemPrompt);

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
    }, [isInitialized, isDocumentSelectionReady, pendingQuestion, tools, systemPrompt, clearNavigationQueryParams]);

    // Set up follow-up actions
    useEffect(() => {
        setFollowUpActions([
            {
                label: t("chat.follow_up_actions.shorter", { lng: language }),
                prompt: t("chat.follow_up_actions.shorter_prompt", { lng: language })
            },
            {
                label: t("chat.follow_up_actions.formal", { lng: language }),
                prompt: t("chat.follow_up_actions.formal_prompt", { lng: language })
            },
            {
                label: t("chat.follow_up_actions.informal", { lng: language }),
                prompt: t("chat.follow_up_actions.informal_prompt", { lng: language })
            },
            {
                label: t("chat.follow_up_actions.longer", { lng: language }),
                prompt: t("chat.follow_up_actions.longer_prompt", { lng: language })
            }
        ]);

        return () => setFollowUpActions([]);
    }, [language, t, setFollowUpActions]);

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
                                    isLatest
                                    isStreaming={isStreaming}
                                    onRegenerateResponseClicked={conversationActions.canRegenerate ? onRegenerateResponseClicked : undefined}
                                    regenerationUnavailableReason={
                                        !conversationActions.canRegenerate ? t("components.answer.persisted_actions_unavailable") : undefined
                                    }
                                    onFollowUpActionSend={prompt => callApi(prompt, systemPrompt)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={`answer-${index}`} answer={answer.response} />}
                        </>
                    );
                }}
                onRollbackMessage={onRollbackMessage}
                isLoading={isLoading}
                loadingActivity={runActivity}
                toolApproval={toolApproval}
                error={error}
                makeApiRequest={() => {
                    if (!conversationActions.canRetry || isLoadingRef.current) return;
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                    callApi(lastQuestionRef.current, systemPrompt);
                }}
                canRetry={conversationActions.canRetry}
                retryUnavailableReason={!conversationActions.canRetry ? t("components.answer.persisted_actions_unavailable") : undefined}
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
            isLoading,
            runActivity,
            toolApproval,
            isStreaming,
            lastQuestionRef,
            chatMessageStreamEnd,
            lastAnswerRef,
            t
        ]
    );

    // Running token/cost usage for this chat, derived from the usage data the backend
    // attaches to the final chunk of each streamed response (see page_helpers.ts).
    const usageSummary = useMemo(() => {
        let totalCost = 0;
        let lastContextTokens = 0;
        let maxInputTokens: number | null | undefined;
        let warningThresholdPercent: number | undefined;
        let criticalThresholdPercent: number | undefined;
        for (const answer of answers) {
            totalCost += answer.response.usage_cost ?? 0;
            // Skip the still-streaming placeholder answer, which has no context_tokens yet,
            // so the indicator keeps showing the last known usage instead of resetting to 0.
            if (typeof answer.response.context_tokens === "number") {
                lastContextTokens = answer.response.context_tokens;
                maxInputTokens = answer.response.usage_max_input_tokens;
                warningThresholdPercent = answer.response.usage_context_warning_threshold_percent;
                criticalThresholdPercent = answer.response.usage_context_critical_threshold_percent;
            }
        }
        if (lastContextTokens === 0 && totalCost === 0) return undefined;
        return { totalCost, lastContextTokens, maxInputTokens, warningThresholdPercent, criticalThresholdPercent };
    }, [answers]);

    const startNewChatFromUsage = useCallback(() => {
        navigate(`/chat?new=${Date.now()}`);
    }, [navigate]);

    const inputComponent = useMemo(() => {
        const { questionFromUrl, newChatRequested } = getNavigationParams();

        return (
            <QuestionInput
                clearOnSend
                disabled={isLoading || isStreaming}
                draftCacheKey="chat-main"
                skipDraftRestore={!!questionFromUrl || newChatRequested}
                onSend={question => callApi(question, systemPrompt)}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={tools}
                documents={chatDocuments}
                setDocuments={setChatDocuments}
                usage={usageSummary}
                onStartNewChat={startNewChatFromUsage}
                usageConversationKey={`chat:${active_chat ?? "new"}`}
                hideDisclaimer
                llmOptions={availableLLMs}
                selectedLLM={LLM.id}
                onLLMSelectionChange={onLLMSelectionChange}
            />
        );
    }, [
        active_chat,
        callApi,
        systemPrompt,
        question,
        t,
        isLoading,
        isStreaming,
        selectedTools,
        tools,
        chatDocuments,
        getNavigationParams,
        startNewChatFromUsage,
        usageSummary,
        availableLLMs,
        LLM.id,
        onLLMSelectionChange
    ]);

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
                {showAgUiEventLog && (
                    <AgUiEventDrawer
                        open={isEventDrawerOpen}
                        events={agUiEvents}
                        onClose={() => setIsEventDrawerOpen(false)}
                        onClear={() => setAgUiEvents([])}
                    />
                )}
                <ChatLayout
                    answers={answerList}
                    input={inputComponent}
                    showStarterPrompts={!lastQuestionRef.current}
                    header={activeChatName ?? ""}
                    welcomeMessage={welcomeMessage}
                    header_as_markdown={false}
                    messages_description={t("common.messages")}
                    actions={
                        <>
                            {showAgUiEventLog && (
                                <Button
                                    appearance="transparent"
                                    icon={<Code24Regular />}
                                    onClick={() => setIsEventDrawerOpen(true)}
                                    aria-label={t("chat.show_ag_ui_events")}
                                />
                            )}
                            <Button
                                appearance="transparent"
                                icon={<Settings24Regular />}
                                onClick={() => setIsSettingsOpen(true)}
                                aria-label={t("components.chattsettingsdrawer.title")}
                            />
                        </>
                    }
                />
            </>
        ),
        [
            answerList,
            inputComponent,
            lastQuestionRef.current,
            t,
            welcomeMessage,
            clearChat,
            activeChatName,
            isLoading,
            isSettingsOpen,
            creativity,
            onCreativityChanged,
            systemPrompt,
            onSystemPromptChanged,
            showAgUiEventLog,
            isEventDrawerOpen,
            agUiEvents
        ]
    );

    return (
        <CanvasSplitView
            controller={canvas}
            conversationId={active_chat}
            onInsertIntoChat={insertCanvasSelectionIntoChat}
            onAgentRevise={insertCanvasReviseRequest}
        >
            {layout}
        </CanvasSplitView>
    );
};

export default Chat;
