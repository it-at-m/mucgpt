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
import { indexedDBStorage, saveToDB, getStartDataFromDB, popLastMessageInDB, getHighestKeyInDB, deleteChatFromDB, getCurrentChatID, changeTemperatureInDb, changeMaxTokensInDb, changeSystempromptInDb, CURRENT_CHAT_IN_DB, checkStructurOfDB } from "../../service/storage"
import { History } from "../../components/History/History";
import useDebounce from "../../hooks/debouncehook";
import { MessageError } from "./MessageError";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";

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

    const storage: indexedDBStorage = {
        db_name: "MUCGPT-CHAT", objectStore_name: "chat", db_version: 2
    }
    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);

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
        checkStructurOfDB(storage);
        setAnswers([]);
        lastQuestionRef.current = "";
        getHighestKeyInDB(storage).then((highestKey) => {
            getCurrentChatID(storage).then((refID) => {
                error && setError(undefined);
                setIsLoading(true);
                let key;
                if (refID) {
                    key = refID
                } else {
                    key = highestKey + 1
                }
                setIdCounter(key)
                setCurrentId(key)
                getStartDataFromDB(storage, key).then((stored) => {
                    if (stored) {// if the chat exists
                        let storedAnswers = stored.Data.Answers;
                        lastQuestionRef.current = storedAnswers[storedAnswers.length - 1][0];
                        if (storedAnswers[storedAnswers.length - 1][1].answer == "") {// if the answer of the LLM has not (yet) returned
                            if (storedAnswers.length > 1) {
                                storedAnswers.pop();
                                setAnswers([...answers.concat(storedAnswers)]);
                            }
                            setError(new MessageError(t('components.history.error')))
                        } else {
                            let options = stored.Options
                            setAnswers([...answers.concat(storedAnswers)]);
                            if (options) {
                                onMaxTokensChanged(options.maxTokens, key);
                                onTemperatureChanged(options.temperature, key);
                                onSystemPromptChanged(options.system, key)
                            }
                        }
                    }
                });
                setIsLoading(false);
            })
        })
    }, [])

    const makeApiRequest = async (question: string, system?: string) => {
        const startId = currentId
        lastQuestionRef.current = question;
        error && setError(undefined);
        setIsLoading(true);
        let askResponse: AskResponse = {} as AskResponse;
        saveToDB([question, { ...askResponse, answer: "", tokens: 0 }, 0], storage, startId, idCounter, setCurrentId, setIdCounter, language, temperature, system ? system : "", max_tokens)
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
                if (startId == currentId) {
                    saveToDB([question, latestResponse, user_tokens], storage, startId, idCounter, setCurrentId, setIdCounter, language, temperature, system ? system : "", max_tokens)
                }
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
                if (startId == currentId) {
                    saveToDB([question, parsedResponse, 0], storage, currentId, idCounter, setCurrentId, setIdCounter, language, temperature, system ? system : "", max_tokens)
                }
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
        deleteChatFromDB(storage, CURRENT_CHAT_IN_DB, setAnswers, true, lastQuestionRef)
    };

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            popLastMessageInDB(storage, currentId);
            if (last) {
                makeApiRequest(last[0], systemPrompt)
            }
        };
    }

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const totalTokens = systemPromptTokens + answers.map((answ) => answ[2] + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0);

    const onExampleClicked = async (example: string, system?: string) => {
        if (system)
            onSystemPromptChanged(system, currentId);
        makeApiRequest(example, system);
    };


    const onTemperatureChanged = (temp: number, id: number) => {
        setTemperature(temp);
        localStorage.setItem(STORAGE_KEYS.CHAT_TEMPERATURE, temp.toString());
        changeTemperatureInDb(temp, id, storage);
    };

    const onMaxTokensChanged = (maxTokens: number, id: number) => {
        setMaxTokens(maxTokens);
        localStorage.setItem(STORAGE_KEYS.CHAT_MAX_TOKENS, maxTokens.toString());
        changeMaxTokensInDb(maxTokens, id, storage);
    };

    const onSystemPromptChanged = (systemPrompt: string, id: number) => {
        setSystemPrompt(systemPrompt);
        localStorage.setItem(STORAGE_KEYS.CHAT_SYSTEM_PROMPT, systemPrompt);
        changeSystempromptInDb(systemPrompt, id, storage);
    };


    return (
        <div className={styles.container}>
            <History
                storage={storage}
                setAnswers={setAnswers}
                lastQuestionRef={lastQuestionRef}
                currentId={currentId}
                setCurrentId={setCurrentId}
                onTemperatureChanged={onTemperatureChanged}
                onMaxTokensChanged={onMaxTokensChanged}
                onSystemPromptChanged={onSystemPromptChanged}
                setError={setError}
            ></History>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
                <ChatsettingsDrawer
                    temperature={temperature}
                    setTemperature={onTemperatureChanged}
                    max_tokens={max_tokens}
                    setMaxTokens={onMaxTokensChanged}
                    systemPrompt={systemPrompt}
                    setSystemPrompt={onSystemPromptChanged}
                    current_id={currentId}
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
                                            current_id={currentId}
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
        </div>
    );
};

export default Chat;

