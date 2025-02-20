import { useRef, useState, useEffect, useContext } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, Bot, ChatResponse, createChatName } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";

import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { BotsettingsDrawer } from "../../components/BotsettingsDrawer/BotsettingsDrawer";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ChatMessage } from "../chat/Chat";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";
import { DBObject, StorageService } from "../../service/storage";
import { AnswerList } from "../../components/AnswerList/AnswerList";

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

    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);

    const [active_chat, setActiveChat] = useState<string | undefined>(undefined);
    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const botChatStorage: StorageService<ChatResponse, Bot> = botStorageService.getChatStorageService(active_chat);
    //history
    const [allChats, setAllChats] = useState<DBObject<ChatResponse, {}>[]>([]);
    //config
    const [botConfig, setBotConfig] = useState<Bot>({
        title: "Titel",
        description: "Beschreibung",
        publish: false,
        max_output_tokens: LLM.max_output_tokens,
        system_message: "",
        temperature: 0.7
    });

    useEffect(() => {
        if (bot_id) {
            error && setError(undefined);
            setIsLoading(true);
            botStorageService
                .getBotConfig(bot_id)
                .then(bot => {
                    if (bot) setBotConfig(bot);
                    return botStorageService
                        .getNewestChatForBot(bot_id)
                        .then(existingChat => {
                            if (existingChat) {
                                const messages = existingChat.messages;
                                setAnswers([...answers.concat(messages)]);
                                lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
                                setActiveChat(existingChat.id);
                            }
                        })
                        .then(() => {
                            return fetchHistory();
                        });
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, []);

    const fetchHistory = () => {
        return botStorageService.getAllChatForBot(bot_id).then(chats => {
            if (chats) setAllChats(chats);
        });
    };

    const onDeleteBot = async () => {
        await botStorageService.deleteConfigAndChatsForBot(bot_id);
        window.location.href = "/";
    };

    const makeApiRequest = async (question: string) => {
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
                temperature: botConfig.temperature,
                system_message: botConfig.system_message ? botConfig.system_message : "",
                max_output_tokens: botConfig.max_output_tokens,
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
                await botChatStorage.appendMessage({ user: question, response: latestResponse }, undefined);
            } else {
                // generate chat name for first chat
                const chatname = await createChatName(
                    question,
                    latestResponse.answer,
                    language,
                    botConfig.temperature,
                    botConfig.system_message ? botConfig.system_message : "",
                    botConfig.max_output_tokens,
                    LLM.llm_name
                );

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

    const totalTokens =
        systemPromptTokens + answers.map(answ => (answ.response.user_tokens || 0) + (answ.response.tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);

    const onBotChanged = async (newBot: Bot) => {
        await botStorageService.setBotConfig(bot_id, newBot);
        setBotConfig(newBot);
        // count tokens in case of new system message
        if (newBot.system_message !== botConfig.system_message) {
            const response = await countTokensAPI({ text: newBot.system_message, model: LLM });
            setSystemPromptTokens(response.count);
        }
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0 && botChatStorage.getActiveChatId()) {
            await botChatStorage.popMessage();
            let last = answers.pop();
            setAnswers(answers);
            if (last) {
                makeApiRequest(last.user);
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
        };
    };

    const actions = (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
        </>
    );
    const history = (
        <History
            allChats={allChats}
            currentActiveChatId={active_chat}
            onDeleteChat={async id => {
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
        ></History>
    );
    const sidebar = (
        <>
            <BotsettingsDrawer
                bot={botConfig}
                onBotChange={onBotChanged}
                onDeleteBot={onDeleteBot}
                actions={actions}
                before_content={history}
            ></BotsettingsDrawer>
        </>
    );
    const examplesComponent = <></>;
    const inputComponent = (
        <QuestionInput
            clearOnSend
            placeholder={t("chat.prompt")}
            disabled={isLoading}
            onSend={question => makeApiRequest(question)}
            tokens_used={totalTokens}
            question={question}
            setQuestion={question => setQuestion(question)}
        />
    );
    const answerList = (
        <AnswerList
            answers={answers}
            regularBotMsg={(answer, index) => {
                return (
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
                );
            }}
            onRollbackMessage={onRollbackMessage}
            isLoading={isLoading}
            error={error}
            makeApiRequest={() => makeApiRequest(lastQuestionRef.current)}
            chatMessageStreamEnd={chatMessageStreamEnd}
            lastQuestionRef={lastQuestionRef}
        />
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
