import { useRef, useState, useEffect, useContext } from "react";

import styles from "./Simply.module.css";

import { AskResponse, ChatTurn, handleRedirect, simplyApi, SimplyRequest, SimplyResponse } from "../../api";
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

const SYSTEM_MESSAGE_ES = "Du bist ein hilfreicher Assistent, der Texte in Einfache Sprache, Sprachniveau B1 bis A2, umschreibt. Sei immer wahrheitsgemäß und objektiv. Schreibe nur das, was du sicher aus dem Text des Benutzers weisst. Arbeite die Texte immer vollständig durch und kürze nicht. Mache keine Annahmen. Schreibe einfach und klar und immer in deutscher Sprache. Gib dein Ergebnis innerhalb von <einfachesprache> Tags aus."


const RULES_ES = `- Schreibe kurze Sätze mit höchstens 12 Wörtern.
- Beschränke dich auf eine Aussage, einen Gedanken pro Satz.
- Verwende aktive Sprache anstelle von Passiv. 
- Formuliere grundsätzlich positiv und bejahend.
- Strukturiere den Text übersichtlich mit kurzen Absätzen.
- Verwende einfache, kurze, häufig gebräuchliche Wörter. 
- Wenn zwei Wörter dasselbe bedeuten, verwende das kürzere und einfachere Wort.
- Vermeide Füllwörter und unnötige Wiederholungen.
- Erkläre Fachbegriffe und Fremdwörter.
- Schreibe immer einfach, direkt und klar.Vermeide komplizierte Konstruktionen und veraltete Begriffe.Vermeide «Behördendeutsch».
- Benenne Gleiches immer gleich.Verwende für denselben Begriff, Gegenstand oder Sachverhalt immer dieselbe Bezeichnung.Wiederholungen von Begriffen sind in Texten in Einfacher Sprache normal.
- Vermeide Substantivierungen.Verwende stattdessen Verben und Adjektive.
- Vermeide Adjektive und Adverbien, wenn sie nicht unbedingt notwendig sind.
- Wenn du vier oder mehr Wörter zusammensetzt, setzt du Bindestriche.Beispiel: «Motorfahrzeug - Ausweispflicht».
- Achte auf die sprachliche Gleichbehandlung von Mann und Frau.Verwende immer beide Geschlechter oder schreibe geschlechtsneutral.
- Vermeide Abkürzungen grundsätzlich.Schreibe stattdessen die Wörter aus.Z.B. «10 Millionen» statt «10 Mio.», «200 Kilometer pro Stunde» statt «200 km / h», «zum Beispiel» statt «z.B.», «30 Prozent» statt «30 %», «2 Meter» statt «2 m», «das heisst» statt «d.h.».
- Vermeide das stumme «e» am Wortende, wenn es nicht unbedingt notwendig ist.Zum Beispiel: «des Fahrzeugs» statt «des Fahrzeuges».
- Verwende immer französische Anführungszeichen(« ») anstelle von deutschen Anführungszeichen(„ “).
- Gliedere Telefonnummern mit vier Leerzeichen.Z.B. 044 123 45 67. Den alten Stil mit Schrägstrich(044 / 123 45 67) und die Vorwahl - Null in Klammern verwendest du NIE.
- Formatiere Datumsangaben immer so: 1. Januar 2022, 15. Februar 2022.
- Jahreszahlen schreibst du immer vierstellig aus: 2022, 2025 - 2030.
- Formatiere Zeitangaben immer «Stunden Punkt Minuten Uhr». Verwende keinen Doppelpunkt, um Stunden von Minuten zu trennen.Ergänze immer .00 bei vollen Stunden.Beispiele: 9.25 Uhr(NICHT 9: 30), 10.30 Uhr(NICHT 10:00), 14.00 Uhr(NICHT 14 Uhr), 15.45 Uhr, 18.00 Uhr, 20.15 Uhr, 22.30 Uhr.
- Zahlen bis 12 schreibst du aus.Ab 13 verwendest du Ziffern.
- Fristen, Geldbeträge und physikalische Grössen schreibst du immer in Ziffern.
- Zahlen, die zusammengehören, schreibst du immer in Ziffern.Beispiel: 5 - 10, 20 oder 30.
- Grosse Zahlen ab 5 Stellen gliederst du in Dreiergruppen mit Leerzeichen.Beispiel: 1 000 000.
- Achtung: Identifikationszahlen übernimmst du 1: 1. Beispiel: Stammnummer 123.456.789, AHV - Nummer 756.1234.5678.90, Konto 01 - 100101 - 9.
- Verwende das Komma, dass das deutsche Dezimalzeichen ist.Überflüssige Nullen nach dem Komma schreibst du nicht.Beispiel: 5, 5 Millionen, 3, 75 Prozent, 1, 5 Kilometer, 2, 25 Stunden.
- Vor Franken - Rappen - Beträgen schreibst du immer «CHF». Nur nach ganzen Franken - Beträgen darfst du «Franken» schreiben.Bei Franken - Rappen - Beträgen setzt du einen Punkt als Dezimalzeichen.Anstatt des Null - Rappen - Strichs verwendest du «.00» oder lässt die Dezimalstellen weg.Z.B. 20 Franken, CHF 20, CHF 2.00, CHF 12.50, aber CHF 45, 2 Millionen, EUR 14, 90.
- Die Anrede mit «Sie» schreibst du immer gross.Beispiel: «Sie haben».`

const REWRITE_COMPLETE = "- Achte immer sehr genau darauf, dass ALLE Informationen aus dem schwer verständlichen Text in dem Text in Leichter Sprache enthalten sind. Kürze niemals Informationen. Wo sinnvoll kannst du zusätzliche Beispiele hinzufügen, um den Text verständlicher zu machen und relevante Inhalte zu konkretisieren."


const REWRITE_CONDENSED = "- Konzentriere dich auf das Wichtigste. Gib die essenziellen Informationen wieder und lass den Rest weg. Wichtig sind zusätzliche Beispiele. Damit konkretisierst du relevante Inhalte und machst sie dadurch verständlicher."


const Simply = () => {
    const { language } = useContext(LanguageContext)
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);

    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_SYSTEM_PROMPT) || SYSTEM_MESSAGE_ES;
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

    const buildMessage = (prompt: string, completeness: string, rules: string) => {
        return `Bitte schreibe den folgenden schwer verständlichen Text vollständig in Einfache Sprache, Sprachniveau B1 bis A2, um. 

        Beachte dabei folgende Regeln für Einfache Sprache (B1 bis A2):

        ${completeness}
        ${rules}

        Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags.

        Hier ist der schwer verständliche Text:

        --------------------------------------------------------------------------------

        ${prompt}
        `
    }
    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };
    function extractText(response: string, leichteSprache: boolean): string {
        let result: RegExpMatchArray | null;

        if (leichteSprache) {
            result = response.match(/<leichtesprache>(.*?)<\/leichtesprache>/gs);
        } else {
            result = response.match(/<einfachesprache>(.*?)<\/einfachesprache>/gs);
        }

        return result ? result.map(item => item.replace(/<\/?[^>]+(>|$)/g, "")).join("\n").trim() : '';
    }


    const makeApiRequest = async (question: string) => {
        lastQuestionRef.current = question;

        error && setError(undefined);
        setIsLoading(true);
        try {
            const history: ChatTurn[] = answers.map(a => ({ user: a[0], bot: a[1].answer }));
            const request: SimplyRequest = {
                topic: question,
                language: language,
                model: LLM.llm_name,
                max_output_tokens: LLM.max_output_tokens,
                history: [...history, { user: buildMessage(question, REWRITE_COMPLETE, RULES_ES), bot: undefined }],
                shouldStream: true,
                system_message: systemPrompt
            };
            const parsedResponse: SimplyResponse = await simplyApi(request);
            const askResponse: AskResponse = { answer: extractText(parsedResponse.content, false), error: parsedResponse.error }
            setAnswers([...answers, [question, askResponse]]);
            saveToDB([question, parsedResponse], storage, currentId, idCounter, setCurrentId, setIdCounter, language)
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
