import { MutableRefObject, Dispatch, SetStateAction } from "react";
import { DBMessage, StorageService } from "../service/storage";
import { DBObject } from "../service/storage";
import { ChatMessage, ChatOptions } from "./chat/Chat";
import { ChatRequest, ChatResponse, ChatTurn } from "../api";
import { ChatCompletionChunk, ChatCompletionChunkChoice } from "../api/models";
import { ToolStreamHandler, ToolStatus } from "../utils/ToolStreamHandler";

import language from "react-syntax-highlighter/dist/esm/languages/hljs/1c";
import { BotStorageService } from "../service/botstorage";
import { v4 as uuid } from "uuid";
import { handleRedirect } from "../api/fetch-utils";
import { createChatName } from "../api/core-client";

/**
 * @fileoverview Chat page helper functions for managing chat state, API requests, and user interactions.
 * This module provides utilities for setting up chat storage, handling chat operations like deletion and regeneration,
 * and managing streaming API requests with tool execution support.
 */

/**
 * Initializes the chat store by loading the most recent chat from storage.
 * Sets up the initial state including loading the newest chat messages and setting the active chat.
 *
 * @param error - Current error state, will be cleared if present
 * @param setError - Function to update error state
 * @param setIsLoading - Function to update loading state
 * @param storageService - Service for managing chat storage operations
 * @param setAnswers - Function to update the chat messages/answers array
 * @param answers - Current array of chat messages
 * @param lastQuestionRef - Reference to store the last user question
 * @param setActiveChat - Function to set the currently active chat ID
 */
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
    // Clear any existing errors
    if (error) {
        setError(undefined);
    }

    // Show loading state while fetching data
    setIsLoading(true);

    // Load the most recent chat from storage
    const existingData = await storageService.getNewestChat();
    if (existingData) {
        const messages = existingData.messages;
        // Append existing messages to current answers array
        setAnswers([...answers.concat(messages)]);
        // Set the last question reference for UI state management
        lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
        // Set this chat as the active one
        setActiveChat(existingData.id);
    }

    // Hide loading state
    setIsLoading(false);
}

/**
 * Handles the deletion of a chat conversation.
 * Removes the chat from storage and resets the UI state to show no active chat.
 *
 * @param id - The ID of the chat to delete. If undefined, the function returns early
 * @param lastQuestionRef - Reference to store the last user question, will be cleared
 * @param error - Current error state, will be cleared if present
 * @param setError - Function to update error state
 * @param storageService - Service for managing chat storage operations
 * @param setAnswers - Function to clear the chat messages array
 * @param setActiveChat - Function to clear the active chat ID
 */
export function handleDeleteChat(
    id: string | undefined,
    lastQuestionRef: MutableRefObject<string>,
    error: unknown,
    setError: Dispatch<unknown>,
    storageService: StorageService<any, any>,
    setAnswers: (answers: ChatMessage[]) => void,
    setActiveChat: (id: string | undefined) => void
) {
    // Exit early if no chat ID is provided
    if (!id) return;

    // Clear the last question reference
    lastQuestionRef.current = "";

    // Clear any existing errors
    if (error) {
        setError(undefined);
    }

    // Delete the chat from storage
    storageService.delete(id);

    // Clear the UI state
    setAnswers([]);
    setActiveChat(undefined);
}
/**
 * Handles rolling back the chat conversation to a specific message index.
 * Removes all messages after the specified index and updates the UI state accordingly.
 * If no messages remain after rollback, the entire chat is deleted.
 *
 * @param index - The index of the message to rollback to (all messages after this will be removed)
 * @param activeChat - The ID of the currently active chat
 * @param dispatch - Function to dispatch state updates
 * @param storageService - Service for managing chat storage operations
 * @param lastQuestionRef - Reference to store the last user question
 * @param setQuestion - Function to update the current question input
 * @param clearChat - Function to clear the entire chat UI
 * @param fetchHistory - Optional function to refresh the chat history list
 */
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
    // Exit early if no active chat is selected
    if (!activeChat) return;

    // Rollback messages in storage and update UI state
    storageService.rollbackMessage(index, activeChat, setQuestion).then(result => {
        if (!result) return;

        if (result.messages.length > 0) {
            // Update the chat with remaining messages
            dispatch({ type: "SET_ANSWERS", payload: result.messages });
            // Update the last question reference
            lastQuestionRef.current = result.messages[result.messages.length - 1].user;
        } else {
            // No messages left - clear the chat and delete it from storage
            clearChat();
            storageService.delete(result.id ?? "").then(() => {
                // Refresh the history list if callback is provided
                if (fetchHistory) fetchHistory();
            });
        }
    });
}

/**
 * Handles regenerating the last assistant response in a chat conversation.
 * Removes the last message from storage and triggers a new API call with the same user question.
 *
 * @param answers - Current array of chat messages
 * @param dispatch - Function to dispatch state updates
 * @param activeChat - The ID of the currently active chat
 * @param storageService - Service for managing chat storage operations
 * @param systemPrompt - The system prompt to use for the API call
 * @param callApi - Function to make the API call with question and system prompt
 * @param isLoadingRef - Reference to track loading state
 */
export async function handleRegenerate(
    answers: any[],
    dispatch: Dispatch<any>,
    activeChat: string,
    storageService: StorageService<any, any>,
    systemPrompt: string,
    callApi: (question: string, systemPrompt: string) => Promise<void>,
    isLoadingRef: MutableRefObject<boolean>
) {
    // Remove the last message from storage
    await storageService.popMessage(activeChat);

    // Create a copy of answers and remove the last entry
    const lastAnswersCopy = [...answers];
    const lastAnswer = lastAnswersCopy.pop();

    // Set loading state
    isLoadingRef.current = true;

    if (lastAnswer) {
        // Update UI to show answers without the last response
        dispatch({ type: "SET_ANSWERS", payload: lastAnswersCopy });

        // Add a delay to ensure state updates are synchronized before making the API call
        setTimeout(() => {
            callApi(lastAnswer.user, systemPrompt);
        }, 0);
    }
}

/**
 * Makes a streaming API request to the chat service and handles the response.
 * Processes Server-Sent Events (SSE) stream, handles tool calls, and updates the UI in real-time.
 * Also manages chat storage and history.
 *
 * @param answers - Current array of chat messages
 * @param question - The user's question/input
 * @param dispatch - Function to dispatch state updates
 * @param chatApi - API function for making chat requests
 * @param LLM - Language model configuration object
 * @param activeChatRef - Reference to the currently active chat ID
 * @param storageService - Service for managing chat storage operations
 * @param options - Chat configuration options (temperature, max tokens, etc.)
 * @param askResponse - Base response object to build upon
 * @param chatMessageStreamEnd - Reference to DOM element for auto-scrolling
 * @param isLoadingRef - Reference to track loading state
 * @param fetchHistory - Optional function to refresh the chat history list
 * @param bot_id - Optional bot ID for bot-specific chat storage
 * @param enabled_tools - Optional array of enabled tool names
 * @param onToolStatusUpdate - Optional callback for tool status updates
 */
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
    enabled_tools?: string[],
    onToolStatusUpdate?: (statuses: ToolStatus[]) => void
) => {
    // Create conversation history for the API request
    const history: ChatTurn[] = answers.map((a: { user: any; response: { answer: any } }) => ({ user: a.user, bot: a.response.answer }));

    // Build the API request object
    const request: ChatRequest = {
        history: [...history, { user: question, bot: undefined }],
        shouldStream: true, // Enable streaming for real-time responses
        language: language,
        temperature: options.temperature,
        system_message: options.system ?? "",
        max_output_tokens: options.maxTokens,
        model: LLM.llm_name,
        enabled_tools: enabled_tools && enabled_tools.length > 0 ? enabled_tools : undefined
    };

    // Make the API call
    const response = await chatApi(request);
    handleRedirect(response);

    // Ensure we have a response body for streaming
    if (!response.body) {
        throw Error("No response body");
    } // Initialize token counters for usage tracking
    let user_tokens = 0;
    let streamed_tokens = 0;

    // Initialize tool stream handler for processing tool calls
    const toolStreamHandler = new ToolStreamHandler();
    let activeToolStatuses: ToolStatus[] = [];

    // Add an empty initial message to the chat
    const initialMessage = {
        user: question,
        response: { ...askResponse }
    };
    isLoadingRef.current = false;
    dispatch({ type: "ADD_ANSWER", payload: initialMessage });

    // Buffer management for optimized UI updates
    let textBuffer = ""; // Accumulates regular text content
    let updateTimer: ReturnType<typeof setTimeout> | null = null; // Debounces UI updates    // Setup streaming response processing
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamBuffer = ""; // Buffer for incomplete SSE lines

    try {
        // Main streaming loop - process chunks as they arrive
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode and buffer the incoming data
            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split("\n");

            // Keep the last incomplete line in the buffer for next iteration
            streamBuffer = lines.pop() || "";

            // Process each complete line
            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();

                    // Check for stream end marker
                    if (data === "[DONE]") {
                        break;
                    }

                    try {
                        // Parse the SSE chunk data
                        const chunk = JSON.parse(data) as ChatCompletionChunk;
                        const choice: ChatCompletionChunkChoice | undefined = chunk.choices?.[0];
                        if (!choice) continue; // Check if streaming is complete
                        if (choice.finish_reason === "stop") {
                            break;
                        }

                        // Handle token usage information if available
                        const chunkWithUsage = chunk as ChatCompletionChunk & {
                            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
                        };
                        if (chunkWithUsage.usage) {
                            user_tokens = user_tokens + (chunkWithUsage.usage.prompt_tokens || 0);
                            streamed_tokens = streamed_tokens + (chunkWithUsage.usage.completion_tokens || 0);
                        }

                        // Handle tool calls if present in the response
                        if (choice.delta?.tool_calls) {
                            for (const toolCall of choice.delta.tool_calls) {
                                const { statusChange } = toolStreamHandler.handleToolCall(toolCall);

                                // Update active tool statuses if there was a change
                                if (statusChange) {
                                    activeToolStatuses = toolStreamHandler.getActiveToolStatuses();
                                    // Notify the component about tool status changes
                                    if (onToolStatusUpdate) {
                                        onToolStatusUpdate(activeToolStatuses);
                                    }
                                }

                                // Batch UI updates to prevent excessive re-renders
                                if (updateTimer) clearTimeout(updateTimer);
                                updateTimer = setTimeout(() => {
                                    // Combine text content and tool output
                                    const toolContent = toolStreamHandler.getFormattedContent();
                                    const combinedContent = textBuffer + toolContent;

                                    const updatedResponse = {
                                        ...askResponse,
                                        answer: combinedContent,
                                        tokens: streamed_tokens,
                                        user_tokens: user_tokens,
                                        // Include active tool status messages
                                        activeTools: statusChange ? activeToolStatuses : undefined
                                    };

                                    const updatedMessage = { user: question, response: updatedResponse };
                                    dispatch({ type: "UPDATE_LAST_ANSWER", payload: updatedMessage });
                                }, 100);
                            }
                        }
                        // Handle regular text content from the assistant
                        else if (choice.delta?.content) {
                            const content = choice.delta.content;
                            textBuffer += content;

                            // Batch UI updates to prevent excessive re-renders
                            if (updateTimer) clearTimeout(updateTimer);
                            updateTimer = setTimeout(() => {
                                const toolContent = toolStreamHandler.getFormattedContent();
                                const combinedContent = textBuffer + toolContent;

                                const updatedResponse = {
                                    ...askResponse,
                                    answer: combinedContent,
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
        // Always release the reader lock to prevent memory leaks
        reader.releaseLock();
    }

    // Ensure the final response is set with combined content after streaming completes
    const finalToolContent = toolStreamHandler.getFormattedContent();
    const finalCombinedContent = textBuffer + finalToolContent;

    const finalResponse = {
        ...askResponse,
        answer: finalCombinedContent,
        tokens: streamed_tokens,
        user_tokens: user_tokens
    };

    const finalMessage = {
        user: question,
        response: finalResponse
    };

    // Update the UI with the final complete message
    dispatch({ type: "UPDATE_LAST_ANSWER", payload: finalMessage });

    // Auto-scroll to show the latest message
    requestAnimationFrame(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
    });

    // Save the chat to storage
    if (activeChatRef.current) {
        // Append to existing chat
        await storageService.appendMessage(finalMessage, activeChatRef.current, options);
    } else {
        // Create a new chat with generated name
        const chatname = await createChatName(
            question,
            finalResponse.answer,
            language,
            options.temperature,
            options.system ?? "",
            options.maxTokens,
            LLM.llm_name
        );

        // Create chat with bot-specific ID if bot_id is provided, otherwise use regular UUID
        const id = bot_id
            ? await storageService.create([finalMessage], options, BotStorageService.GENERATE_BOT_CHAT_ID(bot_id, uuid()), chatname, false)
            : await storageService.create([finalMessage], options, uuid(), chatname, false);

        // Set the new chat as active and refresh history
        dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
        if (fetchHistory) fetchHistory();
    }
};

/**
 * Type definition for the chat application state.
 * Contains all the necessary data for managing chat conversations and settings.
 *
 * @template A - Generic type for additional chat metadata
 */
export type ChatState<A> = {
    /** Array of chat messages/answers in the current conversation */
    answers: DBMessage<any>[];
    /** Temperature setting for AI response randomness (0.0 = deterministic, 1.0 = creative) */
    temperature: number;
    /** Maximum number of tokens the AI can generate in a response */
    max_output_tokens: number;
    /** System prompt that defines the AI's behavior and personality */
    systemPrompt: string;
    /** ID of the currently active chat conversation */
    active_chat: string | undefined;
    /** Array of all chat conversations stored in the application */
    allChats: DBObject<ChatResponse, A>[];
    /** Total number of tokens used across all conversations */
    totalTokens: number;
};

/**
 * Union type for all possible actions that can be dispatched to update chat state.
 * Uses Redux-style action objects with type and payload properties.
 *
 * @template A - Generic type for additional chat metadata
 */
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

/**
 * Factory function that creates a reducer for managing chat state.
 * Implements the Redux pattern for predictable state updates.
 *
 * @template A - Generic type for additional chat metadata
 * @returns A reducer function that handles chat state updates
 */
export function getChatReducer<A>() {
    return function chatReducer(state: ChatState<A>, action: ChatAction<A>): ChatState<A> {
        switch (action.type) {
            case "SET_ANSWERS":
                // Replace the entire answers array with new messages
                return { ...state, answers: action.payload };
            case "ADD_ANSWER":
                // Append a new message to the end of the answers array
                return { ...state, answers: [...state.answers, action.payload] };
            case "UPDATE_LAST_ANSWER": {
                // Update the most recent message in the conversation
                if (state.answers.length === 0) return state;
                const newAnswers = [...state.answers];
                newAnswers[newAnswers.length - 1] = action.payload;
                return { ...state, answers: newAnswers };
            }
            case "CLEAR_ANSWERS":
                // Remove all messages from the current conversation
                return { ...state, answers: [] };
            case "SET_TEMPERATURE":
                // Update the AI temperature setting
                return { ...state, temperature: action.payload };
            case "SET_MAX_TOKENS":
                // Update the maximum token limit for AI responses
                return { ...state, max_output_tokens: action.payload };
            case "SET_SYSTEM_PROMPT":
                // Update the system prompt that guides AI behavior
                return { ...state, systemPrompt: action.payload };
            case "SET_ACTIVE_CHAT":
                // Set which chat conversation is currently active
                return { ...state, active_chat: action.payload };
            case "SET_ALL_CHATS":
                // Update the entire list of chat conversations
                return { ...state, allChats: action.payload };
            case "SET_TOTAL_TOKENS":
                // Update the total token usage counter
                return { ...state, totalTokens: action.payload };
            default:
                // Return unchanged state for unknown action types
                return state;
        }
    };
}
