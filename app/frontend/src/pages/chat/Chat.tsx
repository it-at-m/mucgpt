import { useRef, useState, useEffect, useContext, useCallback } from "react";
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

export type ChatMessage = DBMessage<ChatResponse>;

export interface ChatOptions {
    system: string;
    maxTokens: number;
    temperature: number;
}

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

const Chat = () => {
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const { quickPrompts, setQuickPrompts } = useContext(QuickPromptContext);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<ChatMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [temperature, setTemperature] = useState(0.7);
    const [max_output_tokens, setMaxOutputTokens] = useState(4000);
    const [systemPrompt, setSystemPrompt] = useState<string>("");

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const storageService: StorageService<ChatResponse, ChatOptions> = new StorageService<ChatResponse, ChatOptions>(CHAT_STORE, active_chat);

    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const [totalTokens, setTotalTokens] = useState<number>(0);

    const [allChats, setAllChats] = useState<DBObject<ChatResponse, ChatOptions>[]>([]);

    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ text: debouncedSystemPrompt, model: LLM });
            setSystemPromptTokens(response.count);
        } else setSystemPromptTokens(0);
    }, [debouncedSystemPrompt, LLM]);

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
    }, [language]);

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
                    let options = existingData.config;
                    setAnswers([...answers.concat(messages)]);
                    if (options) {
                        setMaxOutputTokens(options.maxTokens);
                        setTemperature(options.temperature);
                        setSystemPrompt(options.system);
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
                    setAnswers([...answers, { user: question, response: latestResponse }]);
                    setIsLoading(false);
                }
            }
            chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
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

    useEffect(() => {
        setTotalTokens(
            systemPromptTokens + answers.map(answ => (answ.response.user_tokens || 0) + (answ.response.tokens || 0)).reduceRight((prev, curr) => prev + curr, 0)
        );
    }, [answers, systemPromptTokens]);

    const onExampleClicked = async (example: string, system?: string) => {
        if (system) onSystemPromptChanged(system);
        makeApiRequest(example, system);
    };

    const onTemperatureChanged = (temp: number) => {
        setTemperature(temp);
        storageService.update(undefined, {
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
            storageService.update(undefined, {
                system: systemPrompt ? systemPrompt : "",
                maxTokens: maxTokens,
                temperature: temperature
            });
        }
    };

    const onSystemPromptChanged = (systemPrompt: string) => {
        setSystemPrompt(systemPrompt);
        storageService.update(undefined, {
            system: systemPrompt ? systemPrompt : "",
            maxTokens: max_output_tokens,
            temperature: temperature
        });
    };

    const answerList = (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer, index) => {
                return (
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
                );
            }}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoading}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current, systemPrompt)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
    );
    const examplesComponent = <ExampleList examples={CHAT_EXAMPLES} onExampleClicked={onExampleClicked} />;
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
                        setMaxOutputTokens(chat.config.maxTokens);
                        setTemperature(chat.config.temperature);
                        setSystemPrompt(chat.config.system);
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
        />
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
