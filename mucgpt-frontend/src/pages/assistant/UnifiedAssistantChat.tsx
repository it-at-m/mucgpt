import { useRef, useState, useEffect, useContext, useCallback, useReducer, useMemo } from "react";
import { AskResponse, Assistant, ChatResponse } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { ChatLayout, SidebarSizes } from "../../components/ChatLayout/ChatLayout";
import { ASSISTANT_STORE, CREATIVITY_LOW } from "../../constants";
import { AssistantStorageService } from "../../service/assistantstorage";
import { StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { ExampleList } from "../../components/Example";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";
import { ChatOptions } from "../chat/Chat";
import { STORAGE_KEYS } from "../layout/LayoutHelper";
import { HeaderContext } from "../layout/HeaderContextProvider";
import ToolStatusDisplay from "../../components/ToolStatusDisplay";
import { ToolStatus } from "../../utils/ToolStreamHandler";
import { AssistantStrategy, CommunityAssistantStrategy, DeletedCommunityAssistantStrategy } from "./AssistantStrategy";
import { chatApi } from "../../api/core-client";
import { useGlobalToastContext } from "../../components/GlobalToastHandler/GlobalToastContext";
import { getOwnedCommunityAssistants, getUserSubscriptionsApi, subscribeToAssistantApi } from "../../api/assistant-client";
import { NotSubscribedDialog } from "../../components/NotSubscribedDialog";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { ClearChatButton } from "../../components/ClearChatButton";
import { MinimizeSidebarButton } from "../../components/MinimizeSidebarButton/MinimizeSidebarButton";
import { useToolsContext } from "../../components/ToolsProvider";
import { Button } from "@fluentui/react-components";
import { Settings24Regular } from "@fluentui/react-icons";
import { EditAssistantDialog } from "../../components/AssistantDialogs/EditAssistantDialog/EditAssistantDialog";

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

    // useEffect für den Chat-Status
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // Parameter from URL
    const { id } = useParams();
    const assistant_id = id || "0";

    // Context
    const { LLM, setLLM, availableLLMs } = useContext(LLMContext);
    const { t } = useTranslation();
    const { setQuickPrompts } = useContext(QuickPromptContext);
    const { setHeader } = useContext(HeaderContext);
    const { tools } = useToolsContext();

    const [error, setError] = useState<unknown>();
    const [sidebarSize] = useState<SidebarSizes>("large");
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
    const [showNotSubscribedDialog, setShowNotSubscribedDialog] = useState<boolean>(false);
    const [noAccess, setNoAccess] = useState<boolean>(false);
    const [showEditDialog, setShowEditDialog] = useState<boolean>(false);

    // StorageServices
    const assistantStorageService: AssistantStorageService = new AssistantStorageService(ASSISTANT_STORE);
    const assistantChatStorage: StorageService<ChatResponse, Assistant> = assistantStorageService.getChatStorageService();

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

    // useEffect to load the assistant config and chat history
    useEffect(() => {
        const loadData = async () => {
            if (assistant_id) {
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

                strategy
                    .loadAssistantConfig(assistant_id, assistantStorageService)
                    .then(assistant => {
                        if (assistant) {
                            setAssistantConfig(assistant);
                            setHeader("");
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
                        if (err.response?.status === 403 && notSubscribed) {
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
    }, [assistant_id, strategy, t, showError]);

    // get History-Funktion
    const fetchHistory = useCallback(() => {
        return assistantStorageService.getAllChatForAssistant(assistant_id).then(chats => {
            if (chats) dispatch({ type: "SET_ALL_CHATS", payload: chats });
        });
    }, [assistantStorageService, assistant_id]);

    // callApi-Funktion
    const callApi = useCallback(
        async (question: string) => {
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
    const history = useMemo(
        () => (
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
                    }
                }}
            ></History>
        ),
        [allChats, active_chat, fetchHistory, assistantChatStorage, t, scrollToBottom]
    );

    // Sidebar component
    const toggleSidebar = useCallback(() => {
        setShowSidebar(!showSidebar);
        localStorage.setItem(STORAGE_KEYS.SHOW_SIDEBAR, (!showSidebar).toString());
    }, [showSidebar]);

    const sidebar_actions = useMemo(
        () => (
            <>
                <ClearChatButton
                    onClick={clearChat}
                    disabled={!lastQuestionRef.current || isLoadingRef.current || strategy instanceof DeletedCommunityAssistantStrategy}
                    showText={showSidebar}
                />
                <MinimizeSidebarButton showSidebar={showSidebar} setShowSidebar={setAndStoreShowSidebar} />
            </>
        ),
        [clearChat, lastQuestionRef.current, isLoadingRef.current, showSidebar]
    );

    const sidebar = useMemo(() => <Sidebar content={<>{history}</>} actions={sidebar_actions} />, [history, sidebar_actions]);

    // Examples component
    const examplesComponent = useMemo(() => {
        if (assistantConfig.examples && assistantConfig.examples.length > 0) {
            return <ExampleList examples={assistantConfig.examples} onExampleClicked={onExampleClicked} />;
        } else {
            return null;
        }
    }, [assistantConfig.examples, onExampleClicked]);

    // Text-Input component
    const inputComponent = useMemo(() => {
        // Filter tools to only show those configured in the assistant
        const filteredTools =
            tools && assistantConfig.tools
                ? {
                      tools: tools.tools.filter(tool => assistantConfig.tools?.some(assistantTool => assistantTool.id === tool.id))
                  }
                : tools;

        return (
            <QuestionInput
                clearOnSend
                placeholder={t("chat.prompt")}
                disabled={isLoadingRef.current || error !== undefined || strategy instanceof DeletedCommunityAssistantStrategy}
                onSend={question => callApi(question)}
                question={question}
                setQuestion={question => setQuestion(question)}
                selectedTools={selectedTools}
                setSelectedTools={setSelectedTools}
                tools={filteredTools}
                allowToolSelection={false}
            />
        );
    }, [isLoadingRef.current, callApi, question, t, error, selectedTools, tools, assistantConfig.tools, strategy]);

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
                                    onRegenerateResponseClicked={onRegenerateResponseClicked}
                                    onQuickPromptSend={prompt => callApi(prompt)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer.response} />}
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
                lastAnswerRef={lastAnswerRef}
            />
        ),
        [
            answers,
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
                <ChatLayout
                    sidebar={sidebar}
                    examples={examplesComponent}
                    answers={answerList}
                    input={inputComponent}
                    showExamples={!lastQuestionRef.current}
                    header={assistantConfig.title}
                    welcomeMessage={t("chat.header")}
                    header_as_markdown={false}
                    messages_description={t("common.messages")}
                    size={showSidebar ? sidebarSize : "none"}
                    llmOptions={modelsToShow}
                    defaultLLM={LLM.llm_name}
                    onLLMSelectionChange={onLLMSelectionChange}
                    onToggleMinimized={toggleSidebar}
                    actions={
                        strategy.isOwned && (
                            <Button
                                appearance="subtle"
                                icon={<Settings24Regular />}
                                onClick={() => {
                                    setShowEditDialog(true);
                                }}
                                aria-label={t("components.assistantsettingsdrawer.show_configurations")}
                            />
                        )
                    }
                />
                <ToolStatusDisplay activeTools={toolStatuses} />
            </>
        );
    }, [
        sidebar,
        examplesComponent,
        answerList,
        inputComponent,
        lastQuestionRef.current,
        t,
        sidebarSize,
        toolStatuses,
        availableLLMs,
        assistantConfig.default_model,
        LLM.llm_name,
        onLLMSelectionChange,
        showSidebar,
        clearChat,
        isLoadingRef.current,
        strategy
    ]);

    return (
        <>
            {layout}
            <EditAssistantDialog
                showDialog={showEditDialog}
                setShowDialog={setShowEditDialog}
                assistant={assistantConfig}
                onAssistantChanged={onAssistantChanged}
                isOwner={strategy.isOwned}
                strategy={strategy}
            />
            <NotSubscribedDialog
                open={showNotSubscribedDialog}
                onOpenChange={setShowNotSubscribedDialog}
                hasAccess={!noAccess}
                assistantTitle={assistantConfig.title}
                onSubscribe={async () => {
                    await subscribeToAssistantApi(assistant_id);
                    setShowNotSubscribedDialog(false);
                    setNoAccess(false);
                    showSuccess(
                        t("components.not_subscribed_dialog.subscribe_success"),
                        t("components.not_subscribed_dialog.subscribe_success_message", { assistantTitle: assistantConfig.title })
                    );
                }}
            />
        </>
    );
};

export default UnifiedAssistantChat;
