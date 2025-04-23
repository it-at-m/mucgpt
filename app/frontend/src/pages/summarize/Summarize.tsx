import { useRef, useState, useEffect, useContext, useReducer, useMemo, useCallback } from "react";

import { sumApi, SumarizeMessage, SumRequest, SumResponse } from "../../api";
import { ClearChatButton } from "../../components/ClearChatButton";
import { LanguageContext } from "../../components/LanguageSelector/LanguageContextProvider";
import { useTranslation } from "react-i18next";
import { SumInput } from "../../components/SumInput";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { ChatLayout } from "../../components/ChatLayout/ChatLayout";
import { Sidebar } from "../../components/Sidebar/Sidebar";
import { SummarizeSidebar } from "../../components/SummarizeSidebar/SummarizeSidebar";
import { SUMMARIZE_STORE } from "../../constants";
import { StorageService } from "../../service/storage";
import { getChatReducer, handleDeleteChat, handleRollback, setupStore } from "../page_helpers";
import { SumAnswerList } from "../../components/AnswerList/SumAnswerList";
import { ExampleList, ExampleModel } from "../../components/Example";
import { ChatMessage, ChatOptions } from "../chat/Chat";

const STORAGE_KEY_LEVEL_OF_DETAIL = "SUM_LEVEL_OF_DETAIL";

const EXAMPLES: ExampleModel[] = [
    {
        text: "Rotkäppchen",
        value: `Es war einmal ein kleines süßes Mädchen, das hatte jedermann lieb, der sie nur ansah, am allerliebsten aber ihre Großmutter, die wusste gar nicht, was sie alles dem Kinde geben sollte. Einmal schenkte sie ihm ein Käppchen von rotem Samt, und weil ihm das so wohl stand, und es nichts anders mehr tragen wollte, hieß es nur das Rotkäppchen. Eines Tages sprach seine Mutter zu ihm: "Komm, Rotkäppchen, da hast du ein Stück Kuchen und eine Flasche Wein, bring das der Großmutter hinaus; sie ist krank und schwach und wird sich daran laben. Mach dich auf, bevor es heiß wird, und wenn du hinauskommst, so geh hübsch sittsam und lauf nicht vom Wege ab, sonst fällst du und zerbrichst das Glas, und die Großmutter hat nichts. Und wenn du in ihre Stube kommst, so vergiss nicht guten Morgen zu sagen und guck nicht erst in allen Ecken herum!"
        "Ich will schon alles richtig machen," sagte Rotkäppchen zur Mutter, und gab ihr die Hand darauf. Die Großmutter aber wohnte draußen im Wald, eine halbe Stunde vom Dorf. Wie nun Rotkäppchen in den Wald kam, begegnete ihm der Wolf. Rotkäppchen aber wusste nicht, was das für ein böses Tier war, und fürchtete sich nicht vor ihm. "Guten Tag, Rotkäppchen!" sprach er. "Schönen Dank, Wolf!" - "Wo hinaus so früh, Rotkäppchen?" - "Zur Großmutter." - "Was trägst du unter der Schürze?" - "Kuchen und Wein. Gestern haben wir gebacken, da soll sich die kranke und schwache Großmutter etwas zugut tun und sich damit stärken." - "Rotkäppchen, wo wohnt deine Großmutter?" - "Noch eine gute Viertelstunde weiter im Wald, unter den drei großen Eichbäumen, da steht ihr Haus, unten sind die Nusshecken, das wirst du ja wissen," sagte Rotkäppchen. Der Wolf dachte bei sich: Das junge, zarte Ding, das ist ein fetter Bissen, der wird noch besser schmecken als die Alte. Du musst es listig anfangen, damit du beide schnappst. Da ging er ein Weilchen neben Rotkäppchen her, dann sprach er: "Rotkäppchen, sieh einmal die schönen Blumen, die ringsumher stehen. Warum guckst du dich nicht um? Ich glaube, du hörst gar nicht, wie die Vöglein so lieblich singen? Du gehst ja für dich hin, als wenn du zur Schule gingst, und ist so lustig haussen in dem Wald."
        Rotkäppchen schlug die Augen auf, und als es sah, wie die Sonnenstrahlen durch die Bäume hin und her tanzten und alles voll schöner Blumen stand, dachte es: Wenn ich der Großmutter einen frischen Strauß mitbringe, der wird ihr auch Freude machen; es ist so früh am Tag, dass ich doch zu rechter Zeit ankomme, lief vom Wege ab in den Wald hinein und suchte Blumen. Und wenn es eine gebrochen hatte, meinte es, weiter hinaus stände eine schönere, und lief danach und geriet immer tiefer in den Wald hinein. Der Wolf aber ging geradewegs nach dem Haus der Großmutter und klopfte an die Türe. "Wer ist draußen?" - "Rotkäppchen, das bringt Kuchen und Wein, mach auf!" - "Drück nur auf die Klinke!" rief die Großmutter, "ich bin zu schwach und kann nicht aufstehen." Der Wolf drückte auf die Klinke, die Türe sprang auf und er ging, ohne ein Wort zu sprechen, gerade zum Bett der Großmutter und verschluckte sie. Dann tat er ihre Kleider an, setzte ihre Haube auf, legte sich in ihr Bett und zog die Vorhänge vor.
        Rotkäppchen aber, war nach den Blumen herumgelaufen, und als es so viel zusammen hatte, dass es keine mehr tragen konnte, fiel ihm die Großmutter wieder ein, und es machte sich auf den Weg zu ihr. Es wunderte sich, dass die Tür aufstand, und wie es in die Stube trat, so kam es ihm so seltsam darin vor, dass es dachte: Ei, du mein Gott, wie ängstlich wird mir's heute zumut, und bin sonst so gerne bei der Großmutter! Es rief: "Guten Morgen," bekam aber keine Antwort. Darauf ging es zum Bett und zog die Vorhänge zurück. Da lag die Großmutter und hatte die Haube tief ins Gesicht gesetzt und sah so wunderlich aus. "Ei, Großmutter, was hast du für große Ohren!" - "Dass ich dich besser hören kann!" - "Ei, Großmutter, was hast du für große Augen!" - "Dass ich dich besser sehen kann!" - "Ei, Großmutter, was hast du für große Hände!" - "Dass ich dich besser packen kann!" - "Aber, Großmutter, was hast du für ein entsetzlich großes Maul!" - "Dass ich dich besser fressen kann!" Kaum hatte der Wolf das gesagt, so tat er einen Satz aus dem Bette und verschlang das arme Rotkäppchen.
        Wie der Wolf seinen Appetit gestillt hatte, legte er sich wieder ins Bett, schlief ein und fing an, überlaut zu schnarchen. Der Jäger ging eben an dem Haus vorbei und dachte: Wie die alte Frau schnarcht! Du musst doch sehen, ob ihr etwas fehlt. Da trat er in die Stube, und wie er vor das Bette kam, so sah er, dass der Wolf darin lag. "Finde ich dich hier, du alter Sünder," sagte er, "ich habe dich lange gesucht." Nun wollte er seine Büchse anlegen, da fiel ihm ein, der Wolf könnte die Großmutter gefressen haben und sie wäre noch zu retten, schoss nicht, sondern nahm eine Schere und fing an, dem schlafenden Wolf den Bauch aufzuschneiden. Wie er ein paar Schnitte getan hatte, da sah er das rote Käppchen leuchten, und noch ein paar Schnitte, da sprang das Mädchen heraus und rief: "Ach, wie war ich erschrocken, wie war's so dunkel in dem Wolf seinem Leib!" Und dann kam die alte Großmutter auch noch lebendig heraus und konnte kaum atmen. Rotkäppchen aber holte geschwind große Steine, damit füllten sie dem Wolf den Leib, und wie er aufwachte, wollte er fortspringen, aber die Steine waren so schwer, dass er gleich niedersank und sich totfiel.
        Da waren alle drei vergnügt. Der Jäger zog dem Wolf den Pelz ab und ging damit heim, die Großmutter aß den Kuchen und trank den Wein, den Rotkäppchen gebracht hatte, und erholte sich wieder; Rotkäppchen aber dachte: Du willst dein Lebtag nicht wieder allein vom Wege ab in den Wald laufen, wenn dir's die Mutter verboten hat.
        Es wird auch erzählt, dass einmal, als Rotkäppchen der alten Großmutter wieder Gebackenes brachte, ein anderer Wolf es angesprochen und vom Wege habe ableiten wollen. Rotkäppchen aber hütete sich und ging geradefort seines Wegs und sagte der Großmutter, dass es dem Wolf begegnet wäre, der ihm guten Tag gewünscht, aber so bös aus den Augen geguckt hätte: "Wenn's nicht auf offener Straße gewesen wäre, er hätte mich gefressen." - "Komm," sagte die Großmutter, "wir wollen die Türe verschließen, dass er nicht hereinkann." Bald danach klopfte der Wolf an und rief: "Mach auf, Großmutter, ich bin das Rotkäppchen, ich bring dir Gebackenes." Sie schwiegen aber und machten die Türe nicht auf. Da schlich der Graukopf etlichemal um das Haus, sprang endlich aufs Dach und wollte warten, bis Rotkäppchen abends nach Hause ginge, dann wollte er ihm nachschleichen und wollt's in der Dunkelheit fressen. Aber die Großmutter merkte, was er im Sinne hatte. Nun stand vor dem Haus ein großer Steintrog, Da sprach sie zu dem Kind: "Nimm den Eimer, Rotkäppchen, gestern hab ich Würste gekocht, da trag das Wasser, worin sie gekocht sind, in den Trog!" Rotkäppchen trug so lange, bis der große, große Trog ganz voll war. Da stieg der Geruch von den Würsten dem Wolf in die Nase. Er schnupperte und guckte hinab, endlich machte er den Hals so lang, dass er sich nicht mehr halten konnte, und anfing zu rutschen; so rutschte er vom Dach herab, gerade in den großen Trog hinein und ertrank. Rotkäppchen aber ging fröhlich nach Haus, und von nun an tat ihm niemand mehr etwas zuleide. "
    `
    },
    {
        text: "Text über autonome Autos",
        value: "Autonome Autos sind Autos, die komplett selbstständig fahren. Sie brauchen keinen Fahrer mehr. Ihr Innenraum könnte beispielsweise wie in einem Zug aussehen, mit vier Sitzen und eventuell einem Tisch. Lenkrad, Pedale, Schaltknüppel – all das wäre nicht mehr vorhanden. Damit diese Autos autonom fahren können, sind sie mit einer Fülle von Technik ausgestattet. Laser, Sensoren, Kameras, ein GPS-Empfänger, Messgeräte und ein Bordcomputer erkennen andere Verkehrsteilnehmer, Straßenschilder, Ampeln usw. Sie machen es möglich, dass das Auto sich sicher durch den Verkehr bewegt und Kollisionen vermeidet. Mehrere Autohersteller arbeiten an verschiedenen Modellen autonomer Autos und die Forschung ist schon weit fortgeschritten."
    },
    {
        text: "Text übers Tempolimit",
        value: "Viele wollen es. 57 Prozent der Deutschen sagen in einer Umfrage des Meinungsforschungsinstituts YouGov, dass sie für ein Tempolimit von 130 Stundenkilometern auf Autobahnen sind. Genauso sind es Menschen aus Wissenschaft, Politik, Kirche und dem öffentlichen Leben, die im Bündnis Tempolimit jetzt! aktiv sind. Einer davon: Sebastian Vettel, der vier Saisons der Formel-1 gewonnen hat.​Einer, der es definitiv nicht will, ist Verkehrsminister Volker Wissing. Der Politiker aus der Freien Demokratischen Partei (FDP) ist gegen staatliche Limitierungen im Straßenverkehr. Er sagt: „Autofahren bedeutet Freiheit.“ Mit dieser Meinung ist Wissing in seiner Partei und in Deutschland nicht allein.​Fast allein ist das Land aber mit der Möglichkeit, auf Autobahnen so schnell zu fahren, wie man will. In Europa hat nur ein anderer Ort kein Limit: die Isle of Man in der Irischen See. Autobahnen gibt es dort aber keine. Auch insgesamt gibt es nur wenige andere Länder ohne Maximalgeschwindigkeit, sie haben aber schlechte Straßen. ​Über ein Tempolimit diskutiert man in Deutschland schon ziemlich lang – und meistens emotional. Dabei ist 1953 ein wichtiges Jahr. Damals fand unter Kanzler Konrad Adenauer eine große Deregulierung der Geschwindigkeit statt: Menschen in Pkw und auf Motorrädern durften überall in der Bundesrepublik so schnell fahren, wie sie wollten und konnten. Westdeutschland lebte seinen Mythos der Autobahn. Anders in der Deutschen Demokratischen Republik: Dort waren 100 Stundenkilometer auf Autobahnen das Maximum, 80 außerhalb von Orten und 50 in Orten.​Weil in der Bundesrepublik die Zahl der Verkehrstoten deutlich stieg, führte die Regierung im Jahr 1957 für Orte eine Maximalgeschwindigkeit von 50 Stundenkilometern ein. Diese Norm hatte viele Gegner: den Allgemeinen Deutschen Automobil-Club (ADAC), die Autoindustrie, aber auch Menschen aus Politik und Wissenschaft.​Im Jahr 1972 kam die Einführung eines Tempolimits von 100 Stundenkilometern auf Landstraßen. Auch über diese Aktion gegen die vielen Verkehrstoten gab es intensive Diskussionen. ​Monate später kam die Ölkrise – und mit ihr ab November 1973 ein vorübergehendes Tempolimit von 100 Stundenkilometern auf Autobahnen. So wollte man den Erdölverbrauch reduzieren. Aber der Protest war groß. Ganz vorn dabei war der ADAC, der eine Kampagne mit dem Motto „Freie Fahrt für freie Bürger“ startete. Mit Erfolg: Nach 111 Tagen endete das Tempolimit auf Autobahnen. Ab dem 15. März 1974 durfte man wieder so viel Gas geben, wie man wollte. Das ist bis heute auf circa 70 Prozent der deutschen Autobahnen möglich. Dort gibt es nur die Empfehlung für eine Geschwindigkeit von 130 Stundenkilometern.  ​ Die Debatte über das Tempolimit hat trotzdem nicht aufgehört. Und auch 50 Jahre später spielen die mächtige deutsche Autolobby und das (oft auch von ihr verwendete) Freiheitsargument noch immer zentrale Rollen – obwohl die Welt heute eine andere ist.​ Da ist vor allem die Frage, ob ein Tempolimit gegen die Klimakrise hilft. Anfang dieses Jahres hat das Umweltbundesamt eine Studie publiziert. Sie zeigt, dass ein Limit von 120 Stundenkilometern einen größeren Effekt hätte als bis jetzt gedacht. Pro Jahr könnte man die Treibhausgasemissionen des deutschen Straßenverkehrs so um 4,2 Prozent reduzieren.​ Elementar ist außerdem die Frage, ob ein Tempolimit den Verkehr sicherer macht. Klar ist: Je schneller ein Auto unterwegs ist, desto länger dauert das Bremsen bis zum Stoppen. Das Nachrichtenportal Spiegel Online hat den Unfallatlas der statistischen Ämter des Bundes und der Länder analysiert. Das Resultat: Je eine Milliarde gefahrener Kilometer gibt es auf Autobahnabschnitten mit Tempolimit 0,95 tödliche Unfälle. Auf Strecken ohne Tempolimit sind es 1,67 tödliche Unfälle – rund 75 Prozent mehr.​ Warum lieben viele Deutsche das schnelle Fahren trotzdem so sehr? Fragt man Verkehrspsychologen, hört man bald wieder das große Wort dieser Debatte: Freiheit. Aber dominiert der Wunsch danach wirklich die kollektive Psyche und entscheidet über das Tempo deutscher Autofahrerinnen?​Eine Antwort liefert eine Studie des Instituts der deutschen Wirtschaft aus dem Jahr 2021. Sie zeigt: 77 Prozent der Autofahrer sind auf Autobahnabschnitten ohne Tempolimit langsamer als 130 Stundenkilometer unterwegs. Zwölf Prozent fahren dort zwischen 130 und 140 Stundenkilometer. Nur weniger als zwei Prozent fahren schneller als 160.​Inzwischen ist auch die Mehrheit der Mitglieder des ADAC für ein Tempolimit. Der Verband der Automobilindustrie ist noch dagegen. Und die Regierung? Im Koalitionsvertrag steht auf Wunsch der FDP: „Ein generelles Tempolimit wird es nicht geben."
    }
];

const Summarize = () => {
    // getChatReducer function to handle chat state changes
    const chatReducer = getChatReducer<ChatOptions>();

    // Zusammenhängende States mit useReducer
    const [chatState, dispatch] = useReducer(chatReducer, {
        answers: [],
        temperature: 0.7,
        max_output_tokens: 4000,
        systemPrompt: "",
        active_chat: undefined,
        allChats: [],
        totalTokens: 0
    });

    // Destrukturierung für einfacheren Zugriff
    const { answers, temperature, max_output_tokens, systemPrompt, active_chat, allChats, totalTokens } = chatState;

    // Context
    const { language } = useContext(LanguageContext);
    const { LLM } = useContext(LLMContext);
    const { t } = useTranslation();

    // Refs
    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const activeChatRef = useRef(active_chat);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();
    const [question, setQuestion] = useState<string>("");

    // Detaillevel
    const detaillevel_pref = (localStorage.getItem(STORAGE_KEY_LEVEL_OF_DETAIL) as "long" | "medium" | "short") || "short";
    const [detaillevel, setDetaillevel] = useState<"long" | "medium" | "short">(detaillevel_pref);

    // StorageService
    const storageService: StorageService<SumResponse, {}> = new StorageService<SumResponse, {}>(SUMMARIZE_STORE);

    // useEffect to keep the activeChatRef in sync with the active_chat state
    useEffect(() => {
        activeChatRef.current = active_chat;
    }, [active_chat]);

    // useEffect to set up the store and load the initial data
    useEffect(() => {
        setupStore(
            error,
            setError,
            setIsLoading,
            storageService,
            (answers: ChatMessage[]) => dispatch({ type: "SET_ANSWERS", payload: answers }),
            answers,
            lastQuestionRef,
            (id: string | undefined) => dispatch({ type: "SET_ACTIVE_CHAT", payload: id })
        );
    }, []);

    // useEffect to scroll to the end of the chat message stream when loading is complete
    useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [isLoading]);

    // clearChat function to delete the current chat and reset the state
    const clearChat = handleDeleteChat(
        active_chat,
        lastQuestionRef,
        error,
        setError,
        storageService,
        (answers: ChatMessage[]) => dispatch({ type: "SET_ANSWERS", payload: answers }),
        (id: string | undefined) => dispatch({ type: "SET_ACTIVE_CHAT", payload: id })
    );

    // makeApiRequest function to handle API requests
    const makeApiRequest = useCallback(
        async (question: string, file?: File) => {
            let questionText = file ? file.name : question;
            lastQuestionRef.current = questionText;

            error && setError(undefined);
            setIsLoading(true);
            try {
                const request: SumRequest = {
                    text: questionText,
                    detaillevel: detaillevel,
                    language: language,
                    model: LLM.llm_name
                };
                const result = await sumApi(request, file);
                const completeAnswer: SumarizeMessage = { user: questionText, response: result };

                dispatch({ type: "SET_ANSWERS", payload: [...answers, completeAnswer] });
                if (activeChatRef.current) await storageService.appendMessage(completeAnswer, activeChatRef.current);
                else {
                    const id = await storageService.create([completeAnswer], undefined);
                    dispatch({ type: "SET_ACTIVE_CHAT", payload: id });
                }
            } catch (e) {
                setError(e);
            } finally {
                setIsLoading(false);
            }
        },
        [answers, language, detaillevel, LLM, storageService, dispatch, activeChatRef]
    );

    // Example clicked handler
    const onExampleClicked = useCallback(
        (example: string) => {
            makeApiRequest(example, undefined);
        },
        [makeApiRequest]
    );

    // Rollback message handler
    const onRollbackMessage = useCallback(
        (index: number) => {
            if (!activeChatRef.current) return;
            handleRollback(index, activeChatRef.current, dispatch, storageService, lastQuestionRef, setQuestion, () => clearChat, undefined);
        },
        [activeChatRef.current, dispatch, storageService, lastQuestionRef, setQuestion, clearChat]
    );

    // Detaillevel ändern
    const onDetaillevelChanged = useCallback(
        (newValue: string) => {
            setDetaillevel(newValue as "long" | "medium" | "short");
            localStorage.setItem(STORAGE_KEY_LEVEL_OF_DETAIL, newValue);
        },
        [localStorage]
    );

    // ExampleList component
    const examplesComponent = <ExampleList examples={EXAMPLES} onExampleClicked={onExampleClicked} />;

    // Sidebar
    const sidebar_actions = useMemo(
        () => <ClearChatButton onClick={() => clearChat} disabled={!lastQuestionRef.current || isLoading} />,
        [clearChat, isLoading, lastQuestionRef.current]
    );
    const sidebar_content = useMemo(
        () => <SummarizeSidebar onDetaillevelChanged={onDetaillevelChanged} detaillevel_pref={detaillevel_pref} />,
        [onDetaillevelChanged, detaillevel_pref]
    );
    const sidebar = useMemo(() => <Sidebar actions={sidebar_actions} content={sidebar_content}></Sidebar>, [sidebar_actions, sidebar_content]);

    // AnswerList component
    const answerList = useMemo(
        () => (
            <SumAnswerList
                answers={answers}
                onRollbackMessage={onRollbackMessage}
                isLoading={isLoading}
                error={error}
                makeApiRequest={() => makeApiRequest(lastQuestionRef.current)}
                chatMessageStreamEnd={chatMessageStreamEnd}
                lastQuestionRef={lastQuestionRef}
            />
        ),
        [answers, onRollbackMessage, isLoading, error, makeApiRequest, chatMessageStreamEnd, lastQuestionRef.current, lastQuestionRef]
    );
    // TextInput component
    const inputComponent = useMemo(
        () => (
            <SumInput
                clearOnSend
                placeholder={t("sum.prompt")}
                disabled={isLoading}
                onSend={(question, file) => makeApiRequest(question, file)}
                question={question}
                setQuestion={setQuestion}
            />
        ),
        [question, isLoading, makeApiRequest, t]
    );

    return (
        <ChatLayout
            sidebar={sidebar}
            examples={examplesComponent}
            answers={answerList}
            input={inputComponent}
            showExamples={!lastQuestionRef.current}
            header={t("sum.header")}
            header_as_markdown={false}
            messages_description={t("common.messages")}
            size="small"
        ></ChatLayout>
    );
};

export default Summarize;
