import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, Bot, ChatResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";

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
import { StorageService } from "../../service/storage";

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
    const storageService: StorageService<ChatResponse, Bot> = new StorageService<ChatResponse, Bot>(BOT_STORE);

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
            storageService.get(bot_id).then(bot => {
                if (bot) {
                    setSystemPrompt(bot.config.system_message);
                    setTitle(bot.config.title);
                    setDescription(bot.config.description);
                    setPublish(bot.config.publish);
                    setTemperature(bot.config.temperature);
                    setMaxOutputTokens(bot.config.max_output_tokens);

                    const messages = bot.messages;
                    lastQuestionRef.current = messages.length > 0 ? messages[messages.length - 1].user : "";
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
                }
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
            if (bot_id) {
                { //pop previous dummy result and replace with a new one
                    await storageService.popMessage(bot_id);
                    await storageService.appendMessage(bot_id, { user: question, response: latestResponse });
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
        if (bot_id)
            storageService.delete(bot_id);
        setAnswers([]);
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
        storageService.update(bot_id, undefined, newBot);
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
            storageService.update(bot_id, undefined, newBot);
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
        storageService.update(bot_id, undefined, newBot);
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
        storageService.update(bot_id, undefined, newBot);
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
        storageService.update(bot_id, undefined, newBot);
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
        storageService.update(bot_id, undefined, newBot);
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0 && bot_id) {
            let last = answers.pop();
            setAnswers(answers);
            storageService.popMessage(bot_id);
            if (last) {
                makeApiRequest(last.user, systemPrompt);
            }
        }
    };

    const onRollbackMessage = (message: string) => {
        return async () => {
            if (bot_id) {
                let result = await storageService.rollbackMessage(bot_id, message);
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

    const sidebar = [
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
        ></BotsettingsDrawer>
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
