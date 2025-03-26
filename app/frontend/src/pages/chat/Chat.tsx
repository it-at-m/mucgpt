import { useRef, useState, useEffect, useContext, useCallback, useMemo, useReducer } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, ChatResponse, createChatName } from "../../api";
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
import { DBMessage, DBObject, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";
import { QuickPromptContext } from "../../components/QuickPrompt/QuickPromptProvider";

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

// Chat-Reducer für zusammenhängendes State-Management
type ChatState = {
    answers: ChatMessage[];
    temperature: number;
    max_output_tokens: number;
    systemPrompt: string;
    active_chat: string | undefined;
    allChats: DBObject<ChatResponse, ChatOptions>[];
    totalTokens: number;
};

type ChatAction =
    | { type: 'SET_ANSWERS'; payload: ChatMessage[] }
    | { type: 'ADD_ANSWER'; payload: ChatMessage }
    | { type: 'UPDATE_LAST_ANSWER'; payload: ChatMessage }
    | { type: 'CLEAR_ANSWERS' }
    | { type: 'SET_TEMPERATURE'; payload: number }
    | { type: 'SET_MAX_TOKENS'; payload: number }
    | { type: 'SET_SYSTEM_PROMPT'; payload: string }
    | { type: 'SET_ACTIVE_CHAT'; payload: string | undefined }
    | { type: 'SET_ALL_CHATS'; payload: DBObject<ChatResponse, ChatOptions>[] }
    | { type: 'SET_TOTAL_TOKENS'; payload: number };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
    switch (action.type) {
        case 'SET_ANSWERS':
            return { ...state, answers: action.payload };
        case 'ADD_ANSWER':
            return { ...state, answers: [...state.answers, action.payload] };
        case 'UPDATE_LAST_ANSWER':
            if (state.answers.length === 0) return state;
            const newAnswers = [...state.answers];
            newAnswers[newAnswers.length - 1] = action.payload;
            return { ...state, answers: newAnswers };
        case 'CLEAR_ANSWERS':
            return { ...state, answers: [] };
        case 'SET_TEMPERATURE':
            return { ...state, temperature: action.payload };
        case 'SET_MAX_TOKENS':
            return { ...state, max_output_tokens: action.payload };
        case 'SET_SYSTEM_PROMPT':
            return { ...state, systemPrompt: action.payload };
        case 'SET_ACTIVE_CHAT':
            return { ...state, active_chat: action.payload };
        case 'SET_ALL_CHATS':
            return { ...state, allChats: action.payload };
        case 'SET_TOTAL_TOKENS':
            return { ...state, totalTokens: action.payload };
        default:
            return state;
    }
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
        new StorageService<ChatResponse, ChatOptions>(CHAT_STORE, activeChatId),
        [activeChatId]
    );
}

const Chat = () => {
    // Contexts
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const { quickPrompts, setQuickPrompts } = useContext(QuickPromptContext);

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const isFirstRender = useRef(true);

    // Unabhängige States
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);

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

    // Storage Service mit useMemo
    const storageService = useStorageService(active_chat);

    // Debounced system prompt
    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);

    // Token-Berechnung
    const calculateTotalTokens = useCallback(() => {
        const answerTokens = answers.reduce(
            (sum, msg) => sum + (msg.response.user_tokens || 0) + (msg.response.tokens || 0),
            0
        );
        return systemPromptTokens + answerTokens;
    }, [answers, systemPromptTokens]);

    // Debounced Storage-Update
    const debouncedStorageUpdate = useMemo(() =>
        debounce((options: ChatOptions) => {
            if (active_chat) {
                storageService.update(undefined, options);
            }
        }, 500),
        [active_chat, storageService]
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
    }, [storageService]);

    // Clear chat state
    const clearChat = useCallback(() => {
        lastQuestionRef.current = "";
        setError(undefined);
        dispatch({ type: 'SET_ACTIVE_CHAT', payload: undefined });
        dispatch({ type: 'CLEAR_ANSWERS' });
    }, []);

    // API Request mit optimiertem State Management
    const makeApiRequest = useCallback(async (question: string, system?: string) => {
        if (isLoading) return; // Verhindere mehrfache Anfragen

        lastQuestionRef.current = question;
        setError(undefined);
        setIsLoading(true);

        const askResponse: ChatResponse = { answer: "", tokens: 0, user_tokens: 0 } as AskResponse;
        const options: ChatOptions = {
            system: system ?? "",
            maxTokens: max_output_tokens,
            temperature: temperature
        };

        try {
            // Erstelle History für Request
            const history: ChatTurn[] = answers.map(a => ({ user: a.user, bot: a.response.answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: true,
                language: language,
                temperature: temperature,
                system_message: system ?? "",
                max_output_tokens: max_output_tokens,
                model: LLM.llm_name
            };

            const response = await chatApi(request);
            handleRedirect(response);

            if (!response.body) {
                throw Error("No response body");
            }

            // Initialisiere Antwort-Variablen
            let user_tokens = 0;
            let answer = "";
            let streamed_tokens = 0;

            // Füge leere Antwort hinzu
            const initialMessage = {
                user: question,
                response: { ...askResponse }
            };
            setIsGenerating(true);
            dispatch({ type: 'ADD_ANSWER', payload: initialMessage });
            // Buffer für Updates, um Re-Renders zu reduzieren
            let buffer = "";
            let updateTimer: ReturnType<typeof setTimeout> | null = null;



            // Stream verarbeiten
            for await (const chunk of readNDJSONStream(response.body)) {
                if (chunk as Chunk) {
                    let shouldUpdate = false;

                    switch (chunk.type) {
                        case "C":
                            buffer += chunk.message as string;
                            shouldUpdate = true;
                            break;
                        case "I":
                            const info = chunk.message as ChunkInfo;
                            streamed_tokens = info.streamedtokens;
                            user_tokens = info.requesttokens;
                            shouldUpdate = true;
                            break;
                        case "E":
                            throw Error((chunk.message as string) || "Unknown error");
                    }

                    if (shouldUpdate) {
                        // Löschen des vorherigen Timers, wenn noch vorhanden
                        if (updateTimer) clearTimeout(updateTimer);

                        // Setzen eines neuen Timers für gebündelte Updates
                        updateTimer = setTimeout(() => {
                            const updatedResponse = {
                                ...askResponse,
                                answer: buffer,
                                tokens: streamed_tokens,
                                user_tokens: user_tokens
                            };

                            const updatedMessage = {
                                user: question,
                                response: updatedResponse
                            };

                            dispatch({ type: 'UPDATE_LAST_ANSWER', payload: updatedMessage });
                        }, 100); // 100ms Verzögerung für geschmeidigeres Rendering
                    }
                }
            }

            // Sicherstellen, dass die finale Antwort gesetzt wird
            const finalResponse = {
                ...askResponse,
                answer: buffer,
                tokens: streamed_tokens,
                user_tokens: user_tokens
            };

            const finalMessage = {
                user: question,
                response: finalResponse
            };

            dispatch({ type: 'UPDATE_LAST_ANSWER', payload: finalMessage });

            // Scroll zum Ende
            requestAnimationFrame(() => {
                chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
            });

            // Speichern des Chats
            if (active_chat) {
                await storageService.appendMessage(finalMessage, options);
            } else {
                // Chat-Namen generieren und neuen Chat erstellen
                const chatname = await createChatName(
                    question,
                    finalResponse.answer,
                    language,
                    temperature,
                    system ?? "",
                    max_output_tokens,
                    LLM.llm_name
                );

                const id = await storageService.create(
                    [finalMessage],
                    options,
                    undefined,
                    chatname,
                    false
                );

                dispatch({ type: 'SET_ACTIVE_CHAT', payload: id });
                await fetchHistory();
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
            setIsGenerating(false);
        }
    }, [
        isLoading,
        answers,
        language,
        temperature,
        max_output_tokens,
        active_chat,
        LLM.llm_name,
        storageService,
        fetchHistory
    ]);

    // Regenerate-Funktion
    const onRegenerateResponseClicked = useCallback(async () => {
        if (answers.length === 0 || !active_chat || isLoading) return;

        try {
            setIsLoading(true);
            await storageService.popMessage();

            // Letzten Eintrag entfernen und speichern
            const lastAnswersCopy = [...answers];
            const lastAnswer = lastAnswersCopy.pop();

            if (lastAnswer) {
                dispatch({ type: 'SET_ANSWERS', payload: lastAnswersCopy });

                // Verzögerung einbauen, um State-Updates zu synchronisieren
                setTimeout(() => {
                    makeApiRequest(lastAnswer.user, systemPrompt);
                }, 0);
            }
        } catch (e) {
            setError(e);
        }
    }, [answers, active_chat, isLoading, storageService, makeApiRequest, systemPrompt]);

    // Rollback-Funktion
    const onRollbackMessage = useCallback(async (message: string) => {
        return async () => {
            if (!active_chat || isLoading) return;

            try {
                // finde die passende nachricht
                const result = await storageService.rollbackMessage(message);

            } catch (e) {
                setError(e);
            } finally {
                setIsLoading(false);
            }
        };
    }, [active_chat, isLoading, storageService, clearChat, fetchHistory]);

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

        setIsLoading(true);

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
                return fetchHistory();
            })
            .finally(() => {
                setIsLoading(false);
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
        makeApiRequest(example, system);
    }, [makeApiRequest, onSystemPromptChanged]);

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
            isLoading={isLoading && !isGenerating}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current, systemPrompt)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    ), [answers, onRegenerateResponseClicked, onRollbackMessage, isLoading, isGenerating, error, makeApiRequest, systemPrompt]);

    const examplesComponent = useMemo(() => (
        <ExampleList examples={CHAT_EXAMPLES} onExampleClicked={onExampleClicked} />
    ), [onExampleClicked]);

    const inputComponent = useMemo(() => (
        <QuestionInput
            clearOnSend
            placeholder={t("chat.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question, systemPrompt)}
            tokens_used={totalTokens}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    ), [isLoading, makeApiRequest, systemPrompt, totalTokens, question, t]);

    const sidebar_actions = useMemo(() => (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
        </>
    ), [clearChat, lastQuestionRef, isLoading]);

    const sidebar_content = useMemo(() => (
        <>
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
        </>
    ), [allChats, active_chat, fetchHistory, storageService, loadChat, t]);

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
            size="large"
        ></ChatLayout>
    ), [sidebar, examplesComponent, answerList, inputComponent, lastQuestionRef, t]);

    return layout;
};

export default Chat;
