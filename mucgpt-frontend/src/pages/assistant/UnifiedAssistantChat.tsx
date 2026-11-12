import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";
import { AskResponse, Assistant, AssistantResponse, ChatResponse, DataSource } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { useTranslation } from "react-i18next";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { StarterPromptList } from "../../components/StarterPrompt";
import { FollowUpActionContext } from "../../components/FollowUpAction";
import { CanvasWiring, getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { getConversationActionCapabilities } from "../../utils/conversationActions";
import { ChatOptions } from "../chat/Chat";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { initialRunActivity, type RunActivity } from "../../utils/agUiActivity";
import { AssistantStrategy, CommunityAssistantStrategy, DeletedCommunityAssistantStrategy, LocalAssistantStrategy } from "./AssistantStrategy";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { getOwnedCommunityAssistants, getUserSubscriptionsApi, subscribeToAssistantApi, unsubscribeFromAssistantApi } from "../../api/assistant-client";
import { NotSubscribedDialog } from "../../components/NotSubscribedDialog";
import { useToolsContext } from "../../components/ToolsProvider";
import { Button, Skeleton, SkeletonItem } from "@fluentui/react-components";
import { Info24Regular, Settings24Regular } from "@fluentui/react-icons";
import { AssistantEditorPage } from "../../components/AssistantDialogs/AssistantEditorPage/AssistantEditorPage";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import { AssistantStateCallout } from "../../components/AssistantStateCallout/AssistantStateCallout";
import { getCommunityAssistantApi } from "../../api/assistant-client";
import { ApiError } from "../../api/fetch-utils";
import {
    isCompleteCommunityAssistantSnapshot,
    mapAssistantResponseToSnapshot,
    mapAssistantToCommunitySnapshot,
    mapCommunitySnapshotToAssistant,
    upsertCommunityAssistantSnapshot
} from "../../utils/community-assistant-snapshots";
import { useDuplicateAssistant } from "../discovery/hooks/useDuplicateAssistant";
import { useMigrateLocalAssistant } from "../../hooks/useMigrateLocalAssistant";
import { CloseConfirmationDialog } from "../../components/AssistantDialogs/shared/CloseConfirmationDialog";
import { UploadedData } from "../../components/ContextManagerDialog/ContextManagerDialog";
import { useToolStatusToasts } from "../../hooks/useToolStatusToasts";
import { useCanvasController } from "../../hooks/useCanvasController";
import { CanvasSplitView } from "../../components/Canvas/CanvasSplitView";
import styles from "./UnifiedAssistantChat.module.css";
import { useUnifiedHistory, useUnifiedHistoryRegistration } from "../../components/UnifiedHistory";
import { downloadAssistantExport, mapAssistantToExportData } from "../../utils/assistant-export";
import { scrollIntoNearestContainer } from "../../utils/scrollIntoNearestContainer";
import { loadConversation } from "../../service/conversationHistory";
import { setCopyIntoCanvasHandler } from "../../utils/canvasStream";
import { useCanvasLimits } from "../../components/Canvas/canvasLimits";

const requestPersist = true;
const conversationActions = getConversationActionCapabilities(requestPersist);

interface UnifiedAssistantChatProps {
    strategy: AssistantStrategy;
}

/** Strategy-driven chat page shared by the personal and community assistant views. */
const UnifiedAssistantChat = ({ strategy }: UnifiedAssistantChatProps) => {
    // useReducer für den Chat-Status
    const chatReducer = getChatReducer<Assistant>();
    // Combined states with useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        creativity: CREATIVITY_LOW,
        systemPrompt: "",
        active_chat: undefined,
        allChats: []
    });

    const { showError, showSuccess } = useGlobalToastContext();

    // Destructuring for easier access
    const { answers, creativity, systemPrompt, active_chat } = chatState;

    // References
    const activeChatRef = useRef(active_chat);
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const lastAnswerRef = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);
    const assistantInfoRequestIdRef = useRef(0);
    const handledNewChatTokenRef = useRef<string | null>(null);

    // useEffect für den Chat-Status
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Parameter from URL
    const { id } = useParams();
    const assistant_id = id || "0";
    // Assistant chats use a prefixed local id as the storage key; the server
    // canvas API expects the plain backend conversation id.
    const canvasServerConversationId = useMemo(() => {
        if (!active_chat) return undefined;
        const prefix = AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id);
        return active_chat.startsWith(prefix) ? active_chat.slice(prefix.length) : active_chat;
    }, [active_chat, assistant_id]);
    const canvas = useCanvasController(active_chat, canvasServerConversationId);
    const canvasRef = useRef(canvas);
    canvasRef.current = canvas;
    const isLegacyAssistant = /^\d+$/.test(assistant_id);
    const draftCacheKey = useMemo(() => `assistant-chat:${assistant_id}`, [assistant_id]);
    const location = useLocation();
    const navigate = useNavigate();
    const isEditMode = location.pathname.endsWith("/edit");

    // Context
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { refreshHistory: refreshUnifiedHistory } = useUnifiedHistory();
    const { setFollowUpActions } = useContext(FollowUpActionContext);
    const { tools } = useToolsContext();

    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const [runActivity, setRunActivity] = useState<RunActivity>(initialRunActivity);
    const [showNotSubscribedDialog, setShowNotSubscribedDialog] = useState<boolean>(false);
    const [noAccess, setNoAccess] = useState<boolean>(false);
    const [isUnsubscribed, setIsUnsubscribed] = useState<boolean>(false);
    const [isAssistantMissing, setIsAssistantMissing] = useState<boolean>(false);
    const [isAccessRevoked, setIsAccessRevoked] = useState<boolean>(false);
    const [uploadedData, setUploadedData] = useState<UploadedData[]>([]);
    const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState<boolean>(false);
    const [assistantInfoData, setAssistantInfoData] = useState<AssistantCardData | null>(null);
    const [isAssistantInfoLoading, setIsAssistantInfoLoading] = useState<boolean>(false);
    const [isOwnershipResolved, setIsOwnershipResolved] = useState<boolean>(!(strategy instanceof CommunityAssistantStrategy));
    const [lastQuestion, setLastQuestion] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    // True from request start until the answer has fully finished streaming (see the same flag in Chat.tsx).
    // Used to hide follow-up actions until the message is completely rendered.
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [isAssistantContentLoading, setIsAssistantContentLoading] = useState<boolean>(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState<boolean>(false);
    const isDeletedAssistant = strategy instanceof DeletedCommunityAssistantStrategy;
    const isLocalAssistant = strategy instanceof LocalAssistantStrategy;
    // Missing config, lapsed subscription, or revoked access: history stays viewable, but the chat is read-only.
    const historyReadOnly = isDeletedAssistant || isUnsubscribed || isAssistantMissing || isAccessRevoked;
    const { assistantToDuplicate, showDuplicateConfirm, isDuplicating, setShowDuplicateConfirm, requestDuplicateAssistant, confirmDuplicateAssistant } =
        useDuplicateAssistant();
    // Sync info drawer state to body class so Layout.module.css can offset the footer
    useEffect(() => {
        document.body.classList.toggle("info-drawer-open", isInfoDrawerOpen);
        return () => document.body.classList.remove("info-drawer-open");
    }, [isInfoDrawerOpen]);

    useToolStatusToasts(toolStatuses);

    // StorageServices
    const assistantStorageService: AssistantStorageService = useMemo(() => new AssistantStorageService(ASSISTANT_STORE), []);
    const {
        showMigrateConfirm: showLocalMigrateConfirm,
        setShowMigrateConfirm: setShowLocalMigrateConfirm,
        performMigration
    } = useMigrateLocalAssistant(assistantStorageService);
    const communityAssistantStorageService = useMemo(() => new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE), []);
    const assistantChatStorage: StorageService<ChatResponse, Assistant> = useMemo(
        () => assistantStorageService.getChatStorageService(),
        [assistantStorageService]
    );

    //config
    const [assistantConfig, setAssistantConfig] = useState<Assistant>({
        title: "Titel",
        description: "Beschreibung",
        publish: false,
        system_message: "",
        creativity: "medium",
        quick_prompts: [],
        examples: [],
        version: "0",
        is_visible: true
    });
    const isAssistantUnavailable = assistantConfig.state === "pending_legal_review" || assistantConfig.state === "inactive";
    const canEdit =
        strategy.canEdit &&
        !isAssistantMissing &&
        (strategy instanceof LocalAssistantStrategy || assistantConfig.state === "active" || assistantConfig.state === "pending_legal_review");
    const lockedToolIds = useMemo(() => assistantConfig.tools?.map(tool => tool.id) ?? [], [assistantConfig.tools]);

    useEffect(() => {
        if (!isEditMode || isAssistantContentLoading || (canEdit && !isLegacyAssistant)) return;
        navigate(location.pathname.replace(/\/edit$/, ""), { replace: true });
    }, [isEditMode, isAssistantContentLoading, canEdit, isLegacyAssistant, navigate, location.pathname]);
    const setLastQuestionValue = useCallback((value: string) => {
        lastQuestionRef.current = value;
        setLastQuestion(value);
    }, []);
    const setIsLoadingValue = useCallback((value: boolean) => {
        isLoadingRef.current = value;
        setIsLoading(value);
    }, []);
    const locationRef = useRef(location);
    locationRef.current = location;

    const getRequestedChatId = useCallback(() => new URLSearchParams(locationRef.current.search).get("chatId"), []);
    const requestedChatId = useMemo(() => new URLSearchParams(location.search).get("chatId"), [location.search]);
    const getNewChatToken = useCallback(() => new URLSearchParams(locationRef.current.search).get("new"), []);
    const clearRequestedChatId = useCallback(() => {
        const searchParams = new URLSearchParams(locationRef.current.search);
        if (!searchParams.has("chatId")) {
            return;
        }

        searchParams.delete("chatId");
        const nextSearch = searchParams.toString();
        navigate(
            {
                pathname: locationRef.current.pathname,
                search: nextSearch ? `?${nextSearch}` : ""
            },
            { replace: true }
        );
    }, [navigate]);
    const clearNewChatRequest = useCallback(() => {
        const searchParams = new URLSearchParams(locationRef.current.search);
        if (!searchParams.has("new") && !searchParams.has("chatId")) {
            return;
        }

        searchParams.delete("new");
        searchParams.delete("chatId");
        const nextSearch = searchParams.toString();
        navigate(
            {
                pathname: locationRef.current.pathname,
                search: nextSearch ? `?${nextSearch}` : ""
            },
            { replace: true }
        );
    }, [navigate]);
    // Tool selection is locked to the assistant's configured tools: selection
    // changes are ignored, and lockedToolIds drives both the request and the
    // (disabled) selector display.
    const setSelectedToolsNoop = useCallback(() => undefined, []);

    // Canvas ↔ chat wiring, mirroring Chat.tsx: request state,
    // stream events and run lifecycle route into the editor; canvas open auto-enables
    // the grouped canvas tools ("Canvas" badge, toggleable like other tools).
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

    // "Copy into Canvas" from the legacy fenced fallback reaches the editor through
    // the canvasStream bridge (fragments have no access to the page).
    useEffect(() => {
        setCopyIntoCanvasHandler(markdown => {
            canvasRef.current.setMarkdown(markdown);
            canvasRef.current.setIsOpen(true);
        });
        return () => setCopyIntoCanvasHandler(undefined);
    }, []);

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
    const resetActiveChatState = useCallback(() => {
        setLastQuestionValue("");
        setError(undefined);
        activeChatRef.current = undefined;
        dispatch({ type: "SET_ACTIVE_CHAT", payload: undefined });
        dispatch({ type: "CLEAR_ANSWERS" });
    }, [setLastQuestionValue]);

    // useEffect to load the assistant config and chat history
    const loadDataRunIdRef = useRef(0);
    useEffect(() => {
        // Claim synchronously so the dedicated new-chat effect below skips this token
        // when the assistant also changes at the same time.
        const tokenToClaim = getNewChatToken();
        if (tokenToClaim !== null) handledNewChatTokenRef.current = tokenToClaim;

        /** Loads or initializes the chat and assistant data for the current route. */
        const loadData = async () => {
            if (assistant_id) {
                const runId = ++loadDataRunIdRef.current;
                const isStale = () => loadDataRunIdRef.current !== runId;
                setIsUnsubscribed(false);
                setIsAssistantMissing(false);
                setIsAccessRevoked(false);
                setIsOwnershipResolved(!(strategy instanceof CommunityAssistantStrategy));
                if (error) setError(undefined);
                setIsLoadingValue(true);
                setIsAssistantContentLoading(true);
                let notSubscribed = false;
                if (strategy instanceof CommunityAssistantStrategy) {
                    const owned = await getOwnedCommunityAssistants();
                    if (isStale()) return;
                    const userIsOwner = owned.some(assistant => assistant.id === assistant_id);

                    if (userIsOwner) {
                        window.location.href = `/#/owned/communityassistant/${assistant_id}${location.search}`;
                        return;
                    } else {
                        const subscriptions = await getUserSubscriptionsApi();
                        if (isStale()) return;
                        const isSubscribed = subscriptions && subscriptions.length > 0 && subscriptions.some(sub => sub.id === assistant_id);
                        if (!isSubscribed) {
                            notSubscribed = true;
                        }
                    }
                }

                setIsOwnershipResolved(true);
                let accessDenied = false;
                let configMissing = false;
                // A first-time visitor without chat history gets the subscribe dialog; the
                // read-only callout stays for users with retained chats from a lapsed subscription.
                let hasLocalChats = true;

                strategy
                    .loadAssistantConfig(assistant_id, assistantStorageService)
                    .then(async assistant => {
                        if (isStale()) return;
                        if (assistant) {
                            if (notSubscribed) {
                                try {
                                    const newestChat = await assistantStorageService.getNewestChatForAssistant(assistant_id);
                                    if (isStale()) return;
                                    hasLocalChats = Boolean(newestChat?.id);
                                } catch (chatError) {
                                    console.error("Error checking for retained chats of the assistant:", chatError);
                                    hasLocalChats = true;
                                }
                            }

                            if (strategy instanceof CommunityAssistantStrategy && !notSubscribed) {
                                try {
                                    await upsertCommunityAssistantSnapshot(
                                        communityAssistantStorageService,
                                        mapAssistantToCommunitySnapshot({ ...assistant, id: assistant_id })
                                    );
                                    if (isStale()) return;
                                } catch (snapshotError) {
                                    console.error("Error updating community assistant snapshot:", snapshotError);
                                }
                            }

                            setAssistantConfig(assistant);
                            dispatch({ type: "SET_SYSTEM_PROMPT", payload: assistant.system_message });
                            dispatch({ type: "SET_CREATIVITY", payload: assistant.creativity });
                            setFollowUpActions(assistant.quick_prompts || []);

                            // If assistant has a default model, check if it's available
                            if (assistant.default_model) {
                                const defaultModelConfig = availableLLMs.find(m => m.id === assistant.default_model);
                                if (defaultModelConfig) {
                                    setLLM(defaultModelConfig);
                                } else {
                                    // Model is not available anymore - show error and let user choose
                                    showError(
                                        t("components.assistant_chat.default_model_unavailable"),
                                        t("components.assistant_chat.default_model_unavailable_message", { modelName: assistant.default_model })
                                    );
                                }
                            }

                            const newChatToken = getNewChatToken();
                            if (newChatToken !== null) {
                                resetActiveChatState();
                                clearNewChatRequest();
                                return fetchHistory();
                            }

                            return fetchHistory().catch(err => {
                                console.error("Error loading chat history:", err);
                                showError(t("components.assistant_chat.load_chat_failed"), t("components.assistant_chat.load_chat_failed_message"));
                            });
                        } else {
                            // The assistant is gone (deleted without a local snapshot) — keep the
                            // chat history reachable in a read-only view instead of stranding it.
                            setIsAssistantMissing(true);
                            configMissing = true;
                            setFollowUpActions([]);
                            return fetchHistory().catch(err => {
                                console.error("Error loading chat history:", err);
                                showError(t("components.assistant_chat.load_chat_failed"), t("components.assistant_chat.load_chat_failed_message"));
                            });
                        }
                    })
                    .catch(async err => {
                        if (isStale()) return;
                        if (err instanceof ApiError && err.status === 403) {
                            // Access to a still-existing assistant was revoked. The locally stored
                            // snapshot keeps the chat reachable in a read-only view; without a
                            // snapshot the previous behavior applies.
                            try {
                                const snapshot = await communityAssistantStorageService.getAssistantConfig(assistant_id);
                                if (isStale()) return;
                                if (isCompleteCommunityAssistantSnapshot(snapshot)) {
                                    const assistant = mapCommunitySnapshotToAssistant(snapshot);
                                    setIsAccessRevoked(true);
                                    configMissing = true;
                                    setAssistantConfig(assistant);
                                    dispatch({ type: "SET_SYSTEM_PROMPT", payload: assistant.system_message });
                                    dispatch({ type: "SET_CREATIVITY", payload: assistant.creativity });
                                    setFollowUpActions([]);
                                    return fetchHistory().catch(fetchError => {
                                        console.error("Error loading chat history:", fetchError);
                                        showError(t("components.assistant_chat.load_chat_failed"), t("components.assistant_chat.load_chat_failed_message"));
                                    });
                                }
                            } catch (snapshotError) {
                                console.error("Error loading local snapshot of an inaccessible assistant:", snapshotError);
                            }

                            if (notSubscribed) {
                                setNoAccess(true);
                                accessDenied = true;
                            } else {
                                console.error("Error loading assistant configuration:", err);
                                showError(
                                    t("components.assistant_chat.load_assistant_failed"),
                                    err instanceof Error ? err.message : t("components.assistant_chat.load_assistant_failed_message")
                                );
                                // wait a moment before redirecting to home
                                setTimeout(() => {
                                    if (isStale()) return;
                                    window.location.href = "/";
                                }, 2000);
                            }
                        } else {
                            console.error("Error loading assistant configuration:", err);
                            showError(
                                t("components.assistant_chat.load_assistant_failed"),
                                err instanceof Error ? err.message : t("components.assistant_chat.load_assistant_failed_message")
                            );
                            // wait a moment before redirecting to home
                            setTimeout(() => {
                                if (isStale()) return;
                                window.location.href = "/";
                            }, 2000);
                        }
                    })
                    .finally(() => {
                        if (isStale()) return;
                        setShowNotSubscribedDialog(notSubscribed && (accessDenied || !hasLocalChats));
                        setIsUnsubscribed(notSubscribed && !accessDenied && !configMissing && hasLocalChats);
                        setIsLoadingValue(false);
                        setIsAssistantContentLoading(false);
                    });
            }
        };
        loadData();
    }, [
        assistant_id,
        communityAssistantStorageService,
        isDeletedAssistant,
        showError,
        strategy,
        t,
        availableLLMs,
        setLLM,
        setFollowUpActions,
        setIsLoadingValue,
        setLastQuestionValue,
        getNewChatToken,
        clearNewChatRequest,
        resetActiveChatState,
        assistantChatStorage
    ]);

    // Load info data for the assistant details sidebar (shown to owners and non-owners alike)
    useEffect(() => {
        setAssistantInfoData(null);
        setIsInfoDrawerOpen(false);

        if (isDeletedAssistant || isLegacyAssistant || isLocalAssistant || !assistant_id || !isOwnershipResolved) {
            setIsAssistantInfoLoading(false);
            return;
        }

        setIsAssistantInfoLoading(true);

        const requestId = ++assistantInfoRequestIdRef.current;
        let isCurrentRequest = true;

        getCommunityAssistantApi(assistant_id)
            .then(response => {
                if (!isCurrentRequest || requestId !== assistantInfoRequestIdRef.current) {
                    return;
                }

                setAssistantInfoData({
                    id: response.id,
                    title: response.latest_version.name,
                    description: response.latest_version.description || "",
                    subscriptions: response.subscriptions_count || 0,
                    updated: response.updated_at,
                    tags: response.latest_version.tags || [],
                    rawData: response,
                    isSubscribedAssistant: strategy instanceof CommunityAssistantStrategy
                });
                setIsAssistantInfoLoading(false);
            })
            .catch(err => {
                if (!isCurrentRequest || requestId !== assistantInfoRequestIdRef.current) {
                    return;
                }
                setAssistantInfoData(null);
                setIsAssistantInfoLoading(false);
                setIsInfoDrawerOpen(false);
                console.error("Failed to load assistant info data:", err);
            });

        return () => {
            isCurrentRequest = false;
        };
    }, [assistant_id, isDeletedAssistant, isLegacyAssistant, isLocalAssistant, isOwnershipResolved, strategy]);

    // get History-Funktion
    const fetchHistory = useCallback(() => {
        return assistantStorageService.getAllChatForAssistant(assistant_id).then(chats => {
            if (chats) dispatch({ type: "SET_ALL_CHATS", payload: chats });
            refreshUnifiedHistory();
        });
    }, [assistantStorageService, assistant_id, refreshUnifiedHistory]);

    // callApi-Funktion
    const callApi = useCallback(
        /** Sends one question through the strategy (streaming) and dispatches the answers. */
        async (question: string, systemOverride?: string, dataSources?: DataSource[]) => {
            if (isLegacyAssistant || isAssistantUnavailable || historyReadOnly) {
                console.warn("Interaction blocked: Assistant is read-only.");
                return;
            }

            setLastQuestionValue(question);
            if (error) setError(undefined);
            setIsLoadingValue(true);
            setIsStreaming(true);

            const askResponse: AskResponse = {} as AskResponse;
            const options: ChatOptions = {
                system: systemOverride ?? systemPrompt ?? "",
                creativity: creativity
            };
            try {
                await makeApiRequest(
                    answers,
                    question,
                    dispatch,
                    LLM,
                    activeChatRef,
                    assistantChatStorage,
                    options,
                    askResponse,
                    chatMessageStreamEnd,
                    isLoadingRef,
                    fetchHistory,
                    assistant_id,
                    lockedToolIds,
                    setToolStatuses,
                    dataSources,
                    lastAnswerRef,
                    setIsLoadingValue,
                    requestPersist,
                    undefined, // onAgUiEvent — event log is only wired up in the main chat
                    setRunActivity,
                    canvasWiring
                );
            } catch (e) {
                setError(e);
            } finally {
                setIsLoadingValue(false);
                setIsStreaming(false);
            }
        },
        [
            error,
            answers,
            LLM,
            assistantChatStorage,
            fetchHistory,
            systemPrompt,
            creativity,
            lockedToolIds,
            setIsLoadingValue,
            setLastQuestionValue,
            isLegacyAssistant,
            isAssistantUnavailable,
            historyReadOnly,
            canvasWiring
        ]
    );

    useEffect(() => {
        scrollIntoNearestContainer(chatMessageStreamEnd.current);
    }, [answers.length]);
    // Add a scroll function
    const scrollToBottom = useCallback(() => {
        if (chatMessageStreamEnd.current) {
            scrollIntoNearestContainer(chatMessageStreamEnd.current);
        }
    }, []);

    const loadAssistantChat = useCallback(
        /** Restores a previously generated assistant chat by its storage id. */
        async (id: string) => {
            if (!id.startsWith(AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id))) {
                return false;
            }

            const prefix = AssistantStorageService.GENERATE_BOT_CHAT_PREFIX(assistant_id);
            const chat = await loadConversation(assistantChatStorage, id, id.slice(prefix.length), assistantConfig);
            if (!chat) {
                return false;
            }

            setError(undefined);
            dispatch({ type: "SET_ANSWERS", payload: chat.messages });
            setLastQuestionValue(chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "");
            dispatch({ type: "SET_ACTIVE_CHAT", payload: id });

            setTimeout(() => {
                scrollToBottom();
            }, 100);

            return true;
        },
        [assistantChatStorage, assistant_id, assistantConfig, scrollToBottom, setLastQuestionValue]
    );

    useEffect(() => {
        const requestedChatId = getRequestedChatId();
        if (!requestedChatId || requestedChatId === activeChatRef.current) {
            return;
        }

        void loadAssistantChat(requestedChatId)
            .then(loaded => {
                if (!loaded) {
                    clearRequestedChatId();
                }
            })
            .catch(err => {
                setError(err);
                clearRequestedChatId();
                showError(t("components.assistant_chat.load_chat_failed"), t("components.assistant_chat.load_chat_failed_message"));
            });
    }, [clearRequestedChatId, getRequestedChatId, loadAssistantChat, location.search]);

    useEffect(() => {
        const newChatToken = getNewChatToken();
        if (!newChatToken || newChatToken === handledNewChatTokenRef.current) return;
        handledNewChatTokenRef.current = newChatToken;
        resetActiveChatState();
        clearNewChatRequest();
        void fetchHistory();
    }, [location.search, getNewChatToken, resetActiveChatState, clearNewChatRequest, fetchHistory]);

    // onAssistantChanged-Funktion
    const onAssistantChanged = useCallback(
        /** Persists assistant edits and refreshes the strategy-driven view. */
        async (newAssistant: Assistant) => {
            if (!canEdit) return;

            setError(undefined);
            return await strategy.updateAssistant?.(assistant_id, newAssistant);
        },
        [canEdit, strategy, assistant_id]
    );

    // Export function for the info sidebar
    const exportAssistant = useCallback(async () => {
        try {
            downloadAssistantExport(mapAssistantToExportData(assistantConfig), assistantConfig.title);
            showSuccess(t("components.assistantsettingsdrawer.export"), `${assistantConfig.title}.json`);
        } catch (err) {
            console.error("Failed to export assistant:", err);
            showError(t("components.assistantsettingsdrawer.export"), err instanceof Error ? err.message : "Export failed");
        }
    }, [assistantConfig, showError, showSuccess, t]);

    // Delete function for the info sidebar (owner only)
    const performDeleteAssistant = useCallback(
        async (keepChats: boolean = true) => {
            try {
                await strategy.deleteAssistant(assistant_id, assistantStorageService, keepChats);
                showSuccess(
                    t("components.assistant_chat.delete_assistant_success"),
                    t("components.assistant_chat.delete_assistant_success_message", { title: assistantConfig.title })
                );
                refreshUnifiedHistory();
                navigate("/discovery");
            } catch (err) {
                showError(
                    t("components.assistant_chat.delete_assistant_failed"),
                    err instanceof Error ? err.message : t("components.assistant_chat.delete_assistant_failed_message")
                );
            }
        },
        [strategy, assistant_id, assistantStorageService, assistantConfig.title, refreshUnifiedHistory, navigate, showSuccess, showError, t]
    );

    // Unsubscribe function for the info sidebar (subscribed, non-owned community assistants only)
    const performUnsubscribeAssistant = useCallback(async () => {
        try {
            await unsubscribeFromAssistantApi(assistant_id);
        } catch (err) {
            console.error("Failed to unsubscribe from assistant:", err);
            showError(t("components.community_assistants.unsubscribe_failed_title"), t("components.community_assistants.unsubscribe_failed_message"));
            return;
        }

        showSuccess(
            t("components.community_assistants.unsubscribe_success_title"),
            t("components.community_assistants.unsubscribe_success_message", { title: assistantConfig.title })
        );

        refreshUnifiedHistory();
        navigate("/discovery");
    }, [assistant_id, assistantConfig.title, refreshUnifiedHistory, navigate, showSuccess, showError, t]);

    // Re-subscribe from the unsubscribed callout (or the no-access dialog)
    const performSubscribe = useCallback(async () => {
        try {
            try {
                await subscribeToAssistantApi(assistant_id);
            } catch (subscribeError) {
                if (subscribeError instanceof ApiError && subscribeError.status === 409) {
                    // Already subscribed (e.g. a retried click) — continue with the assistant fetch.
                } else {
                    throw subscribeError;
                }
            }
            const subscribedAssistantResponse = await getCommunityAssistantApi(assistant_id);
            const subscribedAssistant = {
                ...mapCommunitySnapshotToAssistant(mapAssistantResponseToSnapshot(subscribedAssistantResponse)),
                owner_ids: subscribedAssistantResponse.latest_version.owner_ids || []
            };
            if (subscribedAssistant.default_model) {
                const defaultModelConfig = availableLLMs.find(m => m.id === subscribedAssistant.default_model);
                if (defaultModelConfig) {
                    setLLM(defaultModelConfig);
                } else {
                    showError(
                        t("components.assistant_chat.default_model_unavailable"),
                        t("components.assistant_chat.default_model_unavailable_message", { modelName: subscribedAssistant.default_model })
                    );
                }
            }

            try {
                await upsertCommunityAssistantSnapshot(
                    communityAssistantStorageService,
                    mapAssistantToCommunitySnapshot({ ...subscribedAssistant, id: assistant_id })
                );
            } catch (snapshotError) {
                console.error("Error updating community assistant snapshot:", snapshotError);
            }
            setAssistantConfig(subscribedAssistant);
            dispatch({ type: "SET_SYSTEM_PROMPT", payload: subscribedAssistant.system_message });
            dispatch({ type: "SET_CREATIVITY", payload: subscribedAssistant.creativity });
            setFollowUpActions(subscribedAssistant.quick_prompts || []);
            setShowNotSubscribedDialog(false);
            setNoAccess(false);
            setIsUnsubscribed(false);
            setIsAssistantMissing(false);
            showSuccess(
                t("components.not_subscribed_dialog.subscribe_success"),
                t("components.not_subscribed_dialog.subscribe_success_message", { assistantTitle: subscribedAssistant.title })
            );
        } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
                // The assistant was deleted in the meantime — fall back to the read-only
                // missing view and close a subscribe dialog that can no longer succeed.
                setShowNotSubscribedDialog(false);
                setIsUnsubscribed(false);
                setIsAssistantMissing(true);
                setFollowUpActions([]);
                fetchHistory().catch(historyError => {
                    console.error("Error loading chat history:", historyError);
                });
                return;
            }
            console.error("Failed to subscribe to assistant:", err);
            showError(
                t("components.community_assistants.subscribe_failed_title", { title: assistantConfig.title }),
                t("components.community_assistants.subscribe_failed_default")
            );
        }
    }, [
        assistant_id,
        assistantConfig.title,
        availableLLMs,
        communityAssistantStorageService,
        fetchHistory,
        setFollowUpActions,
        setLLM,
        showError,
        showSuccess,
        t
    ]);

    // Remove leftover chats and the local snapshot of an assistant whose server config is gone
    const performMissingAssistantCleanup = useCallback(async () => {
        try {
            await assistantStorageService.deleteChatsForAssistant(assistant_id);
            await communityAssistantStorageService.deleteConfigForAssistant(assistant_id);
        } catch (err) {
            showError(
                t("components.assistant_chat.delete_assistant_failed"),
                err instanceof Error ? err.message : t("components.assistant_chat.delete_assistant_failed_message")
            );
            return;
        }

        showSuccess(t("components.history.delete_chats_success_title"), t("components.history.delete_chats_success_message"));
        refreshUnifiedHistory();
        navigate("/discovery");
    }, [
        assistant_id,
        assistantConfig.title,
        assistantStorageService,
        communityAssistantStorageService,
        refreshUnifiedHistory,
        navigate,
        showSuccess,
        showError,
        t
    ]);

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (!conversationActions.canRegenerate || historyReadOnly || answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;
        try {
            setError(undefined);
            setIsLoadingValue(true);
            await handleRegenerate(answers, dispatch, activeChatRef.current, assistantChatStorage, systemPrompt, callApi, isLoadingRef, requestPersist);
        } catch (e) {
            setError(e);
            setIsLoadingValue(false);
        }
    }, [answers, assistantChatStorage, callApi, systemPrompt, historyReadOnly, setIsLoadingValue]);

    useUnifiedHistoryRegistration(
        useMemo(
            () => ({
                kind: "assistant",
                assistantId: assistant_id,
                assistantTitle: assistantConfig.title,
                activeChatId: active_chat,
                resetActiveChat: (chatId: string) => {
                    if (chatId === activeChatRef.current) {
                        resetActiveChatState();
                    }
                }
            }),
            [active_chat, assistant_id, assistantConfig.title, resetActiveChatState]
        )
    );

    // ClearChat-Funktion
    const clearChat = useCallback(() => {
        resetActiveChatState();
    }, [resetActiveChatState]);

    // Rollback-Funktion
    const onRollbackMessage = useCallback(
        /** Rolls the conversation back to before the message at index. */
        async (index: number) => {
            if (!activeChatRef.current || isLoading) return;
            const activeChat = activeChatRef.current;
            setIsLoadingValue(true);
            try {
                setError(undefined);
                await handleRollback(
                    index,
                    activeChat,
                    dispatch,
                    assistantChatStorage,
                    lastQuestionRef,
                    setQuestion,
                    clearChat,
                    fetchHistory,
                    setLastQuestionValue
                );
                // Chat was fully deleted — clear stale ?chatId= to prevent infinite skeleton.
                if (activeChatRef.current === undefined) clearRequestedChatId();
            } catch (e) {
                setError(e);
            } finally {
                setIsLoadingValue(false);
            }
        },
        [assistantChatStorage, clearChat, clearRequestedChatId, fetchHistory, isLoading, setIsLoadingValue, setLastQuestionValue]
    );

    const onStarterPromptClicked = useCallback(
        (starterPrompt: string, system?: string) => {
            callApi(starterPrompt, system);
        },
        [callApi]
    );

    // Handler for LLM selection
    const onLLMSelectionChange = useCallback(
        (nextLLM: string) => {
            const found = availableLLMs.find(m => m.id === nextLLM);
            if (found) {
                setLLM(found);
                //don't update, if we have a default model
                if (!assistantConfig.default_model) {
                    try {
                        localStorage.setItem(STORAGE_KEYS.SETTINGS_LLM, nextLLM);
                    } catch {
                        // ignore storage errors
                    }
                }
            }
        },
        [availableLLMs, setLLM, assistantConfig.default_model]
    );

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
        navigate(`${location.pathname}?new=${Date.now()}`);
    }, [location.pathname, navigate]);

    const starterPromptsComponent = useMemo(() => {
        if (isLegacyAssistant || historyReadOnly) {
            return null;
        }

        if (assistantConfig.examples && assistantConfig.examples.length > 0) {
            return <StarterPromptList starterPrompts={assistantConfig.examples} onStarterPromptClicked={onStarterPromptClicked} />;
        } else {
            return null;
        }
    }, [isLegacyAssistant, historyReadOnly, assistantConfig.examples, onStarterPromptClicked]);

    // Text-Input component
    // Only the assistant's default model is selectable; if it no longer exists, the user picks from all models.
    const isLLMLocked = Boolean(assistantConfig.default_model && availableLLMs.some(m => m.id === assistantConfig.default_model));

    const inputComponent = useMemo(() => {
        // A numeric-id assistant whose local configuration is gone (deleted, or opened
        // via a community route) shows the missing view — the legacy callout must not
        // shadow it, or cleanup would run against the wrong strategy.
        if (isAssistantMissing) {
            return (
                <div className={styles.stateCallout}>
                    <AssistantStateCallout state="missing" context="chat" onDelete={() => setShowDeleteConfirm(true)} />
                </div>
            );
        }

        if (isLegacyAssistant) {
            return (
                <div className={styles.stateCallout}>
                    <AssistantStateCallout state="legacy" context="chat" onDelete={() => setShowDeleteConfirm(true)} />
                </div>
            );
        }

        if (isDeletedAssistant) {
            return (
                <div className={styles.stateCallout}>
                    <AssistantStateCallout state="deleted" context="chat" onDelete={() => setShowDeleteConfirm(true)} />
                </div>
            );
        }

        if (isAccessRevoked) {
            return (
                <div className={styles.stateCallout}>
                    <AssistantStateCallout state="revoked_access" context="chat" onDelete={() => setShowDeleteConfirm(true)} />
                </div>
            );
        }

        if (isAssistantUnavailable) {
            return (
                <div className={styles.stateCallout}>
                    <AssistantStateCallout
                        state={assistantConfig.state === "pending_legal_review" ? "pending_legal_review" : "inactive"}
                        context="chat"
                        onEdit={canEdit ? () => navigate("edit") : undefined}
                    />
                </div>
            );
        }

        if (isLocalAssistant) {
            return (
                <>
                    <div className={styles.stateCallout}>
                        <AssistantStateCallout
                            state="local"
                            context="chat"
                            onMigrateLocal={() => setShowLocalMigrateConfirm(true)}
                            onDelete={() => setShowDeleteConfirm(true)}
                        />
                    </div>
                    <QuestionInput
                        clearOnSend
                        disabled={isLoading || isStreaming}
                        draftCacheKey={draftCacheKey}
                        onSend={(question, datas) => {
                            const dataSources = datas
                                .filter(data => data.isActive !== false && data.status === "ready" && data.fileContent)
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
                            callApi(question, undefined, dataSources.length > 0 ? dataSources : undefined);
                        }}
                        question={question}
                        setQuestion={question => setQuestion(question)}
                        selectedTools={lockedToolIds}
                        setSelectedTools={setSelectedToolsNoop}
                        tools={tools}
                        allowToolSelection={false}
                        lockedToolIds={lockedToolIds}
                        uploadedData={uploadedData}
                        setUploadedData={setUploadedData}
                        usage={usageSummary}
                        onStartNewChat={startNewChatFromUsage}
                        usageConversationKey={`assistant:${assistant_id}:${active_chat ?? "new"}`}
                        hideDisclaimer
                        llmOptions={availableLLMs}
                        selectedLLM={LLM.id}
                        onLLMSelectionChange={onLLMSelectionChange}
                        llmLockedByAssistant={isLLMLocked}
                    />
                </>
            );
        }

        return (
            <>
                {isUnsubscribed && (
                    <div className={styles.stateCallout}>
                        <AssistantStateCallout state="unsubscribed" context="chat" onSubscribe={() => void performSubscribe()} />
                    </div>
                )}
                <QuestionInput
                    clearOnSend
                    disabled={isLoading || isStreaming || isAssistantUnavailable || isUnsubscribed || strategy instanceof DeletedCommunityAssistantStrategy}
                    draftCacheKey={draftCacheKey}
                    onSend={(question, datas) => {
                        const dataSources = datas
                            .filter(data => data.isActive !== false && data.status === "ready" && data.fileContent)
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
                        callApi(question, undefined, dataSources.length > 0 ? dataSources : undefined);
                    }}
                    question={question}
                    setQuestion={question => setQuestion(question)}
                    selectedTools={lockedToolIds}
                    setSelectedTools={setSelectedToolsNoop}
                    tools={tools}
                    allowToolSelection={false}
                    lockedToolIds={lockedToolIds}
                    uploadedData={uploadedData}
                    setUploadedData={setUploadedData}
                    usage={usageSummary}
                    onStartNewChat={startNewChatFromUsage}
                    usageConversationKey={`assistant:${assistant_id}:${active_chat ?? "new"}`}
                    hideDisclaimer
                    llmOptions={availableLLMs}
                    selectedLLM={LLM.id}
                    onLLMSelectionChange={onLLMSelectionChange}
                    llmLockedByAssistant={isLLMLocked}
                />
            </>
        );
    }, [
        isLegacyAssistant,
        isDeletedAssistant,
        isAccessRevoked,
        isLocalAssistant,
        isAssistantUnavailable,
        isUnsubscribed,
        isAssistantMissing,
        canEdit,
        navigate,
        setShowLocalMigrateConfirm,
        requestDuplicateAssistant,
        performSubscribe,
        assistant_id,
        assistantConfig,
        isLoading,
        isStreaming,
        callApi,
        question,
        tools,
        lockedToolIds,
        setSelectedToolsNoop,
        draftCacheKey,
        uploadedData,
        usageSummary,
        active_chat,
        startNewChatFromUsage,
        availableLLMs,
        isLLMLocked,
        LLM.id,
        onLLMSelectionChange,
        performDeleteAssistant
    ]);

    // AnswerList component
    const answerList = useMemo(
        () => (
            <AnswerList
                answers={answers}
                regularAssistantMsg={(answer, index) => {
                    return (
                        <>
                            {" "}
                            {index === answers.length - 1 && (
                                <Answer
                                    key={index}
                                    answer={answer.response}
                                    isLatest
                                    isStreaming={isStreaming}
                                    onRegenerateResponseClicked={
                                        conversationActions.canRegenerate && !historyReadOnly ? onRegenerateResponseClicked : undefined
                                    }
                                    regenerationUnavailableReason={
                                        !conversationActions.canRegenerate && !historyReadOnly
                                            ? t("components.answer.persisted_actions_unavailable")
                                            : undefined
                                    }
                                    onFollowUpActionSend={
                                        historyReadOnly
                                            ? undefined
                                            : prompt => {
                                                  setLastQuestionValue(prompt);
                                                  setIsLoadingValue(true);
                                                  void callApi(prompt);
                                              }
                                    }
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer.response} />}
                        </>
                    );
                }}
                onRollbackMessage={historyReadOnly ? undefined : onRollbackMessage}
                isLoading={isLoading}
                loadingActivity={runActivity}
                error={error}
                makeApiRequest={() => {
                    if (!conversationActions.canRetry || historyReadOnly || isLoadingRef.current) return;
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                    callApi(lastQuestion);
                }}
                canRetry={conversationActions.canRetry && !historyReadOnly}
                retryUnavailableReason={!conversationActions.canRetry && !historyReadOnly ? t("components.answer.persisted_actions_unavailable") : undefined}
                chatMessageStreamEnd={chatMessageStreamEnd}
                lastQuestionRef={lastQuestionRef}
                onRollbackError={() => {
                    setQuestion(lastQuestion);
                    setError(undefined);
                    setLastQuestionValue(answers.length > 1 ? answers[answers.length - 1].user : "");
                    dispatch({ type: "SET_ANSWERS", payload: answers.slice(0, -1) });
                }}
                lastAnswerRef={lastAnswerRef}
            />
        ),
        [
            answers,
            historyReadOnly,
            onRegenerateResponseClicked,
            onRollbackMessage,
            isLoading,
            runActivity,
            isStreaming,
            error,
            callApi,
            chatMessageStreamEnd,
            lastQuestion,
            lastAnswerRef,
            setLastQuestionValue,
            t
        ]
    );

    const layout = useMemo(() => {
        const canChat = !historyReadOnly && !isLegacyAssistant && !isAssistantUnavailable;

        return (
            <>
                <CanvasSplitView
                    controller={canvas}
                    conversationId={active_chat}
                    serverConversationId={canvasServerConversationId}
                    readOnly={historyReadOnly}
                    onInsertIntoChat={insertCanvasSelectionIntoChat}
                    onAgentRevise={insertCanvasReviseRequest}
                >
                    <ChatLayout
                        starterPrompts={starterPromptsComponent}
                        answers={answerList}
                        input={inputComponent}
                        showStarterPrompts={!lastQuestion}
                        header={isAssistantMissing ? t("components.assistant_chat.assistant_not_found") : assistantConfig.title}
                        welcomeMessage={canChat ? t("chat.header") : undefined}
                        showDisclaimer={canChat || Boolean(lastQuestion)}
                        header_as_markdown={false}
                        messages_description={t("common.messages")}
                        actions={
                            <>
                                {canEdit && !isLegacyAssistant && (
                                    <Button
                                        appearance="subtle"
                                        icon={<Settings24Regular />}
                                        onClick={() => navigate("edit")}
                                        aria-label={t("components.assistantsettingsdrawer.show_configurations")}
                                    />
                                )}
                                {(assistantInfoData || isAssistantInfoLoading) && (
                                    <Button
                                        appearance="subtle"
                                        icon={<Info24Regular />}
                                        onClick={() => setIsInfoDrawerOpen(prev => !prev)}
                                        aria-label={t("components.community_assistants.about", "About")}
                                    />
                                )}
                            </>
                        }
                        onHeaderClick={assistantInfoData || isAssistantInfoLoading ? () => setIsInfoDrawerOpen(prev => !prev) : undefined}
                        infoDrawerOpen={isInfoDrawerOpen}
                    />
                </CanvasSplitView>
            </>
        );
    }, [
        starterPromptsComponent,
        answerList,
        inputComponent,
        historyReadOnly,
        isAssistantMissing,
        lastQuestion,
        isLegacyAssistant,
        isAssistantUnavailable,
        t,
        canEdit,
        assistantConfig.title,
        assistantInfoData,
        isAssistantInfoLoading,
        isInfoDrawerOpen,
        canvas,
        active_chat,
        insertCanvasSelectionIntoChat,
        insertCanvasReviseRequest
    ]);

    const isRequestedChatLoading = Boolean(requestedChatId && requestedChatId !== active_chat);
    const showAssistantLoadingState = !isEditMode && (isAssistantContentLoading || isRequestedChatLoading);

    if (isEditMode && (!canEdit || isLegacyAssistant)) {
        return null;
    }

    if (showAssistantLoadingState) {
        return (
            <Skeleton aria-label={t("components.history.loading")} className={styles.loadingShell}>
                <div className={styles.loadingHeader}>
                    <SkeletonItem style={{ width: "min(280px, 48vw)", height: 24 }} />
                    <SkeletonItem style={{ width: 160, height: 36 }} />
                </div>
                <div className={styles.loadingContent}>
                    <SkeletonItem style={{ width: "100%", height: 18 }} />
                    <SkeletonItem style={{ width: "82%", height: 18 }} />
                    <SkeletonItem style={{ width: "58%", height: 18 }} />
                </div>
                <SkeletonItem style={{ height: 72, margin: "0 24px 20px" }} />
            </Skeleton>
        );
    }

    return isEditMode ? (
        <AssistantEditorPage
            // A draft is tied to one assistant ID. Remount when the asynchronously loaded assistant changes,
            // so its draft is read on initialization instead of persisting the previous editor state under its key.
            key={assistantConfig.id}
            mode="edit"
            assistant={assistantConfig}
            isOwner={canEdit || strategy.isOwned}
            strategy={strategy}
            onSave={async assistant => {
                return await onAssistantChanged(assistant);
            }}
        />
    ) : (
        <>
            {layout}
            <NotSubscribedDialog
                open={showNotSubscribedDialog}
                onOpenChange={setShowNotSubscribedDialog}
                hasAccess={!noAccess}
                assistantTitle={assistantConfig.title}
                onSubscribe={performSubscribe}
            />
            <CloseConfirmationDialog
                open={showLocalMigrateConfirm}
                onOpenChange={setShowLocalMigrateConfirm}
                onConfirmClose={() => performMigration(assistantConfig, assistant_id, assistantConfig.title)}
                title={t("components.community_assistants.local_migration_confirm_title")}
                message={t("components.community_assistants.local_migration_confirm_message")}
                confirmLabel={t("components.community_assistants.local_migration_confirm_action")}
            />
            <CloseConfirmationDialog
                open={showDuplicateConfirm}
                onOpenChange={setShowDuplicateConfirm}
                onConfirmClose={confirmDuplicateAssistant}
                confirmDisabled={isDuplicating}
                title={t("components.community_assistants.duplicate_confirm_title")}
                message={t(
                    assistantToDuplicate?.isDeletedSnapshot
                        ? "components.community_assistants.duplicate_confirm_message_deleted"
                        : "components.community_assistants.duplicate_confirm_message",
                    { title: assistantToDuplicate?.title ?? "" }
                )}
                confirmLabel={t("components.community_assistants.duplicate_confirm_action")}
            />
            <CloseConfirmationDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirmClose={isAssistantMissing || isAccessRevoked ? performMissingAssistantCleanup : () => void performDeleteAssistant(true)}
                title={t(
                    isAssistantMissing || isDeletedAssistant || isAccessRevoked
                        ? "components.community_assistants.leftover_chats_cleanup_confirm_title"
                        : "components.assistantsettingsdrawer.deleteDialog.title"
                )}
                message={t(
                    isAssistantMissing || isDeletedAssistant || isAccessRevoked
                        ? "components.community_assistants.leftover_chats_cleanup_confirm_message"
                        : "components.community_assistants.assistant_delete_chats_choice_message"
                )}
                confirmLabel={t(
                    isAssistantMissing || isDeletedAssistant || isAccessRevoked
                        ? "components.assistantsettingsdrawer.deleteDialog.confirm"
                        : "components.community_assistants.keep_chats_action"
                )}
                confirmIntent={isAssistantMissing || isDeletedAssistant || isAccessRevoked ? "danger" : "default"}
                secondaryAction={
                    isAssistantMissing || isDeletedAssistant || isAccessRevoked
                        ? undefined
                        : { label: t("components.community_assistants.delete_chats_action"), onClick: () => void performDeleteAssistant(false) }
                }
            />
            <CloseConfirmationDialog
                open={showUnsubscribeConfirm}
                onOpenChange={setShowUnsubscribeConfirm}
                onConfirmClose={performUnsubscribeAssistant}
                title={t("components.community_assistants.unsubscribe_confirm_title")}
                message={t("components.community_assistants.unsubscribe_confirm_message", { title: assistantConfig.title })}
                confirmLabel={t("components.community_assistants.unsubscribe")}
                confirmIntent="danger"
            />
            {(assistantInfoData || isAssistantInfoLoading || isInfoDrawerOpen) && (
                <div className={styles.infoDrawerContainer} data-open={isInfoDrawerOpen}>
                    <AssistantDetailsSidebar
                        isOpen={isInfoDrawerOpen}
                        onClose={() => setIsInfoDrawerOpen(false)}
                        assistant={assistantInfoData}
                        isLoading={isAssistantInfoLoading}
                        ownedAssistantIds={strategy.isOwned && assistantInfoData ? new Set([assistantInfoData.id]) : new Set()}
                        onStartChat={() => {
                            clearRequestedChatId();
                            clearChat();
                            setIsInfoDrawerOpen(false);
                        }}
                        onEdit={canEdit ? () => navigate("edit") : undefined}
                        onDuplicate={() => {
                            if (!assistantInfoData) return;
                            requestDuplicateAssistant({
                                id: assistant_id,
                                title: assistantInfoData.title,
                                rawData: assistantInfoData.rawData as AssistantResponse
                            });
                        }}
                        onExport={exportAssistant}
                        onDelete={strategy.isOwned ? () => setShowDeleteConfirm(true) : undefined}
                        onUnsubscribe={!strategy.isOwned ? () => setShowUnsubscribeConfirm(true) : undefined}
                    />
                </div>
            )}
        </>
    );
};

export default UnifiedAssistantChat;
