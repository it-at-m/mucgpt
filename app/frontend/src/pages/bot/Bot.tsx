import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import styles from "./Bot.module.css";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI, Bot } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from 'react-i18next';
import { bot_storage, getBotWithId, storeBot } from "../../service/storage"

import useDebounce from "../../hooks/debouncehook";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { useParams } from "react-router-dom";
import { BotsettingsDrawer } from "../../components/BotsettingsDrawer/BotsettingsDrawer";

const enum STORAGE_KEYS {
    CHAT_TEMPERATURE = 'CHAT_TEMPERATURE',
    CHAT_SYSTEM_PROMPT = 'CHAT_SYSTEM_PROMPT',
    CHAT_MAX_TOKENS = 'CHAT_MAX_TOKENS',
}

const BotChat = () => {
    const { id } = useParams();
    const { language } = useContext(LanguageContext)
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();
    const [shouldStream, setShouldStream] = useState<boolean>(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const [answers, setAnswers] = useState<[user: string, response: AskResponse, user_tokens: number][]>([]);
    const [question, setQuestion] = useState<string>("");

    const [temperature, setTemperature] = useState(0.7);
    const [max_output_tokens, setMaxOutputTokens] = useState(LLM.max_output_tokens);
    const [systemPrompt, setSystemPrompt] = useState<string>("");

    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);
    const [title, setTitle] = useState<string>("Titel");
    const [description, setDescription] = useState<string>("Beschreibung");
    const [publish, setPublish] = useState<boolean>(false);

    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);
    const storage = bot_storage;
    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ "text": debouncedSystemPrompt, "model": LLM });
            setSystemPromptTokens(response.count);
        }
        else
            setSystemPromptTokens(0);
    }, [debouncedSystemPrompt, LLM]);
    useEffect(() => {
        if (id) {
            getBotWithId(+id).then((bot) => {
                if (bot) {
                    setSystemPrompt(bot.system_message);
                    setTitle(bot.title);
                    setDescription(bot.description);
                    setPublish(bot.publish);
                    setTemperature(bot.temperature);
                    setMaxOutputTokens(bot.max_output_tokens);
                }
            }
            )
        }
    }, []);

    useEffect(() => {
        console.log(title, description)
    }, [title, description, systemPrompt]);

    useEffect(() => {
        makeTokenCountRequest();
        if (max_output_tokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens)
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

                let answer: string = '';
                let streamed_tokens = 0;
                let latestResponse: AskResponse = { ...askResponse, answer: answer, tokens: streamed_tokens }

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
                                throw Error(chunk.message as (string) || "Unknown error");
                        }

                        latestResponse = { ...askResponse, answer: answer, tokens: streamed_tokens };
                        setIsLoading(false);
                        setAnswers([...answers, [question, latestResponse, user_tokens]]);
                    }
                }
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
            }
        } catch (e) {
            setError(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setCurrentId(idCounter + 1)
        lastQuestionRef.current = "";
        error && setError(undefined);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens = systemPromptTokens + answers.map((answ) => answ[2] + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);


    const onTemperatureChanged = (temp: number) => {
        setTemperature(temp);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: +(id || "0"),
            temperature: temp,
            max_output_tokens: max_output_tokens,
        }
        storeBot(newBot)
    };

    const onMaxTokensChanged = (maxTokens: number) => {
        if (maxTokens > LLM.max_output_tokens && LLM.max_output_tokens != 0) {
            onMaxTokensChanged(LLM.max_output_tokens)
        }
        else {
            setMaxOutputTokens(maxTokens);
            let newBot: Bot = {
                title: title,
                description: description,
                system_message: systemPrompt,
                publish: publish,
                id: +(id || "0"),
                temperature: temperature,
                max_output_tokens: maxTokens,
            }
            storeBot(newBot)
        }

    };

    const onSystemPromptChanged = (systemPrompt: string) => {
        setSystemPrompt(systemPrompt);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: +(id || "0"),
            temperature: temperature,
            max_output_tokens: max_output_tokens,
        }
        storeBot(newBot)
    };

    const onPublishChanged = (publish: boolean) => {
        setPublish(publish);
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: +(id || "0"),
            temperature: temperature,
            max_output_tokens: max_output_tokens,
        }
        storeBot(newBot);
    };

    const onTitleChanged = (title: string) => {
        setTitle(title)
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: +(id || "0"),
            temperature: temperature,
            max_output_tokens: max_output_tokens,
        }
        storeBot(newBot)
    };

    const onDescriptionChanged = (description: string) => {
        setDescription(description)
        let newBot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: publish,
            id: +(id || "0"),
            temperature: temperature,
            max_output_tokens: max_output_tokens,
        }
        storeBot(newBot)
    };


    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
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
                    bot_id={id}
                    setPublish={onPublishChanged}
                ></BotsettingsDrawer>
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{title}</h2>
                            <h3 className={styles.chatEmptyStateSubtitle}>{description}</h3>
                        </div>
                    ) : (
                        <ul className={styles.chatMessageStream} aria-description={t("common.messages")}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <li aria-description={t('components.usericon.label') + " " + (index + 1).toString()} >
                                        <UserChatMessage message={answer[0]}
                                            setAnswers={setAnswers}
                                            setQuestion={setQuestion}
                                            answers={answers}
                                            storage={storage}
                                            lastQuestionRef={lastQuestionRef}
                                            current_id={currentId}
                                        />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()} >
                                        <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index}
                                            setQuestion={question => setQuestion(question)}
                                        />
                                    </li>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
                                        <UserChatMessage message={lastQuestionRef.current}
                                            setAnswers={setAnswers}
                                            setQuestion={setQuestion}
                                            answers={answers}
                                            storage={storage}
                                            lastQuestionRef={lastQuestionRef}
                                            current_id={currentId}
                                        />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >
                                        <AnswerLoading text={t('chat.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()} >
                                        <UserChatMessage message={lastQuestionRef.current}
                                            setAnswers={setAnswers}
                                            setQuestion={setQuestion}
                                            answers={answers}
                                            storage={storage}
                                            lastQuestionRef={lastQuestionRef}
                                            current_id={currentId}
                                        />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current, systemPrompt)} />
                                    </li>
                                </>
                            ) : null}
                            <div ref={chatMessageStreamEnd} />
                        </ul>
                    )}
                    <div className={styles.chatInput}>
                        <QuestionInput
                            clearOnSend
                            placeholder={t('chat.prompt')}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question, systemPrompt)}
                            tokens_used={totalTokens}
                            question={question}
                            setQuestion={question => setQuestion(question)}
                        />
                    </div>
                </div>
            </div>
        </div >
    );
};

export default BotChat;
