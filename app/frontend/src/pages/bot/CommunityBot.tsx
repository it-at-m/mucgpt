import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, Bot, getCommunityBot, getCommunityBotAllVersions } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import {
    bot_history_storage,
    community_bot_history_storage,
    community_bot_storage,
    copyHistory,
    deleteBotChatFromDB,
    getBotStartDataFromDB,
    getCommunityBotWithId,
    popLastCommunityBotMessageInDB,
    saveCommunityBotChatToDB,
    storeBot,
    storeCommunityBot
} from "../../service/storage_bot";

import useDebounce from "../../hooks/debouncehook";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { MessageError } from "../chat/MessageError";
import { ChatTurnComponent } from "../../components/ChatTurnComponent/ChatTurnComponent";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { CommunityBotSettingsDrawer } from "../../components/BotsettingsDrawer/CommunityBotSettingsDrawer";

const BotChat = () => {
    const { id, version } = useParams();
    const bot_id = id || "0";
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const [shouldStream, setShouldStream] = useState<boolean>(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<[user: string, response: AskResponse, user_tokens: number][]>([]);
    const [question, setQuestion] = useState<string>("");

    const [temperature, setTemperature] = useState(0.7);
    const [max_output_tokens, setMaxOutputTokens] = useState(LLM.max_output_tokens);
    const [systemPrompt, setSystemPrompt] = useState<string>("");

    const [title, setTitle] = useState<string>("Titel");
    const [description, setDescription] = useState<string>("Beschreibung");
    const [tags, setTags] = useState<string[]>([]);
    const [owner, setOwner] = useState<string>("No Owner");
    const [botVersion, setBotVersion] = useState<number>(version ? parseFloat(version.replace("-", ".")) : 0);
    const [botAllVersions, setBotAllVersions] = useState<string[]>([String(botVersion)]);
    const [publish, setPublish] = useState<boolean>(false);

    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const storage = community_bot_storage;
    const storage_history = community_bot_history_storage;
    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ text: debouncedSystemPrompt, model: LLM });
            setSystemPromptTokens(response.count);
        } else setSystemPromptTokens(0);
    }, [debouncedSystemPrompt, LLM]);
    useEffect(() => {
        if (bot_id) {
            console.log("Bot ID: " + bot_id);
            console.log("Version: " + String(botVersion).replace(".", "-"));
            getCommunityBotAllVersions(bot_id).then(bots => {
                let versions: string[] = []
                for (let i = 0; i < bots.length; i++) {
                    versions.push(String(bots[i].version));
                }
                setBotAllVersions(versions);
                const bot = bots.find(b => b.version == botVersion);
                if (bot) {
                    console.log("Bot: " + bot);
                    setSystemPrompt(bot.system_message);
                    setTitle(bot.title);
                    setDescription(bot.description);
                    setPublish(bot.publish);
                    setTemperature(bot.temperature);
                    setMaxOutputTokens(bot.max_output_tokens);
                    if (bot.tags) {
                        setTags(bot.tags);
                    }
                    if (bot.owner) {
                        setOwner(bot.owner);
                    }
                    if (bot.version) {
                        setBotVersion(bot.version);
                    }
                    storeCommunityBot({ id: bot_id, version: bot.version || 0, title: bot.title });
                }
            }
            );
            error && setError(undefined);
            setIsLoading(true);
            getBotStartDataFromDB(storage_history, bot_id).then(stored => {
                if (stored) {
                    let storedAnswers = stored.Answers;
                    lastQuestionRef.current = storedAnswers[storedAnswers.length - 1][0];
                    if (storedAnswers[storedAnswers.length - 1][1].answer == "") {
                        // if the answer of the LLM has not (yet) returned
                        if (storedAnswers.length > 1) {
                            storedAnswers.pop();
                            setAnswers([...answers.concat(storedAnswers)]);
                        }
                        setError(new MessageError(t("components.history.error")));
                    } else {
                        setAnswers([...answers.concat(storedAnswers)]);
                    }
                }
            });
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        makeTokenCountRequest();
        if (max_output_tokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        }
    }, [debouncedSystemPrompt, LLM, makeTokenCountRequest]);

    const makeApiRequest = async (question: string, system?: string) => {
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);
        let askResponse: AskResponse = {} as AskResponse;
        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: shouldStream,
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
            if (shouldStream) {
                let answer: string = "";
                let streamed_tokens = 0;
                let latestResponse: AskResponse = { ...askResponse, answer: answer, tokens: streamed_tokens };

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

                        latestResponse = { ...askResponse, answer: answer, tokens: streamed_tokens };
                        setIsLoading(false);
                        setAnswers([...answers, [question, latestResponse, user_tokens]]);
                    }
                }
                if (bot_id) {
                    saveCommunityBotChatToDB([question, latestResponse, user_tokens], bot_id);
                }
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
                if (bot_id) {
                    saveCommunityBotChatToDB([question, parsedResponse, 0], bot_id);
                }
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
        deleteBotChatFromDB(storage_history, bot_id, setAnswers, true, lastQuestionRef);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens = systemPromptTokens + answers.map(answ => answ[2] + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);

    const onMaxTokensChanged = (maxTokens: number) => {
        if (maxTokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens);
        } else {
            setMaxOutputTokens(maxTokens);
        }
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            popLastCommunityBotMessageInDB(bot_id);
            if (last) {
                makeApiRequest(last[0], systemPrompt);
            }
        }
    };
    let toOwnBots = () => {
        copyHistory(bot_id, bot_id, community_bot_history_storage, bot_history_storage);
        let bot: Bot = {
            title: title + " Kopie",
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: bot_id,
            temperature: temperature,
            max_output_tokens: max_output_tokens,
            version: botVersion,
            owner: owner,
            tags: tags
        }
        storeBot(bot);
        window.location.href = "/"
    };

    const actions = (
        <>
            <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
        </>
    );

    const sidebar = [
        <CommunityBotSettingsDrawer
            temperature={temperature}
            max_output_tokens={max_output_tokens}
            systemPrompt={systemPrompt}
            title={title}
            description={description}
            bot_id={bot_id}
            isOwner={false}
            toOwnBots={toOwnBots}
            actions={actions}
            version={String(botVersion)}
            allVersions={botAllVersions} />
    ];
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
                            message={answer[0]}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage_history}
                            lastQuestionRef={lastQuestionRef}
                            current_id={bot_id}
                            is_bot={true}
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
                                    answer={answer[1]}
                                    onRegenerateResponseClicked={onRegeneratResponseClicked}
                                    setQuestion={question => setQuestion(question)}
                                />
                            )}
                            {index !== answers.length - 1 && <Answer key={index} answer={answer[1]} setQuestion={question => setQuestion(question)} />}
                        </>
                    }
                ></ChatTurnComponent>
            ))}
            {isLoading || error ? (
                <ChatTurnComponent
                    usermsg={
                        <UserChatMessage
                            message={lastQuestionRef.current}
                            setAnswers={setAnswers}
                            setQuestion={setQuestion}
                            answers={answers}
                            storage={storage}
                            lastQuestionRef={lastQuestionRef}
                            current_id={bot_id}
                            is_bot={true}
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
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header=""
            messages_description={t("common.messages")} sidebar={sidebar} header_as_markdown={false} size={"large"}        ></ChatLayout>
    );
};

export default BotChat;
