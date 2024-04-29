import { useRef, useState, useEffect, useContext } from "react";

import styles from "./Summarize.module.css";

import { sumApi, SumRequest, SumResponse } from "../../api";
import { AnswerError, AnswerLoading } from "../../components/Answer";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { ExampleListSum } from "../../components/Example/ExampleListSum";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from 'react-i18next';
import { SumAnswer } from "../../components/SumAnswer";
import { SumInput } from "../../components/SumInput";
import { Field, Radio, RadioGroup, RadioGroupOnChangeData } from "@fluentui/react-components";

const STORAGE_KEY_LEVEL_OF_DETAIL = "SUM_LEVEL_OF_DETAIL"

const Summarize = () => {
    const { language } = useContext(LanguageContext)
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const detaillevel_pref = localStorage.getItem(STORAGE_KEY_LEVEL_OF_DETAIL) as "long" | "medium" | "short" || "short";


    const [detaillevel, setDetaillevel] = useState<"long" | "medium" | "short">(detaillevel_pref);

    const [answers, setAnswers] = useState<[user: string, response: SumResponse][]>([]);

    const save_summarize = async (a: any[]) => {
        let openRequest = indexedDB.open("MUCGPT-SUMMARIZE", 1);

        openRequest.onupgradeneeded = function () {
            // triggers if the client had no database
            let db = openRequest.result;
            if (!db.objectStoreNames.contains('summarize')) {
                db.createObjectStore('summarize', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = function () {
            let db = openRequest.result;
            let transaction = db.transaction("summarize", "readwrite");
            // get an object store to operate on it
            let books = transaction.objectStore("summarize");
            let request = books.put({ 'Answers': a, 'id': 1 });

            request.onerror = function () {
                console.log("Error", request.error);
            };
        };
    }

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        let openRequest = indexedDB.open("MUCGPT-SUMMARIZE", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            // triggers if the client had no database
            db = openRequest.result;
            if (!db.objectStoreNames.contains('summarize')) {
                db.createObjectStore('summarize', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            let old = db.transaction("summarize", "readwrite").objectStore("summarize").get(1);

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
        makeApiRequest(example, undefined);
        //lastQuestionRef.current = example;
        //error && setError(undefined);
        //setIsLoading(true);
        //const Response: SumResponse = {
        //    answer: ["ANSWER"]
        //}
        //setIsLoading(false);
        //setAnswers([...answers, [example, Response]])
        //save_summarize([example, Response])
    };


    const makeApiRequest = async (question: string, file?: File) => {
        let questionText = file ? file.name : question;
        lastQuestionRef.current = questionText;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: SumRequest = {
                text: questionText,
                detaillevel: detaillevel,
                overrides: {
                    language: language
                }
            };
            const result = await sumApi(request, file);
            setAnswers([...answers, [questionText, result]]);
            save_summarize([questionText, result])
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


        let openRequest = indexedDB.open("MUCGPT-SUMMARIZE", 1);
        let db;
        openRequest.onupgradeneeded = function () {
            db = openRequest.result;
            if (!db.objectStoreNames.contains('summarize')) {
                db.createObjectStore('summarize', { keyPath: 'id' });
            }
        };

        openRequest.onerror = function () {
            console.error("Error", openRequest.error);
        };

        openRequest.onsuccess = async function () {
            db = openRequest.result;
            db.transaction("summarize", "readwrite").objectStore("summarize").delete(1);
        }
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onDetaillevelChanged = (e: any, selection: RadioGroupOnChangeData) => {
        setDetaillevel(selection.value as ("long" | "medium" | "short"));
        localStorage.setItem(STORAGE_KEY_LEVEL_OF_DETAIL, selection.value);
    };
    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Field label={t('sum.levelofdetail')}>
                    <RadioGroup layout="horizontal" onChange={onDetaillevelChanged} value={detaillevel_pref}>
                        <Radio value="short" label={t('sum.short')} />
                        <Radio value="medium" label={t('sum.medium')} />
                        <Radio value="long" label={t('sum.long')} />
                    </RadioGroup>
                </Field>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <h2 className={styles.chatEmptyStateSubtitle}> {t('sum.header')}</h2>
                            <ExampleListSum onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <ul className={styles.chatMessageStream} aria-description={t("common.messages")}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <li aria-description={t('components.usericon.label') + " " + (index + 1).toString()}>
                                        <UserChatMessage message={answer[0]} />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()}>
                                        <SumAnswer answer={answer[1]} top_n={2}></SumAnswer>
                                    </li>
                                </div>
                            ))}
                            {isLoading && (
                                <>
                                    <li aria-description={t('components.usericon.label') + " " + answers.length.toString() + 1}>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                    </li>
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()}>
                                        <AnswerLoading text={t('sum.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
                                <><li aria-description={t('components.usericon.label') + " " + (answers.length + 1).toString()}>
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
                        <SumInput
                            clearOnSend
                            placeholder={t('sum.prompt')}
                            disabled={isLoading}
                            onSend={(question, file) => makeApiRequest(question, file)}
                            tokens_used={0}
                            token_limit_tracking={false}
                        />
                    </div>
                </div>
            </div>
        </div >
    );
};

export default Summarize;
