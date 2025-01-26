import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, Bot, ChatResponse, createChatName } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";

import useDebounce from "../../hooks/debouncehook";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { BotsettingsDrawer } from "../../components/BotsettingsDrawer/BotsettingsDrawer";
import { MessageError } from "../chat/MessageError";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ChatMessage } from "../chat/Chat";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { DBObject, StorageService } from "../../service/storage";

const BotChat = () => {
    const { id } = useParams();
    const bot_id = id || "0";
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<ChatMessage[]>([]);
    const [question, setQuestion] = useState<string>("");

    const [temperature, setTemperature] = useState(0.7);
    const [max_output_tokens, setMaxOutputTokens] = useState(LLM.max_output_tokens);
    const [systemPrompt, setSystemPrompt] = useState<string>("");

    const [title, setTitle] = useState<string>("Titel");
    const [description, setDescription] = useState<string>("Beschreibung");
    const [publish, setPublish] = useState<boolean>(false);

    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const botChatStorage: StorageService<ChatResponse, Bot> = botStorageService.getChatStorageService(bot_id, active_chat);

    const [allChats, setAllChats] = useState<DBObject<ChatResponse, {}>[]>([]);

    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ text: debouncedSystemPrompt, model: LLM });
            setSystemPromptTokens(response.count);
        } else setSystemPromptTokens(0);
    }, [debouncedSystemPrompt, LLM]);

    useEffect(() => {
        if (bot_id) {
            error && setError(undefined);
            setIsLoading(true);
            botStorageService.getBotConfig(bot_id).then(bot => {
                if (bot) {
                    setSystemPrompt(bot.system_message);
                    setTitle(bot.title);
                    setDescription(bot.description);
                    setPublish(bot.publish);
                    setTemperature(bot.temperature);
                    setMaxOutputTokens(bot.max_output_tokens);
                }
                return botStorageService.getNewestChatForBot(bot_id).then((existingChat) => {
                    if (existingChat) {
                        const messages = existingChat.messages;
                        if (messages[messages.length - 1].response.answer == "") {
                            // if the answer of the LLM has not (yet) returned
                            if (messages.length > 1) {
                                messages.pop();
                                setAnswers([...answers.concat(messages)]);
                            }
                            setError(new MessageError(t("components.history.error")));
                        } else {
                            setAnswers([...answers.concat(messages)]);
                        }
                        lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
                        setActiveChat(existingChat.id);
                    }
                }).then(() => {
                    return fetchHistory();
                })
            }).finally(() => {
                setIsLoading(false);
            });
        }
    }, []);

    useEffect(() => {
        makeTokenCountRequest();
        if (max_output_tokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        }
    }, [debouncedSystemPrompt, LLM, makeTokenCountRequest]);

    const fetchHistory = () => {
        return botStorageService.getAllChatForBot(bot_id).then(chats => {
            if (chats)
                setAllChats(chats);
        })
    };


    const makeApiRequest = async (question: string, system?: string) => {
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);
        let askResponse: AskResponse = {} as AskResponse;

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
                await botStorageService.appendMessage(bot_id, active_chat, { user: question, response: latestResponse });
            }
            else {
                // generate chat name for first chat
                const chatname = await createChatName(question, latestResponse.answer, language, temperature, system ? system : "", max_output_tokens, LLM.llm_name);

                // create and save current id
                const id = await botStorageService.createChat(bot_id, [{ user: question, response: latestResponse }], chatname);
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


    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens = systemPromptTokens + answers
        .map(answ => (answ.response.user_tokens || 0) + (answ.response.tokens || 0))
        .reduceRight((prev, curr) => prev + curr, 0);

    const onTemperatureChanged = (temp: number) => {
        setTemperature(temp);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temp,
            max_output_tokens: max_output_tokens
        };
        botChatStorage.update(undefined, newBot);
    };

    const onMaxTokensChanged = (maxTokens: number) => {
        if (maxTokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        } else {
            setMaxOutputTokens(maxTokens);
            let newBot: Bot = {
                title: title,
                description: description,
                system_message: systemPrompt,
                publish: publish,
                id: bot_id,
                temperature: temperature,
                max_output_tokens: maxTokens
            };
            botChatStorage.update(undefined, newBot);
        }
    };

    const onSystemPromptChanged = (systemPrompt: string) => {
        setSystemPrompt(systemPrompt);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temperature,
            max_output_tokens: max_output_tokens
        };
        botChatStorage.update(undefined, newBot);
    };

    const onPublishChanged = (publish: boolean) => {
        setPublish(publish);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temperature,
            max_output_tokens: max_output_tokens
        };
        botChatStorage.update(undefined, newBot);
    };

    const onTitleChanged = (title: string) => {
        setTitle(title);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temperature,
            max_output_tokens: max_output_tokens
        };
        botChatStorage.update(undefined, newBot);
    };

    const onDescriptionChanged = (description: string) => {
        setDescription(description);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temperature,
            max_output_tokens: max_output_tokens
        };
        botChatStorage.update(undefined, newBot);
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0 && botChatStorage.getActiveChatId()) {
            await botChatStorage.popMessage();
            let last = answers.pop();
            setAnswers(answers);
            if (last) {
                makeApiRequest(last.user, systemPrompt);
            }
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
                let result = await botChatStorage.rollbackMessage(message);
                if (result) {
                    setAnswers(result.messages);
                    lastQuestionRef.current = result.messages.length > 0 ? result.messages[result.messages.length - 1].user : "";
                }
                setQuestion(message);
            }
        }
    };


    const actions = (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
        </>
    );
    const history = <History
        allChats={allChats}
        currentActiveChatId={active_chat}
        onDeleteChat={async (id) => {
            await botChatStorage.delete(id);
            await fetchHistory();
        }}
        onChatNameChange={async (id, name: string) => {
            const newName = prompt(t("components.history.newchat"), name);
            await botChatStorage.renameChat(id, newName ? newName.trim() : name);
            await fetchHistory();
        }}
        onFavChange={async (id: string, fav: boolean) => {
            await botChatStorage.changeFavouritesInDb(id, fav);
            await fetchHistory();
        }}
        onSelect={async (id: string) => {
            const chat = await botChatStorage.get(id);
            if (chat) {
                setAnswers(chat.messages);
                lastQuestionRef.current = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].user : "";
                setActiveChat(id);
            }
        }}
    ></History>;
    const sidebar = (<>
        <BotsettingsDrawer
            temperature={temperature}
            setTemperature={onTemperatureChanged}
            max_output_tokens={max_output_tokens}
            setMaxTokens={onMaxTokensChanged}
            systemPrompt={systemPrompt}
            setSystemPrompt={onSystemPromptChanged}
            title={title}
            setTitle={onTitleChanged}
            description={description}
            setDescription={onDescriptionChanged}
            bot_id={bot_id}
            setPublish={onPublishChanged}
            actions={actions}
            before_content={history}
        ></BotsettingsDrawer>
    </>);
    const examplesComponent = <></>;
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
    const answerList = (
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={
                        <UserChatMessage
                            message={answer.user}
                            onRollbackMessage={onRollbackMessage(answer.user)}
                        />
                    }
                    usermsglabel={t("components.usericon.label") + " " + (index + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (index + 1).toString()}
                    botmsg={
                        <>
                            {" "}
                            {index === answers.length - 1 && (
                                <Answer
                                    key={index}
                                    answer={answer.response}
                                    onRegenerateResponseClicked={onRegeneratResponseClicked}
                                    setQuestion={question => setQuestion(question)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer.response} setQuestion={question => setQuestion(question)} />}
                        </>
                    }
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            onRollbackMessage={onRollbackMessage(lastQuestionRef.current)}
                        />
                    }
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
    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header=""
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="large"
        ></ChatLayout>
    );
};

export default BotChat;
