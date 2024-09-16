import { useRef, useState, useEffect, useContext } from "react";

import styles from "./Simply.module.css";

import { AskResponse, simplyApi, SimplyRequest } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from 'react-i18next';
import { checkStructurOfDB, deleteChatFromDB, getHighestKeyInDB, getStartDataFromDB, indexedDBStorage, popLastMessageInDB, saveToDB } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";

const enum STORAGE_KEYS {
    SIMPLY_SYSTEM_PROMPT = 'SIMPLY_SYSTEM_PROMPT',
}

const Simply = () => {
    const { language } = useContext(LanguageContext)
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_SYSTEM_PROMPT) || "";
    const [systemPrompt, setSystemPrompt] = useState<string>(systemPrompt_pref);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);
    const [question, setQuestion] = useState<string>("");

    const storage: indexedDBStorage = { db_name: "MUCGPT-SIMPLY", objectStore_name: "simply", db_version: 2 }

    const [currentId, setCurrentId] = useState<number>(0);
    const [idCounter, setIdCounter] = useState<number>(0);

    useEffect(() => {
        error && setError(undefined);
        setIsLoading(true);
        checkStructurOfDB(storage);
        getHighestKeyInDB(storage).then((highestKey) => {
            setIdCounter(highestKey + 1)
            setCurrentId(highestKey)
        })
        getStartDataFromDB(storage, currentId).then((stored) => {
            if (stored) {
                setAnswers([...answers.concat(stored.Data.Answers)]);
                lastQuestionRef.current = stored.Data.Answers[stored.Data.Answers.length - 1][0];
            }
        });
        setIsLoading(false);
    }, [])


    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };


    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const request: SimplyRequest = {
                topic: question,
                language: language,
                model: LLM.model_name,
                max_output_tokens: LLM.max_output_tokens,
                history: [],
                shouldStream: true,
                system_message: systemPrompt
            };
            const result = await simplyApi(request);
            setAnswers([...answers, [question, result]]);
            saveToDB([question, result], storage, currentId, idCounter, setCurrentId, setIdCounter,);
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
        deleteChatFromDB(storage, currentId, setAnswers, true, lastQuestionRef);
    };

    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    const onRegeneratResponseClicked = async () => {
        if (answers.length > 0) {
            let last = answers.pop();
            setAnswers(answers);
            popLastMessageInDB(storage, currentId);
            if (last) {
                makeApiRequest(last[0])
            }
        };
    }

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <ClearChatButton className={styles.commandButton} onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />
            </div>
            <div className={styles.chatRoot}>
                <div className={styles.chatContainer}>
                    {!lastQuestionRef.current ? (
                        <div className={styles.chatEmptyState}>
                            <h2 className={styles.chatEmptyStateSubtitle}>{t('simply.header')}</h2>
                            <ExampleListSimply onExampleClicked={onExampleClicked} />
                        </div>
                    ) : (
                        <ul className={styles.chatMessageStream}>
                            {answers.map((answer, index) => (
                                <div key={index}>
                                    <li aria-description={t('components.usericon.label') + " " + (index + 1).toString()}>
                                        <UserChatMessage message={answer[0]}
                                            setAnswers={setAnswers}
                                            setQuestion={setQuestion}
                                            answers={answers}
                                            storage={storage}
                                            lastQuestionRef={lastQuestionRef}
                                            current_id={currentId}
                                        />
                                    </li>
                                    <li className={styles.chatMessageGpt} aria-description={t('components.answericon.label') + " " + (index + 1).toString()}>
                                        <Answer
                                            key={index}
                                            answer={answer[1]}
                                            isSelected={selectedAnswer === index}
                                            onRegenerateResponseClicked={onRegeneratResponseClicked}
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
                                    <li className={styles.chatMessageGptMinWidth} aria-description={t('components.answericon.label') + " " + (answers.length + 1).toString()}>
                                        <AnswerLoading text={t('simply.answer_loading')} />
                                    </li>
                                </>
                            )}
                            {error ? (
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
                            placeholder={t('simply.prompt')}
                            disabled={isLoading}
                            onSend={question => makeApiRequest(question)}
                            tokens_used={0}
                            question={question}
                            setQuestion={question => setQuestion(question)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Simply;
