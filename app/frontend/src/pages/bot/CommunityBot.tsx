import { useRef, useState, useEffect, useContext } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, Bot, ChatResponse, createChatName, getCommunityBotAllVersions } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { History } from "../../components/History/History";

import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ChatMessage } from "../chat/Chat";
import { BOT_STORE, COMMUNITY_BOT_STORE } from "../../constants";
import { DBObject, StorageService } from "../../service/storage";
import { CommunityBotSettingsDrawer } from "../../components/BotsettingsDrawer/CommunityBotSettingsDrawer";
import { CommunityBotStorageService } from "../../service/communitybotstorage";
import { BotStorageService } from "../../service/botstorage";

const CommunityBotChat = () => {
    const { id, version } = useParams();
    const bot_id: string = id || "0";
    const [botVersion, setBotVersion] = useState<number>(version ? parseFloat(version.replace("-", ".")) : 0);
    const [botAllVersions, setBotAllVersions] = useState<string[]>([String(botVersion)]);
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
    const communitybotStorageService: CommunityBotStorageService = new CommunityBotStorageService(COMMUNITY_BOT_STORE);
    const communitybotChatStorage: StorageService<ChatResponse, Bot> = communitybotStorageService.getChatStorageService(active_chat);

    const botStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    //history
    const [allChats, setAllChats] = useState<DBObject<ChatResponse, {}>[]>([]);
    //config
    const [botConfig, setBotConfig] = useState<Bot>({
        title: "Titel",
        description: "Beschreibung",
        publish: false,
        max_output_tokens: LLM.max_output_tokens,
        system_message: "",
        temperature: 0.7,
        tags: [],
        version: 1,
        owner: "Me",
        id: bot_id
    });

    useEffect(() => {
        if (bot_id) {
            communitybotStorageService.getBotConfig(bot_id).then(bot => {
                if (bot) {
                    setBotConfig(bot);
                }
            });
            getCommunityBotAllVersions(bot_id).then(bots => {
                let versions: string[] = []
                for (let i = 0; i < bots.length; i++) {
                    versions.push(String(bots[i].version));
                }
                setBotAllVersions(versions);
                const bot = bots.find(b => b.version == botVersion);
                if (bot) {
                    setBotConfig(bot);
                    communitybotStorageService.updateBotConfig(bot);
                }
            }
            );
            error && setError(undefined);
            setIsLoading(true);
            communitybotStorageService
                .getBotConfig(bot_id)
                .then(bot => {
                    return communitybotStorageService
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
        return communitybotStorageService.getAllChatForBot(bot_id).then(chats => {
            if (chats) setAllChats(chats);
        });
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
                await communitybotChatStorage.appendMessage({ user: question, response: latestResponse }, undefined);
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
                const id = await communitybotStorageService.createChat(bot_id, [{ user: question, response: latestResponse }], chatname);
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

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0 && communitybotChatStorage.getActiveChatId()) {
            await communitybotChatStorage.popMessage();
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
                let result = await communitybotChatStorage.rollbackMessage(message);
                if (result) {
                    setAnswers(result.messages);
                    lastQuestionRef.current = result.messages.length > 0 ? result.messages[result.messages.length - 1].user : "";
                }
                setQuestion(message);
            }
        };
    };

    let toOwnBots = () => {
        //TODO copyHistory(bot_id, bot_id, community_bot_history_storage, bot_history_storage);
        let bot: Bot = {
            title: botConfig.title + " Kopie",
            description: botConfig.description,
            system_message: botConfig.system_message,
            publish: botConfig.publish,
            id: bot_id,
            temperature: botConfig.temperature,
            max_output_tokens: botConfig.max_output_tokens,
            version: botVersion,
            owner: botConfig.owner,
            tags: botConfig.tags
        }
        botStorageService.createBotConfig(bot);
        window.location.href = "/"
    };
    const onDeleteBot = async () => {
        await communitybotStorageService.deleteConfigAndChatsForBot(bot_id);
        window.location.href = "/";
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
                await communitybotChatStorage.delete(id);
                await fetchHistory();
            }}
            onChatNameChange={async (id, name: string) => {
                const newName = prompt(t("components.history.newchat"), name);
                await communitybotChatStorage.renameChat(id, newName ? newName.trim() : name);
                await fetchHistory();
            }}
            onFavChange={async (id: string, fav: boolean) => {
                await communitybotChatStorage.changeFavouritesInDb(id, fav);
                await fetchHistory();
            }}
            onSelect={async (id: string) => {
                const chat = await communitybotChatStorage.get(id);
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
            <CommunityBotSettingsDrawer
                bot={botConfig}
                isOwner={false}
                toOwnBots={toOwnBots}
                actions={actions}
                before_content={history}
                allVersions={botAllVersions}
                deleteBot={onDeleteBot} />
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
        <>
            {answers.map((answer, index) => (
                <ChatTurnComponent
                    key={index}
                    usermsg={<UserChatMessage message={answer.user} onRollbackMessage={onRollbackMessage(answer.user)} />}
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
                    usermsg={<UserChatMessage message={lastQuestionRef.current} onRollbackMessage={onRollbackMessage(lastQuestionRef.current)} />}
                    usermsglabel={t("components.usericon.label") + " " + (answers.length + 1).toString()}
                    botmsglabel={t("components.answericon.label") + " " + (answers.length + 1).toString()}
                    botmsg={
                        <>
                            {isLoading && <AnswerLoading text={t("chat.answer_loading")} />}
                            {error ? <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} /> : null}
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
        <>
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
        </>
    );
};

export default CommunityBotChat;
