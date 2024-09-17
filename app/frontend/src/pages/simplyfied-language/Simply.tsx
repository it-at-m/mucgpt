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
import { Field, Radio, RadioGroup, RadioGroupOnChangeData } from "@fluentui/react-components";

const enum STORAGE_KEYS {
    SIMPLY_SYSTEM_PROMPT = 'SIMPLY_SYSTEM_PROMPT',
    SIMPLY_OUTPUT_TYPE = 'SIMPLY_OUTPUT_TYPE',
    SIMPLY_OUTPUT_LENGTH = 'SIMPLY_OUTPUT_LENGTH'
}

const SYSTEM_MESSAGE_ES = "Du bist ein hilfreicher Assistent, der Texte in Einfache Sprache, Sprachniveau B1 bis A2, umschreibt. Sei immer wahrheitsgemäß und objektiv. Schreibe nur das, was du sicher aus dem Text des Benutzers weisst. Arbeite die Texte immer vollständig durch und kürze nicht. Mache keine Annahmen. Schreibe einfach und klar und immer in deutscher Sprache. Gib dein Ergebnis innerhalb von <einfachesprache> Tags aus."
const SYSTEM_MESSAGE_LS = "Du bist ein hilfreicher Assistent, der Texte in Leichte Sprache, Sprachniveau A2, umschreibt. Sei immer wahrheitsgemäß und objektiv. Schreibe nur das, was du sicher aus dem Text des Benutzers weisst. Arbeite die Texte immer vollständig durch und kürze nicht. Mache keine Annahmen. Schreibe einfach und klar und immer in deutscher Sprache. Gib dein Ergebnis innerhalb von <leichtesprache> Tags aus."

const RULES_LS = `- Wichtiges zuerst: Beginne den Text mit den wichtigsten Informationen, so dass diese sofort klar werden.
- Verwende einfache, kurze, häufig gebräuchliche Wörter. 
- Löse zusammengesetzte Wörter auf und formuliere sie neu. Wenn es wichtige Gründe gibt, das Wort nicht aufzulösen, trenne das zusammengesetzte Wort mit einem Bindestrich.
- Vermeide Fremdwörter. Wähle stattdessen einfache, allgemein bekannte Wörter. Erkläre Fremdwörter, wenn sie unvermeidbar sind. 
- Vermeide Fachbegriffe. Wähle stattdessen einfache, allgemein bekannte Wörter. Erkläre Fachbegriffe, wenn sie unvermeidbar sind.
- Vermeide bildliche Sprache. Verwende keine Metaphern oder Redewendungen. Schreibe stattdessen klar und direkt.
- Schreibe kurze Sätze mit optimal 8 und höchstens 12 Wörtern.
- Du darfst Relativsätze mit «der», «die», «das» verwenden. 
- Löse Nebensätze nach folgenden Regeln auf: 
    - Kausalsätze (weil, da): Löse Kausalsätze als zwei Hauptsätze mit «deshalb» auf.
    - Konditionalsätze (wenn, falls): Löse Konditionalsätze als zwei Hauptsätze mit «vielleicht» auf.
    - Finalsätze (damit, dass): Löse Finalsätze als zwei Hauptsätze mit «deshalb» auf.
    - Konzessivsätze (obwohl, obgleich, wenngleich, auch wenn): Löse Konzessivsätze als zwei Hauptsätze mit «trotzdem» auf.
    - Temporalsätze (als, während, bevor, nachdem, sobald, seit): Löse Temporalsätze als einzelne chronologische Sätze auf. Wenn es passt, verknüpfe diese mit «dann». 
    - Adversativsätze (aber, doch, jedoch, allerdings, sondern, allein): Löse Adversativsätze als zwei Hauptsätze mit «aber» auf.
    - Modalsätze (indem, dadurch dass): Löse Modalsätze als zwei Hauptsätze auf. Z.B. Alltagssprache: Er lernt besser, indem er regelmässig übt. Leichte Sprache: Er lernt besser. Er übt regelmässig.
    - Konsekutivsätze (so dass, sodass): Löse Konsekutivsätze als zwei Hauptsätze auf. Z.B. Alltagssprache: Er ist krank, sodass er nicht arbeiten konnte. Leichte Sprache: Er ist krank. Er konnte nicht arbeiten.
    - Relativsätze mit «welcher», «welche», «welches»: Löse solche Relativsätze als zwei Hauptsätze auf. Z.B. Alltagssprache: Das Auto, welches rot ist, steht vor dem Haus. Leichte Sprache: Das Auto ist rot. Das Auto steht vor dem Haus.
    - Ob-Sätze: Schreibe Ob-Sätze als zwei Hauptsätze. Z.B. Alltagssprache: Er fragt, ob es schönes Wetter wird. Leichte Sprache: Er fragt: Wird es schönes Wetter?
- Verwende aktive Sprache anstelle von Passiv. 
- Benutze den Genitiv nur in einfachen Fällen. Verwende stattdessen die Präposition "von" und den Dativ.
- Vermeide das stumme «e» am Wortende, wenn es nicht unbedingt notwendig ist. Zum Beispiel: «des Fahrzeugs» statt «des Fahrzeuges».
- Bevorzuge die Vorgegenwart (Perfekt). Vermeide die Vergangenheitsform (Präteritum), wenn möglich. Verwende das Präteritum nur bei den Hilfsverben (sein, haben, werden) und bei Modalverben (können, müssen, sollen, wollen, mögen, dürfen).
- Benenne Gleiches immer gleich. Verwende für denselben Begriff, Gegenstand oder Sachverhalt immer dieselbe Bezeichnung. Wiederholungen von Begriffen sind in Texten in Leichter Sprache normal.
- Vermeide Pronomen. Verwende Pronomen nur, wenn der Bezug ganz klar ist. Sonst wiederhole das Nomen.
- Formuliere grundsätzlich positiv und bejahend. Vermeide Verneinungen ganz.
- Verwende IMMER die Satzstellung Subjekt-Prädikat-Objekt.
- Vermeide Substantivierungen. Verwende stattdessen Verben und Adjektive.
- Achte auf die sprachliche Gleichbehandlung von Mann und Frau. Verwende immer beide Geschlechter oder schreibe geschlechtsneutral.
- Vermeide Abkürzungen grundsätzlich. Schreibe stattdessen die Wörter aus. Z.B. «10 Millionen» statt «10 Mio.», «200 Kilometer pro Stunde» statt «200 km/h», «zum Beispiel» statt «z.B.», «30 Prozent» statt «30 %», «2 Meter» statt «2 m», «das heisst» statt «d.h.». Je nach Kontext kann es aber sinnvoll sein, eine Abkürzung einzuführen. Schreibe dann den Begriff einmal aus, erkläre ihn, führe die Abkürzung ein und verwende sie dann konsequent.
- Schreibe die Abkürzungen «usw.», «z.B.», «etc.» aus. Also zum Beispiel «und so weiter», «zum Beispiel», «etcetera».
- Formatiere Zeitangaben immer «Stunden Punkt Minuten Uhr». Verwende keinen Doppelpunkt, um Stunden von Minuten zu trennen. Ergänze immer .00 bei vollen Stunden. Beispiele: 9.25 Uhr (NICHT 9:30), 10.30 Uhr (NICHT 10:00), 14.00 Uhr (NICHT 14 Uhr), 15.45 Uhr, 18.00 Uhr, 20.15 Uhr, 22.30 Uhr.
- Formatiere Datumsangaben immer so: 1. Januar 2022, 15. Februar 2022.
- Jahreszahlen schreibst du immer vierstellig aus: 2022, 2025-2030.
- Verwende immer französische Anführungszeichen (« ») anstelle von deutschen Anführungszeichen („ “).
- Gliedere Telefonnummern mit vier Leerzeichen. Z.B. 044 123 45 67. Den alten Stil mit Schrägstrich (044/123 45 67) und die Vorwahl-Null in Klammern verwendest du NIE.
- Zahlen bis 12 schreibst du aus. Ab 13 verwendest du Ziffern.
- Fristen, Geldbeträge und physikalische Grössen schreibst du immer in Ziffern.
- Zahlen, die zusammengehören, schreibst du immer in Ziffern. Beispiel: 5-10, 20 oder 30.
- Grosse Zahlen ab 5 Stellen gliederst du in Dreiergruppen mit Leerzeichen. Beispiel: 1 000 000.
- Achtung: Identifikationszahlen übernimmst du 1:1. Beispiel: Stammnummer 123.456.789, AHV-Nummer 756.1234.5678.90, Konto 01-100101-9.
- Verwende das Komma, dass das deutsche Dezimalzeichen ist. Überflüssige Nullen nach dem Komma schreibst du nicht. Beispiel: 5 Millionen, 3,75 Prozent, 1,5 Kilometer, 2,25 Stunden.
- Vor Franken-Rappen-Beträgen schreibst du immer «CHF». Nur nach ganzen Franken-Beträgen darfst du «Franken» schreiben. Bei Franken-Rappen-Beträgen setzt du einen Punkt als Dezimalzeichen. Anstatt des Null-Rappen-Strichs verwendest du «.00» oder lässt die Dezimalstellen weg. Z.B. 20 Franken, CHF 20, CHF 2.00, CHF 12.50, aber CHF 45,2 Millionen, EUR 14,90.
- Die Anrede mit «Sie» schreibst du immer gross. Beispiel: «Sie haben».
- Strukturiere den Text. Gliedere in sinnvolle Abschnitte und Absätze. Verwende Titel und Untertitel grosszügig, um den Text zu gliedern. Es kann hilfreich sein, wenn diese als Frage formuliert sind.
- Stelle Aufzählungen als Liste dar.
- Zeilenumbrüche helfen, Sinneinheiten zu bilden und erleichtern das Lesen. Füge deshalb nach Haupt- und Nebensätzen sowie nach sonstigen Sinneinheiten Zeilenumbrüche ein. Eine Sinneinheit soll maximal 8 Zeilen umfassen.
- Eine Textzeile enthält inklusiv Leerzeichen maximal 85 Zeichen.`

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

    const outputType_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE) || "plain";
    const [outputType, setOutputType] = useState<string>(outputType_pref);
    const outputLength_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_OUTPUT_LENGTH) || "complete";
    const [outputLength, setOutputLength] = useState<string>(outputLength_pref);

    const systemPrompt_pref = localStorage.getItem(STORAGE_KEYS.SIMPLY_SYSTEM_PROMPT) || outputType == "plain" ? SYSTEM_MESSAGE_ES : SYSTEM_MESSAGE_LS;
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

    const buildMessagePlain = (prompt: string) => {
        let completeness = outputLength == 'complete' ? REWRITE_COMPLETE : REWRITE_CONDENSED;

        if (LLM.llm_name.toLowerCase().includes("mistral")) {
            return `
            Hier ist ein schwer verständlicher Text, den du vollständig in Einfache Sprache, Sprachniveau B1 bis A2, umschreiben sollst:

            <schwer-verständlicher-text>
            ${prompt}
            </schwer-verständlicher-text>

            Bitte lies den Text sorgfältig durch und schreibe ihn vollständig in Einfache Sprache (B1 bis A2) um. 

            Beachte dabei folgende Regeln für Einfache Sprache (B1 bis A2):

            ${completeness}
            ${RULES_ES}

            Formuliere den Text jetzt in Einfache Sprache, Sprachniveau B1 bis A2, um. Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags.
            `
        } else {
            return `Bitte schreibe den folgenden schwer verständlichen Text vollständig in Einfache Sprache, Sprachniveau B1 bis A2, um. 

            Beachte dabei folgende Regeln für Einfache Sprache (B1 bis A2):

            ${completeness}
            ${RULES_ES}

            Schreibe den vereinfachten Text innerhalb von <einfachesprache> Tags.

            Hier ist der schwer verständliche Text:

            --------------------------------------------------------------------------------

            ${prompt}
            `
        }
    }

    const buildMessageEasy = (prompt: string) => {
        let completeness = outputLength == 'complete' ? REWRITE_COMPLETE : REWRITE_CONDENSED;

        if (LLM.llm_name.toLowerCase().includes("mistral")) {
            return `
            Hier ist ein schwer verständlicher Text, den du vollständig in Leichte Sprache, Sprachniveau A2, umschreiben sollst:

            <schwer-verständlicher-text>
            ${prompt}
            </schwer-verständlicher-text>

            Bitte lies den Text sorgfältig durch und schreibe ihn vollständig in Leichte Sprache, Sprachniveau A2 um. 

            Beachte dabei folgende Regeln für Leichte Sprache (A2):

            ${completeness}
            ${RULES_LS}

            Formuliere den Text jetzt in Leichte Sprache, Sprachniveau A2, um. Schreibe den vereinfachten Text innerhalb von <leichtesprache> Tags.
            `
        } else {
            return `Bitte schreibe den folgenden schwer verständlichen Text vollständig in Leichte Sprache, Sprachniveau A2, um. 

            Beachte dabei folgende Regeln für Leichte Sprache (A2):
            
            ${completeness}
            ${RULES_LS}
            
            Schreibe den vereinfachten Text innerhalb von <leichtesprache> Tags.
            
            Hier ist der schwer verständliche Text:
            
            --------------------------------------------------------------------------------
            
            ${prompt}
            `
        }
    }

    const onExampleClicked = (example: string) => {
        makeApiRequest(example);
    };
    function extractText(response: string): string {
        let result: RegExpMatchArray | null;

        if (outputType == "easy") {
            result = response.match(/<leichtesprache>(.*?)<\/leichtesprache>/gs);
        } else {
            result = response.match(/<einfachesprache>(.*?)<\/einfachesprache>/gs);
        }

        return result ? result.map(item => item.replace(/<\/?[^>]+(>|$)/g, "")).join("\n").trim() : '';
    }


    const makeApiRequest = async (question: string) => {
        error && setError(undefined);
        lastQuestionRef.current = question
        setIsLoading(true);
        let userMsg: string;
        if (outputType == "plain") {
            userMsg = buildMessagePlain(question)
        } else {
            userMsg = buildMessageEasy(question)
        }
        try {
            const request: SimplyRequest = {
                topic: question,
                language: language,
                model: LLM.llm_name,
                max_output_tokens: LLM.max_output_tokens,
                history: [{ user: userMsg, bot: undefined }],
                shouldStream: true,
                system_message: systemPrompt
            };
            const parsedResponse: SimplyResponse = await simplyApi(request);
            const askResponse: AskResponse = { answer: extractText(parsedResponse.content), error: parsedResponse.error }
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
    const onOutputTypeChanged = (e: any, selection: RadioGroupOnChangeData) => {
        setOutputType(selection.value as ("plain" | "easy"));
        setSystemPrompt(selection.value == "plain" ? SYSTEM_MESSAGE_ES : SYSTEM_MESSAGE_LS)
        localStorage.setItem(STORAGE_KEYS.SIMPLY_OUTPUT_TYPE, selection.value);
    };

    const onOutputLengthChanged = (e: any, selection: RadioGroupOnChangeData) => {
        setOutputLength(selection.value as ("complete" | "condensed"));
        localStorage.setItem(STORAGE_KEYS.SIMPLY_OUTPUT_LENGTH, selection.value);
    };

    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Field label={t('sum.levelofdetail')}>
                    <RadioGroup layout="horizontal" onChange={onOutputTypeChanged} value={outputType}>
                        <Radio value="plain" label={t('simply.plain')} />
                        <Radio value="easy" label={t('simply.easy')} />
                    </RadioGroup>
                </Field>
                <Field label={t('sum.levelofdetail')}>
                    <RadioGroup layout="horizontal" onChange={onOutputLengthChanged} value={outputLength}>
                        <Radio value="complete" label={t('simply.complete')} />
                        <Radio value="condensed" label={t('simply.condensed')} />
                    </RadioGroup>
                </Field>
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
