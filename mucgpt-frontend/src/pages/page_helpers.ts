import { MutableRefObject, Dispatch, SetStateAction } from "react";
import { DBMessage, StorageService } from "../service/storage";
import { DBObject } from "../service/storage";
import { ChatMessage, ChatOptions } from "./chat/Chat";
import { ChatRequest, ChatResponse, ChatTurn, createChatName } from "../api";
import { ChatCompletionChunk, ChatCompletionChunkChoice } from "../api/models";

import language from "react-syntax-highlighter/dist/esm/languages/hljs/1c";
import { BotStorageService } from "../service/botstorage";
import { v4 as uuid } from "uuid";
import { handleRedirect } from "../api/fetch-utils";

export async function setupStore(
    error: unknown,
    setError: Dispatch<unknown>,
    setIsLoading: Dispatch<boolean>,
    storageService: StorageService<any, any>,
    setAnswers: (answers: ChatMessage[]) => void,
    answers: any[],
    lastQuestionRef: MutableRefObject<string>,
    setActiveChat: (id: string | undefined) => void
) {
    if (error) {
        setError(undefined);
    }
    setIsLoading(true);
    const existingData = await storageService.getNewestChat();
    if (existingData) {
        const messages = existingData.messages;
        setAnswers([...answers.concat(messages)]);
        lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
        setActiveChat(existingData.id);
    }
    setIsLoading(false);
}

export function handleDeleteChat(
    id: string | undefined,
    lastQuestionRef: MutableRefObject<string>,
    error: unknown,
    setError: Dispatch<unknown>,
    storageService: StorageService<any, any>,
    setAnswers: (answers: ChatMessage[]) => void,
    setActiveChat: (id: string | undefined) => void
) {
    if (!id) return;
    lastQuestionRef.current = "";
    if (error) {
        setError(undefined);
    }
    storageService.delete(id);
    setAnswers([]);
    setActiveChat(undefined);
}
export function handleRollback(
    index: number,
    activeChat: string,
    dispatch: Dispatch<any>,
    storageService: StorageService<any, any>,
    lastQuestionRef: MutableRefObject<string>,
    setQuestion: Dispatch<SetStateAction<string>>,
    clearChat: () => void,
    fetchHistory?: () => void
) {
    if (!activeChat) return;
    // Find the corresponding message
    storageService.rollbackMessage(index, activeChat, setQuestion).then(result => {
        if (!result) return;
        if (result.messages.length > 0) {
            dispatch({ type: "SET_ANSWERS", payload: result.messages });
            lastQuestionRef.current = result.messages[result.messages.length - 1].user;
        } else {
            clearChat();
            storageService.delete(result.id ?? "").then(() => {
                if (fetchHistory) fetchHistory();
            });
        }
    });
}

export async function handleRegenerate(
    answers: any[],
    dispatch: Dispatch<any>,
    activeChat: string,
    storageService: StorageService<any, any>,
    systemPrompt: string,
    callApi: (question: string, systemPrompt: string) => Promise<void>,
    isLoadingRef: MutableRefObject<boolean>
) {
    await storageService.popMessage(activeChat);

    // Remove the last entry and save
    const lastAnswersCopy = [...answers];
    const lastAnswer = lastAnswersCopy.pop();
    isLoadingRef.current = true;

    if (lastAnswer) {
        dispatch({ type: "SET_ANSWERS", payload: lastAnswersCopy });

        // Add a delay to synchronize state updates
        setTimeout(() => {
            callApi(lastAnswer.user, systemPrompt);
        }, 0);
    }
}

export const makeApiRequest = async (
    answers: any[],
    question: string,
    dispatch: Dispatch<any>,
    chatApi: any,
    LLM: any,
    activeChatRef: MutableRefObject<string | undefined>,
    storageService: StorageService<any, any>,
    options: ChatOptions,
    askResponse: ChatResponse,
    chatMessageStreamEnd: MutableRefObject<HTMLDivElement | null>,
    isLoadingRef: MutableRefObject<boolean>,
    fetchHistory?: () => void,
    bot_id?: string,
    enabled_tools?: string[]
) => {
    // Create history for the request
    const history: ChatTurn[] = answers.map((a: { user: any; response: { answer: any } }) => ({ user: a.user, bot: a.response.answer }));
    const request: ChatRequest = {
        history: [...history, { user: question, bot: undefined }],
        shouldStream: true,
        language: language,
        temperature: options.temperature,
        system_message: options.system ?? "",
        max_output_tokens: options.maxTokens,
        model: LLM.llm_name,
        enabled_tools: enabled_tools && enabled_tools.length > 0 ? enabled_tools : undefined
    };

    const response = await chatApi(request);
    handleRedirect(response);

    if (!response.body) {
        throw Error("No response body");
    }

    // Initialize response variables
    let user_tokens = 0;
    let streamed_tokens = 0;

    // Add an empty response
    const initialMessage = {
        user: question,
        response: { ...askResponse }
    };
    isLoadingRef.current = false;
    dispatch({ type: "ADD_ANSWER", payload: initialMessage });
    // Buffer for updates to reduce re-renders
    let buffer = "";
    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    // Process the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamBuffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split("\n");

            // Keep the last incomplete line in the buffer
            streamBuffer = lines.pop() || "";

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (data === "[DONE]") {
                        break;
                    }

                    try {
                        const chunk = JSON.parse(data) as ChatCompletionChunk;
                        const choice: ChatCompletionChunkChoice | undefined = chunk.choices?.[0];
                        if (!choice) continue;

                        // Stream end
                        if (choice.finish_reason === "stop") {
                            break;
                        }

                        // Handle token usage if available
                        const chunkWithUsage = chunk as ChatCompletionChunk & {
                            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                        };
                        if (chunkWithUsage.usage) {
                            user_tokens = user_tokens + (chunkWithUsage.usage.prompt_tokens || 0);
                            streamed_tokens = streamed_tokens + (chunkWithUsage.usage.completion_tokens || 0);
                        }

                        // Append partial content
                        const content = choice.delta?.content;
                        if (content) {
                            buffer += content;
                            // batch UI updates
                            if (updateTimer) clearTimeout(updateTimer);
                            updateTimer = setTimeout(() => {
                                const updatedResponse = {
                                    ...askResponse,
                                    answer: buffer,
                                    tokens: streamed_tokens,
                                    user_tokens: user_tokens
                                };
                                const updatedMessage = { user: question, response: updatedResponse };
                                dispatch({ type: "UPDATE_LAST_ANSWER", payload: updatedMessage });
                            }, 100);
                        }
                    } catch (parseError) {
                        console.warn("Failed to parse SSE data:", data, parseError);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
    // Ensure the final response is set
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

    dispatch({ type: "UPDATE_LAST_ANSWER", payload: finalMessage });

    // Scroll to the end
    requestAnimationFrame(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
    });

    // Save the chat
    if (activeChatRef.current) {
        await storageService.appendMessage(finalMessage, activeChatRef.current, options);
    } else {
        // Generate chat name and create a new chat
        const chatname = await createChatName(
            question,
            finalResponse.answer,
            language,
            options.temperature,
            options.system ?? "",
            options.maxTokens,
            LLM.llm_name
        );
        const id = bot_id
            ? await storageService.create([finalMessage], options, BotStorageService.GENERATE_BOT_CHAT_ID(bot_id, uuid()), chatname, false)
            : await storageService.create([finalMessage], options, uuid(), chatname, false);

        dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
        if (fetchHistory) fetchHistory();
    }
};

export type ChatState<A> = {
    answers: DBMessage<any>[];
    temperature: number;
    max_output_tokens: number;
    systemPrompt: string;
    active_chat: string | undefined;
    allChats: DBObject<ChatResponse, A>[];
    totalTokens: number;
};

export type ChatAction<A> =
    | { type: "SET_ANSWERS"; payload: ChatMessage[] }
    | { type: "ADD_ANSWER"; payload: ChatMessage }
    | { type: "UPDATE_LAST_ANSWER"; payload: ChatMessage }
    | { type: "CLEAR_ANSWERS" }
    | { type: "SET_TEMPERATURE"; payload: number }
    | { type: "SET_MAX_TOKENS"; payload: number }
    | { type: "SET_SYSTEM_PROMPT"; payload: string }
    | { type: "SET_ACTIVE_CHAT"; payload: string | undefined }
    | { type: "SET_ALL_CHATS"; payload: DBObject<ChatResponse, A>[] }
    | { type: "SET_TOTAL_TOKENS"; payload: number };

export function getChatReducer<A>() {
    return function chatReducer(state: ChatState<A>, action: ChatAction<A>): ChatState<A> {
        switch (action.type) {
            case "SET_ANSWERS":
                return { ...state, answers: action.payload };
            case "ADD_ANSWER":
                return { ...state, answers: [...state.answers, action.payload] };
            case "UPDATE_LAST_ANSWER": {
                if (state.answers.length === 0) return state;
                const newAnswers = [...state.answers];
                newAnswers[newAnswers.length - 1] = action.payload;
                return { ...state, answers: newAnswers };
            }
            case "CLEAR_ANSWERS":
                return { ...state, answers: [] };
            case "SET_TEMPERATURE":
                return { ...state, temperature: action.payload };
            case "SET_MAX_TOKENS":
                return { ...state, max_output_tokens: action.payload };
            case "SET_SYSTEM_PROMPT":
                return { ...state, systemPrompt: action.payload };
            case "SET_ACTIVE_CHAT":
                return { ...state, active_chat: action.payload };
            case "SET_ALL_CHATS":
                return { ...state, allChats: action.payload };
            case "SET_TOTAL_TOKENS":
                return { ...state, totalTokens: action.payload };
            default:
                return state;
        }
    };
}
