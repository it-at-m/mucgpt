import { useRef, useState, useEffect, useContext } from "react";

import styles from "./Simply.module.css";

import { AskResponse, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { UserChatMessage } from "../../components/UserChatMessage";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { ExampleListSimply } from "../../components/Example/ExampleListSimply";
import { useTranslation } from 'react-i18next';
import { checkStructurOfDB, deleteChatFromDB, getHighestKeyInDB, getStartDataFromDB, indexedDBStorage, saveToDB } from "../../service/storage";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Radio, RadioGroup, RadioGroupOnChangeData, Tooltip } from "@fluentui/react-components";
import { Checkmark24Filled } from "@fluentui/react-icons";

const enum STORAGE_KEYS {
    SIMPLY_SYSTEM_PROMPT = 'SIMPLY_SYSTEM_PROMPT',
    SIMPLY_OUTPUT_TYPE = 'SIMPLY_OUTPUT_TYPE'
}

const Simply = () => {
    const { language } = useContext(LanguageContext)
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const outputType_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE) || "plain";
    const [outputType, setOutputType] = useState<string>(outputType_pref);

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
        error && setError(undefined);
        lastQuestionRef.current = question
        setIsLoading(true);
        try {
            const request: SimplyRequest = {
                topic: question,
                model: LLM.llm_name,
                temperature: 0,
                output_type: outputType
            };
            const parsedResponse: SimplyResponse = await simplyApi(request);
            const askResponse: AskResponse = { answer: parsedResponse.content, error: parsedResponse.error }
            setAnswers([...answers, [question, askResponse]]);
            saveToDB([question, askResponse], storage, currentId, idCounter, setCurrentId, setIdCounter, language)
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

    const onOutputTypeChanged = (e: any, selection: RadioGroupOnChangeData) => {
        setOutputType(selection.value as ("plain" | "easy"));
        localStorage.setItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE, selection.value);
    };

    return (
        <div className={styles.container}>
            <div>
                <Dialog modalType="alert" defaultOpen={true}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle >Hinweis zur Funktion "Leichte Sprache"</DialogTitle>
                            <DialogContent>
                                Vielen Dank für Ihr Interesse an unserer Funktion "Leichte Sprache". Wir möchten Sie darauf hinweisen, dass diese Funktion derzeit noch in einer Demo-Version verfügbar ist und noch nicht vollständig getestet wurde.<br />
                                <br />
                                Bitte beachten Sie, dass die aktuellen Ergebnisse möglicherweise nicht immer vollständig den Regeln der leichten/einfachen Sprache entsprechen. Wir arbeiten intensiv daran, die Funktion zu verbessern und zuverlässig zu machen.<br />
                                <br />
                                Ihr Feedback ist uns sehr wichtig. Wenn Sie Anmerkungen oder Verbesserungsvorschläge haben, lassen Sie es uns bitte wissen.<br />
                                <br />
                                Vielen Dank für Ihr Verständnis und Ihre Geduld.<br />
                                <br />
                                Ihr MUCGPT-Team
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" >
                                        <Checkmark24Filled className={styles.checkIcon} /> Verstanden</Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>
            <div className={styles.commandsContainer}>
                <ClearChatButton onClick={clearChat} disabled={!lastQuestionRef.current || isLoading} />

                <RadioGroup layout="vertical" onChange={onOutputTypeChanged} value={outputType}>
                    <Tooltip content={t('simply.plain_description')} relationship="description" positioning="below">
                        <Radio value="plain" label={t('simply.plain')} />
                    </Tooltip>
                    <Tooltip content={t('simply.easy_description')} relationship="description" positioning="below">
                        <Radio value="easy" label={t('simply.easy')} />
                    </Tooltip>
                </RadioGroup>
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
