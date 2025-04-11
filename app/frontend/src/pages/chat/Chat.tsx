import { useRef, useState, useEffect, useContext, useCallback, useMemo, useReducer } from "react";

import { chatApi, AskResponse, countTokensAPI, ChatResponse, } from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList, ExampleModel } from "../../components/Example";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";
import { History } from "../../components/History/History";
import useDebounce from "../../hooks/debouncehook";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { CHAT_STORE } from "../../constants";
import { DBMessage, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";
import { getChatReducer, handleRegenerate, handleRollback, makeApiRequest } from "../page_helpers";

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the provided function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
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


// Konstanten außerhalb der Komponente definieren
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

// Eigener Hook für Storage-Operationen
function useStorageService(activeChatId: string | undefined) {
    // Nutze useMemo für die Instanz, damit diese nur bei Änderung von activeChatId neu erstellt wird
    return useMemo(() =>
        new StorageService<ChatResponse, ChatOptions>(CHAT_STORE),
        [activeChatId]
    );
}

const Chat = () => {
    const chatReducer = getChatReducer<ChatOptions>()
    // Contexts
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const { quickPrompts, setQuickPrompts } = useContext(QuickPromptContext);

    // Unabhängige States
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const [showSidebar, setShowSidebar] = useState<boolean>(localStorage.getItem("SHOW_SIDEBAR") === "true" || true);

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

    // Debounced system prompt
    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);

    // Token-Berechnung
    const calculateTotalTokens = useCallback(() => {
        const answerTokens = answers.reduce(
            (sum: any, msg: { response: { user_tokens: any; tokens: any; }; }) => sum + (msg.response.user_tokens || 0) + (msg.response.tokens || 0),
            0
        );
        return systemPromptTokens + answerTokens;
    }, [answers, systemPromptTokens]);

    // Debounced Storage-Update
    const debouncedStorageUpdate = useMemo(() =>
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
                dispatch({ type: 'SET_ALL_CHATS', payload: chats });
            }
            return chats;
        } catch (e) {
            console.error("Error fetching history:", e);
            setError(e);
            return [];
        }
    }, [storageService]);

    // Load chat by ID
    const loadChat = useCallback(async (id: string) => {
        try {
            const chat = await storageService.get(id);
            if (chat) {
                dispatch({ type: 'SET_ANSWERS', payload: chat.messages });
                dispatch({ type: 'SET_TEMPERATURE', payload: chat.config.temperature });
                dispatch({ type: 'SET_MAX_TOKENS', payload: chat.config.maxTokens });
                dispatch({ type: 'SET_SYSTEM_PROMPT', payload: chat.config.system });
                dispatch({ type: 'SET_ACTIVE_CHAT', payload: id });
                lastQuestionRef.current = chat.messages.length > 0 ?
                    chat.messages[chat.messages.length - 1].user : "";
                return true;
            }
            return false;
        } catch (e) {
            console.error("Error loading chat:", e);
            setError(e);
            return false;
        }
    }, [storageService, lastQuestionRef.current]);

    // Clear chat state
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        setError(undefined);
        dispatch({ type: 'SET_ACTIVE_CHAT', payload: undefined });
        dispatch({ type: 'CLEAR_ANSWERS' });
    }, [lastQuestionRef.current]);

    // API Request mit optimiertem State Management
    const callApi = useCallback(async (question: string, system?: string) => {
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
            await makeApiRequest(answers, question, dispatch, chatApi, LLM, activeChatRef, storageService, options, askResponse, chatMessageStreamEnd, isLoadingRef, fetchHistory, undefined);
        } catch (e) {
            setError(e);
        }
        isLoadingRef.current = false;
    }, [
        isLoadingRef.current,
        answers,
        language,
        temperature,
        max_output_tokens,
        activeChatRef.current,
        LLM.llm_name,
        storageService,
        fetchHistory
    ]);

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !activeChatRef.current || isLoadingRef.current) return;

        try {
            await handleRegenerate(answers, dispatch, activeChatRef.current, storageService, systemPrompt, callApi, isLoadingRef);
        } catch (e) {
            setError(e);
        };
    }, [answers, storageService, callApi, systemPrompt, activeChatRef.current, isLoadingRef.current]);

    // Rollback-Funktion
    const onRollbackMessage = useCallback((index: number) => {
        if (!activeChatRef.current || isLoadingRef.current) return;

        try {
            isLoadingRef.current = true;
            handleRollback(
                index,
                activeChatRef.current,
                dispatch,
                storageService,
                lastQuestionRef,
                setQuestion,
                clearChat,
                fetchHistory
            );
        } catch (e) {
            setError(e);
        } finally {
            isLoadingRef.current = false;
        }
    }, [storageService, clearChat, fetchHistory, setQuestion, isLoadingRef.current, activeChatRef.current]);

    // Konfigurationsänderungen mit memoisierten Callbacks
    const onTemperatureChanged = useCallback((temp: number) => {
        dispatch({ type: 'SET_TEMPERATURE', payload: temp });

        debouncedStorageUpdate({
            system: systemPrompt,
            maxTokens: max_output_tokens,
            temperature: temp
        });
    }, [systemPrompt, max_output_tokens, debouncedStorageUpdate]);

    const onMaxTokensChanged = useCallback((maxTokens: number) => {
        const finalTokens =
            maxTokens > LLM.max_output_tokens && LLM.max_output_tokens !== 0
                ? LLM.max_output_tokens
                : maxTokens;

        dispatch({ type: 'SET_MAX_TOKENS', payload: finalTokens });

        debouncedStorageUpdate({
            system: systemPrompt,
            maxTokens: finalTokens,
            temperature: temperature
        });
    }, [LLM.max_output_tokens, systemPrompt, temperature, debouncedStorageUpdate]);

    const onSystemPromptChanged = useCallback((newSystemPrompt: string) => {
        dispatch({ type: 'SET_SYSTEM_PROMPT', payload: newSystemPrompt });

        debouncedStorageUpdate({
            system: newSystemPrompt,
            maxTokens: max_output_tokens,
            temperature: temperature
        });
    }, [max_output_tokens, temperature, debouncedStorageUpdate]);

    // Initialisierung beim ersten Laden
    useEffect(() => {
        if (!isFirstRender.current) return;
        isFirstRender.current = false;

        isLoadingRef.current = true;

        storageService
            .getNewestChat()
            .then(existingData => {
                if (existingData) {
                    dispatch({ type: 'SET_ANSWERS', payload: existingData.messages });
                    dispatch({ type: 'SET_TEMPERATURE', payload: existingData.config.temperature });
                    dispatch({ type: 'SET_MAX_TOKENS', payload: existingData.config.maxTokens });
                    dispatch({ type: 'SET_SYSTEM_PROMPT', payload: existingData.config.system });
                    dispatch({ type: 'SET_ACTIVE_CHAT', payload: existingData.id });

                    lastQuestionRef.current = existingData.messages.length > 0
                        ? existingData.messages[existingData.messages.length - 1].user
                        : "";
                }
                isLoadingRef.current = false;
                return fetchHistory();
            })
            .finally(() => {
                isLoadingRef.current = false;
            });
    }, [fetchHistory, storageService]);

    // Token-Zählung für System-Prompt
    useEffect(() => {
        const countTokens = async () => {
            if (debouncedSystemPrompt) {
                try {
                    const response = await countTokensAPI({
                        text: debouncedSystemPrompt,
                        model: LLM
                    });
                    setSystemPromptTokens(response.count);
                } catch (e) {
                    console.error("Failed to count tokens:", e);
                    setSystemPromptTokens(0);
                }
            } else {
                setSystemPromptTokens(0);
            }
        };

        countTokens();
    }, [debouncedSystemPrompt, LLM]);

    // Update total tokens when answers or system prompt changes
    useEffect(() => {
        const newTotalTokens = calculateTotalTokens();
        dispatch({ type: 'SET_TOTAL_TOKENS', payload: newTotalTokens });
    }, [calculateTotalTokens]);

    // Update max tokens if LLM changes
    useEffect(() => {
        if (max_output_tokens > LLM.max_output_tokens && LLM.max_output_tokens !== 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        }
    }, [LLM.max_output_tokens, max_output_tokens, onMaxTokensChanged]);

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
    const onExampleClicked = useCallback((example: string, system?: string) => {
        if (system) onSystemPromptChanged(system);
        callApi(example, system);
    }, [callApi, onSystemPromptChanged]);
    // Memo components
    const answerList = useMemo(() => (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer, index) => {
                return (
                    <>
                        {index === answers.length - 1 && (
                            <Answer
                                key={`answer-${index}`}
                                answer={answer.response}
                                onRegenerateResponseClicked={onRegenerateResponseClicked}
                                setQuestion={question => setQuestion(question)}
                            />
                        )}
                        {index !== answers.length - 1 && (
                            <Answer
                                key={`answer-${index}`}
                                answer={answer.response}
                                setQuestion={question => setQuestion(question)}
                            />
                        )}
                    </>
                );
            }}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoadingRef.current}
            error={error}
            makeApiRequest={() => callApi(lastQuestionRef.current, systemPrompt)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    ), [answers, onRegenerateResponseClicked, onRollbackMessage, error, callApi, systemPrompt, isLoadingRef.current, lastQuestionRef, chatMessageStreamEnd]);

    const examplesComponent = useMemo(() => (
        <ExampleList examples={CHAT_EXAMPLES} onExampleClicked={onExampleClicked} />
    ), [onExampleClicked]);

    const inputComponent = useMemo(() => (
        <QuestionInput
            clearOnSend
            placeholder={t("chat.prompt")}
            disabled={isLoadingRef.current}
            onSend={question => callApi(question, systemPrompt)}
            tokens_used={totalTokens}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    ), [callApi, systemPrompt, totalTokens, question, t, isLoadingRef.current]);

    const sidebar_actions = useMemo(() => (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoadingRef.current} />
        </>
    ), [clearChat, lastQuestionRef.current, isLoadingRef.current]);

    const sidebar_content = useMemo(() => (
        <>
            <History
                allChats={allChats}
                currentActiveChatId={activeChatRef.current}
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
        </>
    ), [allChats, activeChatRef.current, fetchHistory, storageService, loadChat, t]);

    const sidebar = useMemo(() => (
        <ChatsettingsDrawer
            temperature={temperature}
            setTemperature={onTemperatureChanged}
            max_output_tokens={max_output_tokens}
            setMaxTokens={onMaxTokensChanged}
            systemPrompt={systemPrompt}
            setSystemPrompt={onSystemPromptChanged}
            actions={sidebar_actions}
            content={sidebar_content}
        />
    ), [
        temperature,
        max_output_tokens,
        systemPrompt,
        onTemperatureChanged,
        onMaxTokensChanged,
        onSystemPromptChanged,
        sidebar_actions,
        sidebar_content
    ]);

    const layout = useMemo(() => (
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
        ></ChatLayout>
    ), [sidebar, examplesComponent, answerList, inputComponent, lastQuestionRef.current, t]);

    return layout;
};

export default Chat;
