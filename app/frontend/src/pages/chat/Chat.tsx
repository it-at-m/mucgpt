import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, ChatResponse, createChatName } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";
import { History } from "../../components/History/History";
import useDebounce from "../../hooks/debouncehook";
import { MessageError } from "./MessageError";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { CHAT_STORE, STORAGE_KEYS_CHAT } from "../../constants";
import { DBMessage, DBObject, StorageService } from "../../service/storage";

export type ChatMessage = DBMessage<ChatResponse>;

export interface ChatOptions {
    favorite: boolean;
    system: string;
    maxTokens: number;
    temperature: number;
}

const Chat = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<ChatMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const temperature_pref = Number(localStorage.getItem(STORAGE_KEYS_CHAT.CHAT_TEMPERATURE) || 0.7);
    const max_output_tokens_pref = Number(localStorage.getItem(STORAGE_KEYS_CHAT.CHAT_MAX_TOKENS)) || 4000;
    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS_CHAT.CHAT_SYSTEM_PROMPT) || "";

    const [temperature, setTemperature] = useState(temperature_pref);
    const [max_output_tokens, setMaxOutputTokens] = useState(max_output_tokens_pref);
    const [systemPrompt, setSystemPrompt] = useState<string>(systemPrompt_pref);

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const storageService: StorageService<ChatResponse, ChatOptions> = new StorageService<ChatResponse, ChatOptions>(CHAT_STORE, active_chat);

    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);

    const [allChats, setAllChats] = useState<DBObject<ChatResponse, ChatOptions>[]>([]);

    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ text: debouncedSystemPrompt, model: LLM });
            setSystemPromptTokens(response.count);
        } else setSystemPromptTokens(0);
    }, [debouncedSystemPrompt, LLM]);

    useEffect(() => {
        makeTokenCountRequest();
        if (max_output_tokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        }
    }, [debouncedSystemPrompt, LLM, makeTokenCountRequest]);

    const fetchHistory = () => {
        return storageService.getAll().then(chats => {
            if (chats) setAllChats(chats);
        });
    };

    useEffect(() => {
        setAnswers([]);
        lastQuestionRef.current = "";
        error && setError(undefined);
        setIsLoading(true);

        storageService
            .getNewestChat()
            .then(existingData => {
                if (existingData) {
                    // if the chat exists
                    const messages = existingData.messages;
                    if (messages[messages.length - 1].response.answer == "") {
                        // if the answer of the LLM has not (yet) returned
                        if (messages.length > 1) {
                            messages.pop();
                            setAnswers([...answers.concat(messages)]);
                        }
                        setError(new MessageError(t("components.history.error")));
                    } else {
                        let options = existingData.config;
                        setAnswers([...answers.concat(messages)]);
                        if (options) {
                            onMaxTokensChanged(options.maxTokens);
                            onTemperatureChanged(options.temperature);
                            onSystemPromptChanged(options.system);
                        }
                    }
                    lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
                    setActiveChat(existingData.id);
                }
                return fetchHistory();
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const makeApiRequest = async (question: string, system?: string) => {
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);
        const askResponse: ChatResponse = { answer: "", tokens: 0, user_tokens: 0 } as AskResponse;
        const options: ChatOptions = {
            favorite: false,
            system: system ? system : "",
            maxTokens: max_output_tokens,
            temperature: temperature //TODO model LLM.llm_name übergeben?
        };

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a.user, bot: a.response.answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: true,
                language: language,
                temperature: temperature,
                system_message: system ? system : "",
                max_output_tokens: max_output_tokens,
                model: LLM.llm_name
            };

            const response = await chatApi(request);
            handleRedirect(response);

            if (!response.body) {
                throw Error("No response body");
            }
            let user_tokens = 0;
            let answer: string = "";
            let streamed_tokens = 0;
            let latestResponse: ChatResponse = { ...askResponse, answer: answer, tokens: streamed_tokens, user_tokens: user_tokens };

            for await (const chunk of readNDJSONStream(response.body)) {
                if (chunk as Chunk) {
                    switch (chunk.type) {
                        case "C":
                            answer += chunk.message as string;
                            break;
                        case "I":
                            const info = chunk.message as ChunkInfo;
                            streamed_tokens = info.streamedtokens;
                            user_tokens = info.requesttokens;
                            break;
                        case "E":
                            throw Error((chunk.message as string) || "Unknown error");
                    }

                    latestResponse = { ...askResponse, answer: answer, tokens: streamed_tokens, user_tokens: user_tokens };
                    setIsLoading(false);
                    setAnswers([...answers, { user: question, response: latestResponse }]);
                }
            }
            //chat present, if not create.
            if (active_chat) {
                await storageService.appendMessage({ user: question, response: latestResponse }, options);
            } else {
                // generate chat name for first chat
                const chatname = await createChatName(
                    question,
                    latestResponse.answer,
                    language,
                    temperature,
                    system ? system : "",
                    max_output_tokens,
                    LLM.llm_name
                );

                // create and save current id
                const id = await storageService.create([{ user: question, response: latestResponse }], options, undefined, chatname, false);
                setActiveChat(id);

                // fetch all chats
                await fetchHistory();
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };
    const clearChat = () => {
        lastQuestionRef.current = "";
        error && setError(undefined);
        //unset active chat
        if (active_chat) {
            setActiveChat(undefined);
        }
        setAnswers([]);
    };

    const onRollbackMessage = (message: string) => {
        return async () => {
            if (active_chat) {
                let result = await storageService.rollbackMessage(message);
                if (result) {
                    setAnswers(result.messages);
                    lastQuestionRef.current = result.messages.length > 0 ? result.messages[result.messages.length - 1].user : "";
                }
                setQuestion(message);
            }
        };
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0 && storageService.getActiveChatId()) {
            await storageService.popMessage();
            let last = answers.pop();
            setAnswers(answers);
            if (last) {
                makeApiRequest(last.user, systemPrompt);
            }
        }
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens =
        systemPromptTokens + answers.map(answ => (answ.response.user_tokens || 0) + (answ.response.tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);

    const onExampleClicked = async (example: string, system?: string) => {
        if (system) onSystemPromptChanged(system);
        makeApiRequest(example, system);
    };

    const onTemperatureChanged = (temp: number) => {
        setTemperature(temp);
        localStorage.setItem(STORAGE_KEYS_CHAT.CHAT_TEMPERATURE, temp.toString());
        storageService.update(undefined, {
            favorite: false,
            system: systemPrompt ? systemPrompt : "",
            maxTokens: max_output_tokens,
            temperature: temp
        });
    };

    const onMaxTokensChanged = (maxTokens: number) => {
        if (maxTokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        } else {
            setMaxOutputTokens(maxTokens);
            localStorage.setItem(STORAGE_KEYS_CHAT.CHAT_MAX_TOKENS, maxTokens.toString());
            storageService.update(undefined, {
                favorite: false,
                system: systemPrompt ? systemPrompt : "",
                maxTokens: maxTokens,
                temperature: temperature
            });
        }
    };

    const onSystemPromptChanged = (systemPrompt: string) => {
        setSystemPrompt(systemPrompt);
        localStorage.setItem(STORAGE_KEYS_CHAT.CHAT_SYSTEM_PROMPT, systemPrompt);
        storageService.update(undefined, {
            favorite: false,
            system: systemPrompt ? systemPrompt : "",
            maxTokens: max_output_tokens,
            temperature: temperature
        });
    };

    const answerList = (
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={<UserChatMessage message={answer.user} onRollbackMessage={onRollbackMessage(answer.user)} />}
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={
                        <>
                            {index === answers.length - 1 && (
                                <Answer
                                    answer={answer.response}
                                    onRegenerateResponseClicked={onRegeneratResponseClicked}
                                    setQuestion={question => setQuestion(question)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer answer={answer.response} setQuestion={question => setQuestion(question)} />}
                        </>
                    }
                ></ChatTurnComponent>
            ))}

            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={<UserChatMessage message={lastQuestionRef.current} onRollbackMessage={onRollbackMessage(lastQuestionRef.current)} />}
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={t("chat.answer_loading")} />}
                            {error ? <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current, systemPrompt)} /> : null}
                        </>
                    }
                ></ChatTurnComponent>
            ) : (
                <div></div>
            )}
            <div ref={chatMessageStreamEnd} />
        </>
    );
    const examplesComponent = <ExampleList onExampleClicked={onExampleClicked} />;
    const inputComponent = (
        <QuestionInput
            clearOnSend
            placeholder={t("chat.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question, systemPrompt)}
            tokens_used={totalTokens}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    );
    const sidebar_actions = (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
        </>
    );
    const sidebar_content = (
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
                    const chat = await storageService.get(id);
                    if (chat) {
                        setAnswers(chat.messages);
                        lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";
                        setActiveChat(id);
                    }
                }}
            ></History>
        </>
    );
    const sidebar = (
        <ChatsettingsDrawer
            temperature={temperature}
            setTemperature={onTemperatureChanged}
            max_output_tokens={max_output_tokens}
            setMaxTokens={onMaxTokensChanged}
            systemPrompt={systemPrompt}
            setSystemPrompt={onSystemPromptChanged}
            actions={sidebar_actions}
            content={sidebar_content}
        ></ChatsettingsDrawer>
    );
    return (
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
    );
};

export default Chat;
