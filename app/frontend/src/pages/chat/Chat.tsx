import { useRef, useState, useEffect, useContext } from "react";
import readNDJSONStream from "ndjson-readablestream";

import styles from "./Chat.module.css";

import { chatApi, AskResponse, ChatRequest, ChatTurn, handleRedirect, Chunk, ChunkInfo } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from 'react-i18next';
import { ChatsettingsDrawer } from "../../components/ChatsettingsDrawer";


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

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const [answers, setAnswers] = useState<[user: string, response: AskResponse, user_tokens: number][]>([]);

    const temperature_pref = Number(localStorage.getItem(STORAGE_KEYS.CHAT_TEMPERATURE)) || 0.7;
    const max_tokens_pref = Number(localStorage.getItem(STORAGE_KEYS.CHAT_MAX_TOKENS)) || 4000;
    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS.CHAT_SYSTEM_PROMPT) || "";

    const [temperature, setTemperature] = useState(temperature_pref);
    const [max_tokens, setMaxTokens] = useState(max_tokens_pref);
    const [systemPrompt, setSystemPrompt] = useState<string>(systemPrompt_pref);

    const save_chat = async (a: any[]) => {
        let openRequest = indexedDB.open("MUCGPT-CHAT", 1);

        openRequest.onupgradeneeded = function () {
            let db = openRequest.result;
            if (!db.objectStoreNames.contains('chat')) {
                db.createObjectStore('chat', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = function () {
            let db = openRequest.result;
            let transaction = db.transaction("chat", "readwrite");
            let chat = transaction.objectStore("chat");
            let stored = chat.get(1)
            stored.onsuccess = () => {
                let request: IDBRequest;
                if (stored.result) {
                    stored.result.Answers.push(a)
                    request = chat.put({ 'Answers': stored.result.Answers, 'id': 1 });
                } else {
                    request = chat.put({ 'Answers': [a], 'id': 1 });
                }
                request.onerror = function () {
                    console.log("Error", request.error);
                };
            }
        };
    }

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        let openRequest = indexedDB.open("MUCGPT-CHAT", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            db = openRequest.result;
            if (!db.objectStoreNames.contains('chat')) {
                db.createObjectStore('chat', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            let old = db.transaction("chat", "readwrite").objectStore("chat").get(1);

            old.onsuccess = () => {
                if (old.result) {
                    setAnswers([...answers.concat(old.result.Answers)]);
                    lastQuestionRef.current = old.result.Answers[old.result.Answers.length - 1][0];
                }

            }

        }
        setIsLoading(false);
    }, [])

    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: ChatRequest = {
                history: [...history, { user: question, bot: undefined }],
                shouldStream: shouldStream,
                overrides: {
                    language: language,
                    temperature: temperature,
                    system_message: systemPrompt,
                    max_tokens: max_tokens
                }
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
                save_chat([question, latestResponse, user_tokens])
            } else {
                const parsedResponse: AskResponse = await response.json();
                if (response.status > 299 || !response.ok) {
                    throw Error(parsedResponse.error || "Unknown error");
                }
                setAnswers([...answers, [question, parsedResponse, 0]]);
                save_chat([question, parsedResponse, 0])
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
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setAnswers([]);

        let openRequest = indexedDB.open("MUCGPT-CHAT", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            db = openRequest.result;
            if (!db.objectStoreNames.contains('chat')) {
                db.createObjectStore('chat', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            db.transaction("chat", "readwrite").objectStore("chat").delete(1);
        }
    };

    const onRegeneratResponseClicked = () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            let openRequest = indexedDB.open("MUCGPT-CHAT", 1);
            openRequest.onupgradeneeded = function () {
                let db = openRequest.result;
                if (!db.objectStoreNames.contains('chat')) {
                    db.createObjectStore('chat', { keyPath: 'id' });
                }
            };
            openRequest.onerror = function () {
                console.error("Error", openRequest.error);
            };
            openRequest.onsuccess = function () {
                let db = openRequest.result;
                let transaction = db.transaction("chat", "readwrite");
                let chat = transaction.objectStore("chat");
                let stored = chat.get(1);
                stored.onsuccess = function () {
                    let deleted = chat.delete(1);
                    deleted.onsuccess = function () {
                        if (stored.result) {
                            stored.result.Answers.pop();
                            let put = chat.put({ 'Answers': stored.result.Answers, 'id': 1 });
                            put.onsuccess = function () {
                                if (last)
                                    makeApiRequest(last[0])
                            };
                            put.onerror = function () {
                                console.error("Error", put.error);
                            };
                        };
                    };
                    deleted.onerror = function () {
                        console.error("Error", deleted.error);
                    }
                };
                stored.onerror = function () {
                    console.error("Error", stored.error);
                };
            };
        };
    }

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const computeTokens = () => { return answers.map((answ) => answ[2] + (answ[1].tokens || 0)).reduceRight((prev, curr) => prev + curr, 0) }

    const onExampleClicked = async (example: string) => {
        makeApiRequest(example);
    };

    const onShowCitation = (citation: string, index: number) => {
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveCitation(citation);
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
        }
        setSelectedAnswer(index);
    };

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }
        setSelectedAnswer(index);
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
                                        <UserChatMessage message={answer[0]} />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()} >
                                        {index === answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                            onCitationClicked={c => onShowCitation(c, index)}
                                            onRegenerateResponseClicked={onRegeneratResponseClicked}
                                        />
                                        }
                                        {index !== answers.length - 1 && <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                            onCitationClicked={c => onShowCitation(c, index)}
                                        />
                                        }
                                    </li>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >
                                        <AnswerLoading text={t('chat.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()} >
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()} >
                                        <AnswerError error={error.toString()} onRetry={() => makeApiRequest(lastQuestionRef.current)} />
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
                            onSend={question => makeApiRequest(question)}
                            tokens_used={computeTokens()}
                        />
                    </div>
                </div>

                {answers.length > 0 && activeAnalysisPanelTab && (
                    <AnalysisPanel
                        className={styles.chatAnalysisPanel}
                        activeCitation={activeCitation}
                        onActiveTabChanged={x => onToggleTab(x, selectedAnswer)}
                        citationHeight="810px"
                        answer={answers[selectedAnswer][1]}
                        activeTab={activeAnalysisPanelTab}
                    />
                )}
            </div>
        </div>
    );
};

export default Chat;
