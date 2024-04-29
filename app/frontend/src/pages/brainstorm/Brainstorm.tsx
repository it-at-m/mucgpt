import { useRef, useState, useEffect, useContext } from "react";

import styles from "./Brainstorm.module.css";

import { AskResponse, brainstormApi, BrainstormRequest } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListBrainstorm } from "../../components/Example/ExampleListBrainstorm";
import { Mindmap } from "../../components/Mindmap";
import { useTranslation } from 'react-i18next';

const Summarize = () => {
    const { language } = useContext(LanguageContext)
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const save_brainstorming = async (a: any[]) => {
        let openRequest = indexedDB.open("MUCGPT-BRAINSTORMING", 1);

        openRequest.onupgradeneeded = function () {
            // triggers if the client had no database
            let db = openRequest.result;
            if (!db.objectStoreNames.contains('brainstorming')) {
                db.createObjectStore('brainstorming', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = function () {
            let db = openRequest.result;
            let transaction = db.transaction("brainstorming", "readwrite");
            // get an object store to operate on it
            let books = transaction.objectStore("brainstorming");
            let request = books.put({ 'Answers': a, 'id': 1 });

            request.onerror = function () {
                console.log("Error", request.error);
            };
        };
    }

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        let openRequest = indexedDB.open("MUCGPT-BRAINSTORMING", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            // triggers if the client had no database
            db = openRequest.result;
            if (!db.objectStoreNames.contains('brainstorming')) {
                db.createObjectStore('brainstorming', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            let old = db.transaction("brainstorming", "readwrite").objectStore("brainstorming").get(1);

            old.onsuccess = () => {
                if (old.result) {
                    setAnswers(old.result.Answers)
                    setAnswers([...answers, old.result.Answers]);
                    lastQuestionRef.current = old.result.Answers[0];
                }

            }

        }
        setIsLoading(false);
    }, [])


    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
        //lastQuestionRef.current = example;
        //error && setError(undefined);
        //setIsLoading(true);

        //const Response: AskResponse = {
        //    answer: "ANSWER"
        //}
        //setIsLoading(false);
        //setAnswers([...answers, [example, Response]])
        //save_brainstorming([example, Response])
    };


    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: BrainstormRequest = {
                topic: question,
                overrides: {
                    language: language,
                }
            };
            const result = await brainstormApi(request);
            setAnswers([...answers, [question, result]]);
            save_brainstorming([question, result]);
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

        let openRequest = indexedDB.open("MUCGPT-BRAINSTORMING", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            db = openRequest.result;
            if (!db.objectStoreNames.contains('brainstorming')) {
                db.createObjectStore('brainstorming', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            db.transaction("brainstorming", "readwrite").objectStore("brainstorming").delete(1);
        }
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);


    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{t('brainstorm.header')}</h2>
                            <ExampleListBrainstorm onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <ul className={styles.chatMessageStream}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <li aria-description={t('components.usericon.label') + " " + (index + 1).toString()}>
                                        <UserChatMessage message={answer[0]} />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()}>
                                        <Mindmap markdown={answer[1].answer}></Mindmap>
                                    </li>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()}>
                                        <AnswerLoading text={t('brainstorm.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()}>
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
                            placeholder={t('brainstorm.prompt')}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                            tokens_used={0}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Summarize;
