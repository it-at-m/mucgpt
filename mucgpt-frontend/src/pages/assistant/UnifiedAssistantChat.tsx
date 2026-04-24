import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";
import { AskResponse, Assistant, ChatResponse, CommunityAssistantSnapshot, DataSource } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ASSISTANT_STORE, COMMUNITY_ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { CommunityAssistantStorageService } from "../../service/communityassistantstorage";
import { StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList } from "../../components/Example";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { ChatOptions } from "../chat/Chat";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { AssistantStrategy, CommunityAssistantStrategy, DeletedCommunityAssistantStrategy, LocalAssistantStrategy } from "./AssistantStrategy";
import { chatApi } from "../../api/core-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { getOwnedCommunityAssistants, getUserSubscriptionsApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { NotSubscribedDialog } from "../../components/NotSubscribedDialog";
import { ClearChatButton } from "../../components/ClearChatButton";
import { useToolsContext } from "../../components/ToolsProvider";
import { Button, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { Info24Regular, Settings24Regular } from "@fluentui/react-icons";
import { AssistantEditorPage } from "../../components/AssistantDialogs/AssistantEditorPage/AssistantEditorPage";
import { AssistantDetailsSidebar, AssistantCardData } from "../../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
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
import styles from "./UnifiedAssistantChat.module.css";
import { AppSidebarSlot } from "../../components/AppSidebar";

interface UnifiedAssistantChatProps {
    strategy: AssistantStrategy;
}

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
    const { answers, creativity, systemPrompt, active_chat, allChats } = chatState;

    // References
    const activeChatRef = useRef(active_chat);
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const lastAnswerRef = useRef<HTMLDivElement | null>(null);
    const isLoadingRef = useRef(false);
    const assistantInfoRequestIdRef = useRef(0);

    // useEffect für den Chat-Status
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Parameter from URL
    const { id } = useParams();
    const assistant_id = id || "0";
    const location = useLocation();
    const navigate = useNavigate();
    const isEditMode = location.pathname.endsWith("/edit");

    useEffect(() => {
        if (!isEditMode || strategy.canEdit) return;
        navigate(location.pathname.replace(/\/edit$/, ""), { replace: true });
    }, [isEditMode, strategy.canEdit, navigate, location.pathname]);

    // Context
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { tools } = useToolsContext();

    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [selectedTools, setSelectedTools] = useState<string[]>([]);
    const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
    const [showNotSubscribedDialog, setShowNotSubscribedDialog] = useState<boolean>(false);
    const [noAccess, setNoAccess] = useState<boolean>(false);
    const [uploadedData, setUploadedData] = useState<UploadedData[]>([]);
    const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState<boolean>(false);
    const [assistantInfoData, setAssistantInfoData] = useState<AssistantCardData | null>(null);
    const [isAssistantInfoLoading, setIsAssistantInfoLoading] = useState<boolean>(false);
    const [isOwnershipResolved, setIsOwnershipResolved] = useState<boolean>(!(strategy instanceof CommunityAssistantStrategy));
    const [deletedAssistantSnapshot, setDeletedAssistantSnapshot] = useState<CommunityAssistantSnapshot | null>(null);
    const isDeletedAssistant = strategy instanceof DeletedCommunityAssistantStrategy;
    const isLocalAssistant = strategy instanceof LocalAssistantStrategy;
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
    const lockedToolIds = useMemo(() => assistantConfig.tools?.map(tool => tool.id) ?? [], [assistantConfig.tools]);
    const mergeLockedToolIds = useCallback((toolIds: string[]) => Array.from(new Set([...lockedToolIds, ...toolIds])), [lockedToolIds]);
    const setSelectedToolsGuarded = useCallback(
        (value: React.SetStateAction<string[]>) => {
            setSelectedTools(prev => {
                const next = typeof value === "function" ? value(prev) : value;
                const merged = mergeLockedToolIds(next);

                return merged.length === prev.length && merged.every((toolId, index) => toolId === prev[index]) ? prev : merged;
            });
        },
        [mergeLockedToolIds]
    );

    // useEffect to load the assistant config and chat history
    useEffect(() => {
        const loadData = async () => {
            if (assistant_id) {
                setDeletedAssistantSnapshot(null);
                setIsOwnershipResolved(!(strategy instanceof CommunityAssistantStrategy));
                if (error) setError(undefined);
                isLoadingRef.current = true;
                let notSubscribed = false;
                if (strategy instanceof CommunityAssistantStrategy) {
                    const owned = await getOwnedCommunityAssistants();
                    const userIsOwner = owned.some(assistant => assistant.id === assistant_id);

                    if (userIsOwner) {
                        window.location.href = `/#/owned/communityassistant/${assistant_id}`;
                        return;
                    } else {
                        const subscriptions = await getUserSubscriptionsApi();
                        const isSubscribed = subscriptions && subscriptions.length > 0 && subscriptions.some(sub => sub.id === assistant_id);
                        if (!isSubscribed) {
                            notSubscribed = true;
                        }
                    }
                }

                setIsOwnershipResolved(true);

                strategy
                    .loadAssistantConfig(assistant_id, assistantStorageService)
                    .then(async assistant => {
                        if (assistant) {
                            if (isDeletedAssistant) {
                                try {
                                    const snapshot = await communityAssistantStorageService.getAssistantConfig(assistant_id);
                                    setDeletedAssistantSnapshot(isCompleteCommunityAssistantSnapshot(snapshot) ? snapshot : null);
                                } catch (snapshotError) {
                                    console.error("Error loading deleted assistant snapshot:", snapshotError);
                                    setDeletedAssistantSnapshot(null);
                                }
                            }

                            if (strategy instanceof CommunityAssistantStrategy && !notSubscribed) {
                                try {
                                    await upsertCommunityAssistantSnapshot(
                                        communityAssistantStorageService,
                                        mapAssistantToCommunitySnapshot({ ...assistant, id: assistant_id })
                                    );
                                } catch (snapshotError) {
                                    console.error("Error updating community assistant snapshot:", snapshotError);
                                }
                            }

                            setAssistantConfig(assistant);
                            dispatch({ type: "SET_SYSTEM_PROMPT", payload: assistant.system_message });
                            dispatch({ type: "SET_CREATIVITY", payload: assistant.creativity });
                            setQuickPrompts(assistant.quick_prompts || []);
                            setSelectedTools(assistant.tools ? assistant.tools.map(tool => tool.id) : []);

                            // If assistant has a default model, check if it's available
                            if (assistant.default_model) {
                                const defaultModelConfig = availableLLMs.find(m => m.llm_name === assistant.default_model);
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

                            return assistantStorageService
                                .getNewestChatForAssistant(assistant_id)
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
                                    showError(t("components.assistant_chat.load_chat_failed"), t("components.assistant_chat.load_chat_failed_message"));
                                });
                        } else {
                            showError(t("components.assistant_chat.load_assistant_failed"), t("components.assistant_chat.assistant_not_found"));
                            // wait a moment before redirecting to home
                            setTimeout(() => {
                                window.location.href = "/";
                            }, 2000);
                        }
                    })
                    .catch(err => {
                        if (err instanceof ApiError && err.status === 403 && notSubscribed) {
                            setNoAccess(true);
                        } else {
                            console.error("Error loading assistant configuration:", err);
                            showError(
                                t("components.assistant_chat.load_assistant_failed"),
                                err instanceof Error ? err.message : t("components.assistant_chat.load_assistant_failed_message")
                            );
                            // wait a moment before redirecting to home
                            setTimeout(() => {
                                window.location.href = "/";
                            }, 2000);
                        }
                    })
                    .finally(() => {
                        setShowNotSubscribedDialog(notSubscribed);
                        isLoadingRef.current = false;
                    });
            }
        };
        loadData();
    }, [assistant_id, communityAssistantStorageService, error, isDeletedAssistant, showError, strategy, t, availableLLMs, setLLM, setQuickPrompts]);

    useEffect(() => {
        if (lockedToolIds.length === 0) {
            return;
        }

        setSelectedToolsGuarded(prev => prev);
    }, [lockedToolIds, setSelectedToolsGuarded]);

    // Load info data for non-owner community assistants
    useEffect(() => {
        setAssistantInfoData(null);
        setIsInfoDrawerOpen(false);

        if (strategy.canEdit || isDeletedAssistant || !assistant_id || !isOwnershipResolved) {
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
                    rawData: response
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
    }, [assistant_id, strategy.canEdit, isDeletedAssistant, isOwnershipResolved]);

    // get History-Funktion
    const fetchHistory = useCallback(() => {
        return assistantStorageService.getAllChatForAssistant(assistant_id).then(chats => {
            if (chats) dispatch({ type: "SET_ALL_CHATS", payload: chats });
        });
    }, [assistantStorageService, assistant_id]);

    // callApi-Funktion
    const callApi = useCallback(
        async (question: string, dataSources?: DataSource[]) => {
            lastQuestionRef.current = question;
            if (error) setError(undefined);
            isLoadingRef.current = true;

            const askResponse: AskResponse = {} as AskResponse;
            const options: ChatOptions = {
                system: systemPrompt ?? "",
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
                    assistantChatStorage,
                    options,
                    askResponse,
                    chatMessageStreamEnd,
                    isLoadingRef,
                    fetchHistory,
                    assistant_id,
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
            assistantChatStorage,
            chatMessageStreamEnd,
            fetchHistory,
            selectedTools,
            lastAnswerRef
        ]
    );

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [answers.length]);

    // Add a scroll function
    const scrollToBottom = useCallback(() => {
        if (chatMessageStreamEnd.current) {
            chatMessageStreamEnd.current.scrollIntoView({ behavior: "smooth" });
        }
    }, []);

    // onAssistantChanged-Funktion
    const onAssistantChanged = useCallback(
        async (newAssistant: Assistant) => {
            if (!strategy.canEdit) return;

            setError(undefined);
            try {
                const result = await strategy.updateAssistant?.(assistant_id, newAssistant);

                if (result?.updatedAssistant) {
                    setAssistantConfig(result.updatedAssistant);
                    setQuickPrompts(result.updatedAssistant.quick_prompts || []);
                    showSuccess(
                        t("components.assistant_chat.update_assistant_success"),
                        t("components.assistant_chat.update_assistant_success_message", { title: result.updatedAssistant.title })
                    );
                }
            } catch (err) {
                console.error("Error updating assistant:", err);
                showError(
                    t("components.assistant_chat.update_assistant_failed"),
                    err instanceof Error ? err.message : t("components.assistant_chat.update_assistant_failed_message")
                );
            }
        },
        [strategy, assistant_id, assistantConfig, LLM, setQuickPrompts, showError, showSuccess, t]
    );

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;
        try {
            setError(undefined);
            await handleRegenerate(answers, dispatch, activeChatRef.current, assistantChatStorage, systemPrompt, callApi, isLoadingRef);
        } catch (e) {
            setError(e);
        }
    }, [answers, assistantChatStorage, callApi, systemPrompt, activeChatRef.current, isLoadingRef.current]);

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
                handleRollback(index, activeChatRef.current, dispatch, assistantChatStorage, lastQuestionRef, setQuestion, clearChat, fetchHistory);
            } catch (e) {
                setError(e);
            }
            isLoadingRef.current = false;
        },
        [assistantChatStorage, clearChat, fetchHistory, setQuestion]
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

    // History component
    const sidebarContent = useMemo(
        () =>
            ({ requestClose }: { requestClose?: () => void }) => (
                <History
                    allChats={allChats}
                    currentActiveChatId={active_chat}
                    onDeleteChat={async id => {
                        await assistantChatStorage.delete(id);
                        await fetchHistory();
                    }}
                    onChatNameChange={async (id, name: string) => {
                        const newName = prompt(t("components.history.newchat"), name);
                        await assistantChatStorage.renameChat(id, newName ? newName.trim() : name);
                        await fetchHistory();
                    }}
                    onFavChange={async (id: string, fav: boolean) => {
                        await assistantChatStorage.changeFavouritesInDb(id, fav);
                        await fetchHistory();
                    }}
                    onSelect={async (id: string) => {
                        const chat = await assistantChatStorage.get(id);
                        if (chat) {
                            setError(undefined);
                            dispatch({ type: "SET_ANSWERS", payload: chat.messages });
                            lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";
                            dispatch({ type: "SET_ACTIVE_CHAT", payload: id });

                            // Scroll to bottom after a short delay to ensure DOM is updated
                            setTimeout(() => {
                                scrollToBottom();
                            }, 100);
                            requestClose?.();
                        }
                    }}
                    readOnly={isDeletedAssistant}
                    showHeader={false}
                    actions={<ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoadingRef.current || isDeletedAssistant} />}
                ></History>
            ),
        [
            allChats,
            active_chat,
            clearChat,
            fetchHistory,
            assistantChatStorage,
            t,
            scrollToBottom,
            isDeletedAssistant,
            lastQuestionRef.current,
            isLoadingRef.current
        ]
    );

    // Examples component
    const examplesComponent = useMemo(() => {
        if (isDeletedAssistant) {
            return null;
        }

        if (assistantConfig.examples && assistantConfig.examples.length > 0) {
            return <ExampleList examples={assistantConfig.examples} onExampleClicked={onExampleClicked} />;
        } else {
            return null;
        }
    }, [isDeletedAssistant, assistantConfig.examples, onExampleClicked]);

    // Text-Input component
    const inputComponent = useMemo(() => {
        if (isDeletedAssistant) {
            const duplicateCandidateSnapshot = deletedAssistantSnapshot;

            return (
                <div className={styles.deletedChatWarningWrapper}>
                    <MessageBar intent="warning" layout="multiline" className={styles.chatWarningBar}>
                        <MessageBarBody>
                            <div className={styles.deletedChatWarningContent}>
                                <div className={styles.deletedChatWarningText}>{t("components.community_assistants.deleted_chat_warning")}</div>
                                <div className={styles.deletedChatActions}>
                                    <Button
                                        appearance="primary"
                                        disabled={!duplicateCandidateSnapshot}
                                        onClick={() => {
                                            if (!duplicateCandidateSnapshot) {
                                                return;
                                            }

                                            requestDuplicateAssistant({
                                                id: assistant_id,
                                                title: duplicateCandidateSnapshot.title,
                                                rawData: duplicateCandidateSnapshot,
                                                isDeletedSnapshot: true
                                            });
                                        }}
                                    >
                                        {t("components.community_assistants.deleted_state_save_action")}
                                    </Button>
                                </div>
                            </div>
                        </MessageBarBody>
                    </MessageBar>
                </div>
            );
        }

        if (isLocalAssistant) {
            return (
                <>
                    <div className={styles.deletedChatWarningWrapper}>
                        <MessageBar intent="warning" layout="multiline" className={styles.chatWarningBar}>
                            <MessageBarBody>
                                <div className={styles.deletedChatWarningContent}>
                                    <div className={styles.deletedChatWarningText}>{t("components.community_assistants.local_chat_warning")}</div>
                                    <div className={styles.deletedChatActions}>
                                        <Button appearance="primary" onClick={() => setShowLocalMigrateConfirm(true)}>
                                            {t("components.community_assistants.local_state_publish_action")}
                                        </Button>
                                    </div>
                                </div>
                            </MessageBarBody>
                        </MessageBar>
                    </div>
                    <QuestionInput
                        clearOnSend
                        disabled={isLoadingRef.current || error !== undefined}
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
                            callApi(question, dataSources.length > 0 ? dataSources : undefined);
                        }}
                        question={question}
                        setQuestion={question => setQuestion(question)}
                        selectedTools={selectedTools}
                        setSelectedTools={setSelectedToolsGuarded}
                        tools={tools}
                        allowToolSelection={true}
                        lockedToolIds={lockedToolIds}
                        uploadedData={uploadedData}
                        setUploadedData={setUploadedData}
                    />
                </>
            );
        }

        return (
            <QuestionInput
                clearOnSend
                disabled={isLoadingRef.current || error !== undefined || strategy instanceof DeletedCommunityAssistantStrategy}
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
                    callApi(question, dataSources.length > 0 ? dataSources : undefined);
                }}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedToolsGuarded}
                tools={tools}
                allowToolSelection={true}
                lockedToolIds={lockedToolIds}
                uploadedData={uploadedData}
                setUploadedData={setUploadedData}
            />
        );
    }, [
        isDeletedAssistant,
        isLocalAssistant,
        deletedAssistantSnapshot,
        t,
        requestDuplicateAssistant,
        assistant_id,
        assistantConfig,
        isLoadingRef.current,
        callApi,
        question,
        error,
        selectedTools,
        setSelectedToolsGuarded,
        tools,
        lockedToolIds,
        uploadedData
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
                                    onRegenerateResponseClicked={isDeletedAssistant ? undefined : onRegenerateResponseClicked}
                                    onQuickPromptSend={isDeletedAssistant ? undefined : prompt => callApi(prompt)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer.response} />}
                        </>
                    );
                }}
                onRollbackMessage={isDeletedAssistant ? undefined : onRollbackMessage}
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
                lastAnswerRef={lastAnswerRef}
            />
        ),
        [
            answers,
            isDeletedAssistant,
            onRegenerateResponseClicked,
            onRollbackMessage,
            isLoadingRef.current,
            error,
            callApi,
            chatMessageStreamEnd,
            lastQuestionRef.current,
            lastAnswerRef
        ]
    );

    const layout = useMemo(() => {
        // Determine which models to show in the selector
        let modelsToShow = availableLLMs;
        if (assistantConfig.default_model) {
            const defaultModelExists = availableLLMs.some(m => m.llm_name === assistantConfig.default_model);
            if (defaultModelExists) {
                // Only show the default model if it exists
                modelsToShow = availableLLMs.filter(m => m.llm_name === assistantConfig.default_model);
            }
            // If default model doesn't exist, show all models (user needs to choose)
        }

        return (
            <>
                <AppSidebarSlot title={t("components.history.history")} content={sidebarContent} />
                <ChatLayout
                    examples={examplesComponent}
                    answers={answerList}
                    input={inputComponent}
                    showExamples={!lastQuestionRef.current}
                    header={assistantConfig.title}
                    welcomeMessage={isDeletedAssistant ? t("components.community_assistants.deleted_state_title") : t("chat.header")}
                    header_as_markdown={false}
                    messages_description={t("common.messages")}
                    llmOptions={modelsToShow}
                    defaultLLM={LLM.llm_name}
                    onLLMSelectionChange={onLLMSelectionChange}
                    actions={
                        strategy?.canEdit ? (
                            <Button
                                appearance="subtle"
                                icon={<Settings24Regular />}
                                onClick={() => navigate("edit")}
                                aria-label={t("components.assistantsettingsdrawer.show_configurations")}
                            />
                        ) : assistantInfoData || isAssistantInfoLoading ? (
                            <Button
                                appearance="subtle"
                                icon={<Info24Regular />}
                                onClick={() => setIsInfoDrawerOpen(prev => !prev)}
                                aria-label={t("components.community_assistants.about", "About")}
                            />
                        ) : undefined
                    }
                    onHeaderClick={!strategy?.canEdit && (assistantInfoData || isAssistantInfoLoading) ? () => setIsInfoDrawerOpen(prev => !prev) : undefined}
                    infoDrawerOpen={isInfoDrawerOpen}
                />
            </>
        );
    }, [
        sidebarContent,
        examplesComponent,
        answerList,
        inputComponent,
        isDeletedAssistant,
        lastQuestionRef.current,
        t,
        availableLLMs,
        assistantConfig.default_model,
        LLM.llm_name,
        onLLMSelectionChange,
        clearChat,
        isLoadingRef.current,
        strategy,
        assistantInfoData,
        isAssistantInfoLoading,
        isInfoDrawerOpen
    ]);

    if (isEditMode && !strategy.canEdit) {
        return null;
    }

    return isEditMode ? (
        <AssistantEditorPage
            mode="edit"
            assistant={assistantConfig}
            isOwner={strategy.canEdit || strategy.isOwned}
            strategy={strategy}
            onSave={async assistant => {
                await onAssistantChanged(assistant);
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
                onSubscribe={async () => {
                    await subscribeToAssistantApi(assistant_id);
                    const subscribedAssistantResponse = await getCommunityAssistantApi(assistant_id);
                    const subscribedAssistant = {
                        ...mapCommunitySnapshotToAssistant(mapAssistantResponseToSnapshot(subscribedAssistantResponse)),
                        owner_ids: subscribedAssistantResponse.latest_version.owner_ids || []
                    };

                    try {
                        await upsertCommunityAssistantSnapshot(
                            communityAssistantStorageService,
                            mapAssistantToCommunitySnapshot({ ...subscribedAssistant, id: assistant_id })
                        );
                    } catch (snapshotError) {
                        console.error("Error updating community assistant snapshot:", snapshotError);
                    }
                    setAssistantConfig(subscribedAssistant);
                    setShowNotSubscribedDialog(false);
                    setNoAccess(false);
                    showSuccess(
                        t("components.not_subscribed_dialog.subscribe_success"),
                        t("components.not_subscribed_dialog.subscribe_success_message", { assistantTitle: subscribedAssistant.title })
                    );
                }}
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
            {!strategy?.canEdit && (assistantInfoData || isAssistantInfoLoading || isInfoDrawerOpen) && (
                <div className={styles.infoDrawerContainer} data-open={isInfoDrawerOpen}>
                    <AssistantDetailsSidebar
                        isOpen={isInfoDrawerOpen}
                        onClose={() => setIsInfoDrawerOpen(false)}
                        assistant={assistantInfoData}
                        isLoading={isAssistantInfoLoading}
                        ownedAssistantIds={new Set()}
                        hideStartChat={true}
                    />
                </div>
            )}
        </>
    );
};

export default UnifiedAssistantChat;
