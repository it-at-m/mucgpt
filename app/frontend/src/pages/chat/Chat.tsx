import { useRef, useState, useEffect, useContext, useCallback } from "react";
import readNDJSONStream from "ndjson-readablestream";

import styles from "./Chat.module.css";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo, countTokensAPI } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from 'react-i18next';
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";
import { indexedDBStorage, saveToDB, getStartDataFromDB, clearDB, popLastInDB } from "../../service/storage"
import useDebounce from "../../hooks/debouncehook";


const enum STORAGE_KEYS {
    CHAT_TEMPERATURE = 'CHAT_TEMPERATURE',
    CHAT_SYSTEM_PROMPT = 'CHAT_SYSTEM_PROMPT',
    CHAT_MAX_TOKENS = 'CHAT_MAX_TOKENS',
}

const Chat = () => {
    const { language } = useContext(LanguageContext)
    const { t } = useTranslation();
    const [shouldStream, setShouldStream] = useState<boolean>(true);

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const [answers, setAnswers] = useState<[user: string, response: AskResponse, user_tokens: number][]>([]);
    const [question, setQuestion] = useState<string>("");

    const temperature_pref = Number(localStorage.getItem(STORAGE_KEYS.CHAT_TEMPERATURE)) || 0.7;
    const max_tokens_pref = Number(localStorage.getItem(STORAGE_KEYS.CHAT_MAX_TOKENS)) || 4000;
    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS.CHAT_SYSTEM_PROMPT) || "";

    const [temperature, setTemperature] = useState(temperature_pref);
    const [max_tokens, setMaxTokens] = useState(max_tokens_pref);
    const [systemPrompt, setSystemPrompt] = useState<string>(systemPrompt_pref);

    const storage: indexedDBStorage = { db_name: "MUCGPT-CHAT", objectStore_name: "chat" }
    const debouncedSystemPrompt = useDebounce(systemPrompt, 1000);
    const [systemPromptTokens, setSystemPromptTokens] = useState<number>(0);

    const makeTokenCountRequest = useCallback(async () => {
        if (debouncedSystemPrompt && debouncedSystemPrompt !== "") {
            const response = await countTokensAPI({ "text": debouncedSystemPrompt });
            setSystemPromptTokens(response.count);
        }
        else
            setSystemPromptTokens(0);
    }, [debouncedSystemPrompt]);

    useEffect(() => {
        makeTokenCountRequest();
    }, [debouncedSystemPrompt, makeTokenCountRequest]);

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        getStartDataFromDB(storage).then((stored) => {
            if (stored) {
                setAnswers([...answers.concat(stored)]);
                lastQuestionRef.current = stored[stored.length - 1][0];
            }
        });
        setIsLoading(false);
    }, [])

    const makeApiRequest = async (question: string, system?: string) => {
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: shouldStream,
                language: language,
                temperature: temperature,
                system_message: system ? system : "",
                max_tokens: max_tokens
            };

            const response = await chatApi(request);
            handleRedirect(response);

            if (!response.body) {
                throw Error("No response body");
            }
            let user_tokens = 0;
            if (shouldStream) {
                let askResponse: AskResponse = {} as AskResponse;
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
                saveToDB([question, latestResponse, user_tokens], storage)
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
                saveToDB([question, parsedResponse, 0], storage)
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
        setAnswers([]);
        clearDB(storage);
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            popLastInDB(storage);
            if (last)
                makeApiRequest(last[0], systemPrompt)

        };
    }

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens = answers.map((answ) => answ[2] + systemPromptTokens + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);

    const onExampleClicked = async (example: string, system?: string) => {
        if (system)
            onSystemPromptChanged(system);
        makeApiRequest(example, system);
    };


    const onTemperatureChanged = (temp: number) => {
        setTemperature(temp);
        localStorage.setItem(STORAGE_KEYS.CHAT_TEMPERATURE, temp.toString())
    };

    const onMaxTokensChanged = (maxTokens: number) => {
        setMaxTokens(maxTokens);
        localStorage.setItem(STORAGE_KEYS.CHAT_MAX_TOKENS, maxTokens.toString())
    };

    const onSystemPromptChanged = (systemPrompt: string) => {
        setSystemPrompt(systemPrompt);
        localStorage.setItem(STORAGE_KEYS.CHAT_SYSTEM_PROMPT, systemPrompt)
    };


    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                <ChatsettingsDrawer
                    temperature={temperature}
                    setTemperature={onTemperatureChanged}
                    max_tokens={max_tokens}
                    setMaxTokens={onMaxTokensChanged}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={onSystemPromptChanged}
                ></ChatsettingsDrawer>
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState} tabIndex={0}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{t('chat.header')}</h2>
                            <ExampleList onExampleClicked={onExampleClicked} />
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
                                        />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()} >
                                        {index === answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index}
                                            onRegenerateResponseClicked={onRegeneratResponseClicked}
                                            setQuestion={question => setQuestion(question)}
                                        />
                                        }
                                        {index !== answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index}
                                            setQuestion={question => setQuestion(question)}
                                        />
                                        }
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
        </div>
    );
};

export default Chat;

