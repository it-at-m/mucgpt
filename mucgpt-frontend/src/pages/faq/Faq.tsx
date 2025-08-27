import { Dismiss24Regular } from "@fluentui/react-icons";
import styles from "./Faq.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Link, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { HeaderContext } from "../layout/HeaderContextProvider";

const Faq = () => {
    const { t } = useTranslation();
    const { setHeader } = useContext(HeaderContext);
    setHeader("FAQs");
    const navigate = useNavigate();
    const onClose = () => {
        navigate("/");
    };
    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Tooltip content={t("common.close")} relationship="description" positioning="below">
                    <Button
                        aria-label={t("common.close")}
                        icon={<Dismiss24Regular className={styles.system_prompt_warining_icon} />}
                        appearance="secondary"
                        onClick={onClose}
                        size="large"
                    ></Button>
                </Tooltip>
            </div>

            <div className={styles.faqRoot}>
                <h1 className={styles.header}>FAQs</h1>
                <Accordion multiple collapsible navigation="linear">
                    <AccordionItem value="1">
                        <AccordionHeader>Was ist MUCGPT?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                MUCGPT ist ein Hilfsmittel, das unseren Alltag einfacher und effizienter gestalten kann. Es berechnet Wortwahrscheinlichkeiten
                                mithilfe eines neuronalen Netzes, um Antworten zu generieren, die natürlich und plausibel klingen. Diese Antworten sind nicht
                                reproduzierbar. Das bedeutet, dass die gleiche Anfrage zu einem anderen Zeitpunkt unterschiedliche Ergebnisse liefern kann.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2">
                        <AccordionHeader>Was ist die Basis von MUCGPT bzw. der Unterschied zu ChatGPT?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                MUCGPT basiert auf ChatGPT, einem Dienst von OpenAI und Microsoft. Der Unterschied zu ChatGPT liegt jedoch darin, dass Ihre
                                eingegebenen Daten verschlüsselt an einen europäischen Server von Microsoft Azure nach Amsterdam geschickt werden und nicht in
                                die USA abfließen.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="3">
                        <AccordionHeader>Was ist der Unterschied zu Suchmaschinen wie z.B. Ecosia oder Google?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Ecosia und Google sind Suchmaschinen, die ans Internet angebunden sind. MUCGPT hat keine Live-Anbindung ans Internet, um sich
                                von dort Informationen zu holen. MUCGPT ist ein Sprachmodell, welches für die Antwort die wahrscheinlichsten Wörter auf Basis
                                der Nutzereingabe berechnet. Dahinter stecken Trainingsdaten, die unbekannt sind (wahrscheinlich sind das zum großen Teil Texte
                                aus dem Internet, aber auch Bücher etc.). Dies führt auch zu falschen Antworten, da das Sprachmodell auch Antworten erfindet,
                                die gut in den Kontext passen.
                                <p>
                                    Google hingegen durchsucht regelmäßig alle Webseiten und indexiert diese in einer Art Datenbank. Bei einer Google-Suche
                                    wird, vereinfacht gesagt, dann diese Datenbank nach dem passenden Treffer durchsucht und zurückgegeben. Wenn man auf der
                                    Suche nach Fakten ist, sollte man Suchmaschinen wie Google, Ecosia etc. verwenden, da diese genauere und vertrauenswürdigere
                                    Treffer liefern.
                                </p>
                                <p>
                                    MUCGPT generiert Wort für Wort aus den Eingaben. Da dahinter ein großes Sprachmodell ist, das auf einem Server mit vielen
                                    Grafikkarten läuft, ist eine Anfrage "energetisch" teurer als eine Google-Suche.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="4">
                        <AccordionHeader>Wer darf MUCGPT nutzen?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                MUCGPT darf von allen städtischen Mitarbeiter*innen inkl. externer Dienstleister*innen (alle, die einen muenchen.de-Account
                                besitzen) im dienstlichen Kontext genutzt werden.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="5">
                        <AccordionHeader>Welche Ziele verfolgt MUCGPT?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                MUCGPT kann als Ideengeber, Inspirationsquelle oder Diskussionspartner dienen oder Hilfe bei der Vorstrukturierung und
                                Zusammenfassung von Texten geben. Folgende Ziele können verfolgt werden:
                                <ul>
                                    <li>Erkenntnis-/Ideengewinnung</li>
                                    <li>Effizienzsteigerungen</li>
                                    <li>Verfahrensbeschleunigungen</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="6">
                        <AccordionHeader>Über welche Funktionen verfügt MUCGPT und wie kann ich diese nutzen?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <div>
                                    <ul>
                                        <li>
                                            <strong>Chat:</strong> Diese Funktion bietet den Nutzer*innen die Möglichkeit, MUCGPT Fragen zu stellen, nach
                                            Informationen zu suchen und verschiedene Themen zu diskutieren.
                                        </li>
                                        <li>
                                            <strong>Zusammenfassen:</strong> Diese Funktion ermöglicht es MUCGPT, prägnante Zusammenfassungen von Themen zu
                                            erstellen, entweder auf der Basis von Eingaben oder hochgeladenen PDFs.
                                        </li>
                                        <li>
                                            <strong>Brainstorming:</strong> Diese Funktion generiert kreative Vorschläge, Ideen und Lösungen auf der Basis von
                                            Eingaben im Kontext einer Mindmap.
                                        </li>
                                    </ul>
                                    <p>
                                        Ein Erklärvideo zu den einzelnen Funktionen mit jeweiligen Beispielen finden Sie{" "}
                                        <Link href="https://www.youtube.com/watch?v=jLFvdJhRV_U">hier</Link>.
                                    </p>
                                    <p>
                                        Unter folgendem Link finden sich Hilfestellungen zu Eingaben („Prompts“) bei MUCGPT, um zu erfahren, wie Sie Ihre Fragen
                                        am besten formulieren, um eine gewünschte Antwort zu erhalten:{" "}
                                        <Link href="https://the-decoder.de/chatgpt-guide-prompt-strategien/">
                                            https://the-decoder.de/chatgpt-guide-prompt-strategien/
                                        </Link>
                                    </p>
                                    <p>
                                        Um die in der Brainstorming-Funktion generierten Mindmaps nach dem Abspeichern öffnen zu können, nutzen Sie am besten
                                        „Freeplane“, welches Sie in Service Now unter diesem{" "}
                                        <Link href="https://it-services.muenchen.de/sp?id=sc_cat_item&table=sc_cat_item&sys_id=c1b4dc4f1ba12154a70c433c8b4bcba0">
                                            Link
                                        </Link>{" "}
                                        beantragen können (falls noch nicht auf Ihrem Rechner vorhanden).
                                    </p>
                                </div>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="7">
                        <AccordionHeader>Wie aktuell sind die Quellen, die MUCGPT zur Antwortfindung nutzt?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Als Datengrundlage wird das jeweils ausgewählte Sprachmodell verwendet. Die Datengrundlage und den Stand können Sie bei Auswahl
                                des Modells entnehmen. Dies ist bei den generierten Antworten unbedingt zu beachten. Um an aktuelle Informationen zu gelangen,
                                können Suchmaschinen wie Ecosia oder Google verwendet werden.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="8">
                        <AccordionHeader>Was muss bei der Überprüfung der Ergebnisse beachtet werden?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Für seine Antworten durchsucht MUCGPT keine Informationsquellen aus dem Internet oder anderen Datenbanken.
                                <p>
                                    MUCGPT sagt für seine Antworten auf Basis der Nutzereingaben Wörter voraus, die häufig in diesem Kontext vorkommen, weiß
                                    aber nicht, ob die darin enthaltene Information richtig ist. Bei allgemeinen Informationen, die häufig im Internet zu finden
                                    sind, ist es sehr wahrscheinlich, dass die Antwort richtig ist. Bei Randthemen ist das nicht der Fall. Trotzdem wird das
                                    Sprachmodell immer eine grammatikalisch/sprachlich korrekte Antwort geben. Inhaltlich muss sie aber nicht korrekt sein.
                                </p>
                                <p>
                                    Einen großen Einfluss auf die Qualität der Antworten des Sprachmodells haben die Texte, die für das Training des
                                    Sprachmodells genutzt wurden.
                                </p>
                                <p>
                                    Viele Informationen sind in den Trainingsdaten nicht vorhanden, z.B.:
                                    <ul>
                                        <li>Wissen, das zum Zeitpunkt des Trainings noch nicht verfügbar war</li>
                                        <li>Internes Wissen, das z.B. nur im Intranet der Stadt verfügbar ist</li>
                                        <li>Inhalte, die nicht Teil des Trainings waren (nicht jede Website im Internet war Teil des Trainings)</li>
                                    </ul>
                                </p>
                                <p>
                                    Insbesondere ist Vorsicht geboten, wenn MUCGPT nach Zahlen gefragt wird oder Zahlen in dessen Antwort vorhanden sind, da
                                    MUCGPT, bzw. Sprachmodelle im Allgemeinen, Probleme mit Mathematik oder Zahlen haben. Sie wurden darauf trainiert, Wörter
                                    vorherzusagen. Für ein Sprachmodell ist jede Zahl auch eine Art „Wort“. Wörter haben oft einen ganz bestimmten Kontext, in
                                    dem sie eine Bedeutung haben. Zum Beispiel ist es sehr wahrscheinlich, dass das Wort „Krönung“ im Kontext des Wortes „König“
                                    oder „Königin“ vorkommt. Bei der Zahl „2“ ist das nicht so klar. Sie kann in sehr vielen Kontexten vorkommen. Ähnlich
                                    verhält es sich mit konkreten Anfragen an die Statistik.
                                </p>
                                <p>
                                    Sprachmodelle sind daher sehr gut geeignet, um allgemeine (nicht aktuelle) Informationen zu erhalten. Je spezifischer das
                                    abgefragte Wissen ist, desto geringer ist die Wahrscheinlichkeit einer korrekten Antwort.
                                </p>
                                <p>
                                    Wenn man spezifische und aktuelle Informationen sucht, sollte man daher Internet-Suchmaschinen verwenden. Siehe dazu auch
                                    den Punkt oben <i>„Was ist der Unterschied zu Suchmaschinen wie z.B. Ecosia oder Google?“</i>
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="9">
                        <AccordionHeader>Was muss ich bezüglich der Weiterverwendung der Ergebnisse beachten?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Es ist möglich, dass Texte (Antworten) von MUCGPT sich nur minimal von der ursprünglichen Version unterscheiden oder sogar
                                wesentliche Elemente des Ursprungstextes identisch übernommen werden. Wer dann einen solchen Text vervielfältigt oder
                                veröffentlicht, begeht damit – ohne es beabsichtigt zu haben – eine Urheberrechtsverletzung. Der Urheber des Originals kann in
                                einem solchen Fall Unterlassungs-, Schadensersatz- und Beseitigungsansprüche geltend machen. Bei jeglicher Nutzung der
                                Ergebnisse (egal ob intern oder extern), muss daher eine Kennzeichnung erfolgen („Quelle: MUCGPT“). Die Verantwortung für die
                                Weiterverwendung der Ergebnisse trägt der/die MUCGPT-Nutzer*in.
                                <p>
                                    Weiterhin muss beachtet werden, dass die Ergebnisse entsprechend dem jeweiligen Rechtsgebiet angemessen weiterverwendet
                                    werden. Das bedeutet, dass es (je nach betroffenem Rechtsgebiet) wichtig ist, nahe am üblichen Standard der Formulierungen
                                    zu bleiben, damit hier keine Ungleichheit oder Unverständlichkeit z.B. aufgrund von (durch die KI) anders gewählten
                                    Fachbegriffen o.ä. entsteht. Bei der Nutzung von solch künstlich erzeugten Ergebnissen sollte immer auch der gesunde
                                    Menschenverstand angewendet werden, damit die Adressaten dieser Texte diese sowohl verstehen als auch sich darauf verlassen
                                    können.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="10">
                        <AccordionHeader>Formulierungshilfen Zitierstile</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <ul>
                                    <li>Dieser Text wurde mit Hilfe von MUCGPT erstellt und redaktionell auf Richtigkeit geprüft.</li>
                                    <li>
                                        Der vorliegende Text wurde mit Hilfe von MUCGPT erstellt und im Anschluss sorgfältig auf seine Korrektheit hin
                                        überprüft.
                                    </li>
                                    <li>Quelle: MUCGPT</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="11">
                        <AccordionHeader>Was muss ich bezüglich der Informationssicherheit und des Datenschutzes beachten?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Es ist nicht erlaubt, Daten mit LHM-Schutzbedarf "hoch" oder "sehr hoch" oder mit der Klassifizierung "vertraulich" oder "streng
                                vertraulich" als Eingabe zu verwenden. Es dürfen keine personenbezogenen Daten (z.B. Name, Adresse, Telefonnummer,
                                E-Mail-Adressen etc.) eingegeben werden. Weiterhin dürfen keine Zahlungsdaten (IBAN, BIC, Zahlungsempfänger, Vertragspartner
                                etc.) eingegeben werden.
                                <p>
                                    Bitte beachten Sie, dass auch bei Nutzung von MUCGPT die Vorschriften der LHM (z.B.{" "}
                                    <Link href="https://wilma.muenchen.de/pages/it-nutzung-support/apps/wiki/dienstanweisung/list/view/293986cc-4ded-4aad-ac2a-dd831540eb5c?currentLanguage=NONE">
                                        DA-IT
                                    </Link>
                                    ) zu beachten sind.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="12">
                        <AccordionHeader>Werden meine Eingaben irgendwo gespeichert? Wer hat Zugriff auf die Daten?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Ihre Eingaben werden nicht gespeichert. Keiner hat Zugriff auf Ihre eingegebenen Daten sowie die generierten Antworten.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="13">
                        <AccordionHeader>Wo werden die Chats der Chat-Historie gespeichert?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                Die gespeicherten Chats in Ihrer Historie werden lokal in Ihrem Browser gespeichert (IndexedDB). Dadurch sind die Chats nur für
                                Sie zugänglich und werden nicht in der Cloud oder auf einem Server gespeichert. Allerdings sind somit die Chats auch nur auf
                                diesem Gerät und diesem Browser zugänglich. Bei einem Wechsel auf ein anderes Gerät, einen anderen Browser oder in einen
                                Inkognito-Tab sind die gespeicherten Chats nicht mehr verfügbar.
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="14">
                        <AccordionHeader>Werden meine Eingaben für Trainingszwecke der Software verwendet?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>Nein.</div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="15">
                        <AccordionHeader>Werden meine Eingaben anderweitig verwendet?</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>Nein.</div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Faq;
