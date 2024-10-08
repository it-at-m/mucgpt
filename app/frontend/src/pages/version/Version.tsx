import styles from "./Version.module.css";
import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Button,
    Tooltip,
} from "@fluentui/react-components";
import vorgeschlageneAntworten from "../../assets/vorgeschlagene_antworten.png";
import zurückziehen from "../../assets/zurückziehen.png";
import history from "../../assets/History.png"
import simply from "../../assets/simply.png"
import { useTranslation } from "react-i18next";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { Link, useNavigate } from "react-router-dom";


const Version = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const onClose = () => {
        navigate('/');
    }
    return (
        <div className={styles.container}>
            <div className={styles.commandsContainer}>
                <Tooltip content={t('common.close')} relationship="description" positioning="below">
                    <Button aria-label={t('common.close')} icon={<Dismiss24Regular className={styles.system_prompt_warining_icon} />} appearance="secondary" onClick={onClose} size="large">
                    </Button>
                </Tooltip>
            </div>

            <div className={styles.versionRoot}>
                <h1 className={styles.header}>{t('version.header')}</h1>
                <Accordion multiple collapsible navigation="linear" defaultOpenItems="10">
                    <AccordionItem value="10">
                        <AccordionHeader>[1.2.1] 27.09.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li><strong>Preview</strong><br />
                                        Neben den Funktionen Chat, Zusammenfassen und Brainstorm bieten wir nun als viertes Feature "Leichte Sprache" an. Dieses Feature ist allerdings noch nicht final getestet und ist somit nur auf der <Link to={"http://mucgpt-demo.muenchen.de"} >Demo Version von MUCGPT</Link> verfügbar.
                                        <p>
                                            <img width="70%" src={simply} alt="Bild zur Leichten Sprache"></img>
                                        </p>
                                        <ul>
                                            <li>Über einen Chat können Texte an das Sprachmodell gesendet werden, die in leichte oder einfache Sprache übersetzt werden.</li>
                                            <li>Oben rechts können Sie auswählen, ob der Text in leichte oder einfache Sprache übersetzt werden soll.</li>
                                            <li>Einfache Sprache ist eine vereinfachte Form der Standardsprache, die auf Komplexität verzichtet, um eine breitere Zielgruppe zu erreichen.</li>
                                            <li>Leichte Sprache verwendet einfache Wörter und kurze Sätze, um Informationen klar und verständlich zu vermitteln.</li>
                                            <li>Das Feature "Leichte Sprache" nutzt dasselbe Sprachmodell wie die anderen Features, das über die Einstellungen ausgewählt wird. Wir empfehlen jedoch für die Nutzung von "Leichte Sprache" die Modelle <strong>mistral-large-2407</strong> oder <strong>gpt-4o</strong> zu verwenden.</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>
                                        Benutzer, die sich noch nicht in ServiceNow für MUCGPT registriert haben, werden beim Aufrufen des Dienstes automatisch zu ServiceNow weitergeleitet.
                                    </li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="9">
                        <AccordionHeader>[1.2.0] 18.09.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>
                                        Generierter Code wurde manchmal nicht korrekt dargestellt (Klammern entfernt)
                                    </li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="8">
                        <AccordionHeader>[1.1.4] 11.09.2024</AccordionHeader>
                        <AccordionPanel >
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>
                                        Versionsnummer wird wieder richtig gespeichert und in den Einstellungen angezeigt.
                                    </li>
                                    <li>
                                        Maximale Tokens aus der Config aufgeteilt in Input- und Output-Tokens. Dadurch laufen Modelle mit kleineren Contextfenster (wie z.B. Mistral) nicht mehr in einen Fehler.
                                    </li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="7">
                        <AccordionHeader>[1.1.3] 28.08.2024</AccordionHeader>
                        <AccordionPanel >
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>
                                        Benutzer haben nun die Möglichkeit zwischen 3 verschiedenen Sprachmodellen zu wählen, welches für ihren Anwendungsfall am besten passt.
                                        <ul>
                                            <li>GPT-4o-mini</li>
                                            <li>GPT-4o</li>
                                            <li>Mistral-Large-2407</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <h3>{t('version.changed')}</h3>
                                <ul>
                                    <li>
                                        Das standardmäßig benutze Sprachmodell wurde von GPT-3.5 auf die neuere Version GPT-4o-mini geändert.
                                    </li>
                                    <li>
                                        Verbesserung der "Zusammenfassen"-Funktion
                                        <ul>
                                            <li>weniger Fehler</li>
                                            <li>zuverlässigere Zusammenfassungen in der gewünschten Struktur</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="6">
                        <AccordionHeader>[1.1.2] 31.07.2024</AccordionHeader>
                        <AccordionPanel >
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>Für die Chat-Funktion gibt es nun eine Historie aller durchgeführten Konversationen
                                        <p>
                                            <img width="70%" src={history}>
                                            </img>
                                        </p>
                                        <ul>
                                            <li>Alle Chat-Verläufe in dem Tab "Chat" werden automatisch gespeichert</li>
                                            <li>Chats können im "Historie"-Fenster gelöscht, umbenannt oder favorisiert werden</li>
                                            <li>Favorisiert Chats werden immer ganz oben angezeigt</li>
                                            <li>Die Chats werden nach dem letzte Bearbeitungszeitpunkt sortiert und werden gruppiert in "Heute", "Gestern", "Letzte 7 Tage" und "Älter"</li>
                                        </ul>

                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="5">
                        <AccordionHeader>[1.1.1] 04.06.2024</AccordionHeader>
                        <AccordionPanel >
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>Neuer Hinweis im Antwortfeld vom Chat: MUCGPT macht Fehler</li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>Der Hilfstext für den Systemprompt ist nicht mehr transparent</li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                                <ul>
                                    <li>Die Beschreibung des Arielle-Chat-Beispiels wurde verbessert</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="1">
                        <AccordionHeader>[1.1.0] 22.05.2024</AccordionHeader>
                        <AccordionPanel >
                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li> Chat/Zusammenfassen/Brainstorming
                                        <ul>
                                            <li>Eigene Nachrichten können zurückgenommen werden. Beim Klicken des entsprechenden Buttons werden alle darunter liegenden Nachrichten und die ausgewählte Nachricht gelöscht. In das Eingabefeld wird die ausgewählte Nachricht eingefügt und kann abgeändert werden:
                                                <p>

                                                    <img width="70%" src={zurückziehen}>
                                                    </img>
                                                </p>
                                            </li>
                                            <li>Aktueller Chatverlauf wird im Browser zwischengespeichert und bleibt somit beim Verlassen der Seite bestehen</li>
                                        </ul>
                                    </li>
                                    <li>Was gibts neues?: Updatehistorie kann angezeigt werden</li>
                                    <li>Chat:
                                        <ul>
                                            <li><div>Auf eine Antwort von MUCGPT werden nun <b>Antwortmöglichkeiten</b> vorgeschlagen. Beim Auswählen einer Antwortmöglichkeit wird ein entsprechender Prompt in das Eingabefeld geladen: </div>
                                                <p>
                                                    <img width="80%" src={vorgeschlageneAntworten}>
                                                    </img>
                                                </p>
                                            </li>
                                            <li><b>Mermaid Diagramme</b>  können im Chat angezeigt und heruntergeladen werden</li>
                                            <li>Es gibt Arielle, die Diagramm-Assistentin. Diese begleitet den Nutzer beim Erstellen von Mermaid-Diagrammen.</li>
                                            <li>Mehr Platz für die Eingabe des Systemprompts</li>
                                            <li>Warnmeldung wird angezeigt, falls Systemprompt gesetzt ist</li>
                                            <li>Bessere Beschreibungen für die Temperatur Einstellung</li>


                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>Der System Prompt wird nun ins Tokenlimit miteinbezogen</li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="2">
                        <AccordionHeader>[1.0.0] 26.02.2024</AccordionHeader>
                        <AccordionPanel>

                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>Produktivumgebung aufgebaut</li>
                                    <li>FAQ wurde ergänzt</li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>Fehlermeldungen anzeigen, falls das Sprachmodell während dem Streaming überlastet ist</li>
                                    <li>Rechtsschreibfehler in Hilfetexten verbessert</li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                                <ul>
                                    <li>Nutzungsbedingungen müssen nun einmal am Tag bestätigt werden</li>
                                    <li>Nutzungsbedingungen wurden ergänzt</li>
                                    <li>Hinweis auf Servicedesk</li>
                                    <li>Link zum Wilma Arbeitsraum</li>
                                </ul>
                                <li>Chat-Beispiele von der Community wurden eingepflegt </li>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="3">
                        <AccordionHeader>[0.3.0] 06.02.2024</AccordionHeader>
                        <AccordionPanel>

                            <div className={styles.panel}>
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>Bereits getätigte Einstellungen werden gespeichert (z.B. Sprache, System Prompt, Nutzungsbedingungen gelesen)</li>
                                    <li>Barrierefreiheit:
                                        <ul>
                                            <li>Optimierte Darstellung für Screenreader</li>
                                            <li>Bessere Unterscheidbarkeit für Farbenblinde</li>
                                            <li>Unterstützung von Windows High Contrast Mode</li>
                                            <li>Und noch viele weitere Optimierungen ...</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>Als Code (mit Single-Backticks, ` ) formatierte Wörter in Antworten werden nun nicht mehr als Codeblock dargestellt, da dies zu sehr den Lesefluss gestört hat.</li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                                <ul>
                                    <li>Brainstorm:
                                        <ul>
                                            <li>Mindmaps sind nun im .mm Format herunterladbar - können mit dem Mindmap-Tool Freeplane weiterverarbeitet werden</li>
                                        </ul>
                                    </li>
                                    <li>Zusammenfassen:
                                        <ul>
                                            <li>Die Länge der Zusammenfassung hängt nun von der Gesamtlänge des Eingabetexts ab - längere Eingabetexte führen zu längeren Zusammenfassungen</li>
                                            <li>Der Detaillierungsgrad (kurz, mittel, lang) lässt sich über eine eigene Einstellung setzen.</li>
                                        </ul>
                                    </li>

                                    <li>Design vereinheitlicht</li>
                                    <li>Dark Mode hinzugefügt</li>
                                    <li>Nutzungsbedingungen aktualisiert</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem >
                    <AccordionItem value="4">
                        <AccordionHeader>[0.3.0] 06.02.2024</AccordionHeader>
                        <AccordionPanel>

                            <div className={styles.panel}>
                                ❄Neujahrsupdate❄
                                <h3>{t('version.added')}</h3>
                                <ul>
                                    <li>Bessere Darstellung von Antworten, die Markdown enthalten:
                                        <ul>
                                            <li>Bei Codeblöcken wird die Programmierprache mit angezeigt</li>
                                            <li>Bei Codeblöcken werden die Zeilennummern mitangegeben</li>
                                        </ul>
                                    </li>
                                    <li>Zusammenfassen:
                                        <ul>
                                            <li>Zusammenfassungen können kopiert werden</li>
                                            <li>Tokenlimit (Wörterlimit) wurde entfernt</li>
                                            <li>Es können PDFs hochgeladen werden, die anschließend zusammengefasst werden</li>
                                        </ul>
                                    </li>
                                    <li>Chat:
                                        <ul>
                                            <li>Antworten können nun optional unformatiert angezeigt werden (Alternative zur automatischen Darstellung als HTML/Markdown)</li>
                                            <li>Mehr Einstellungen für den Chat:
                                                <ul>
                                                    <li>Temperatur: Kreativtät der Antworten festlegen</li>
                                                    <li>Maximale Antwortlänge</li>
                                                    <li>System prompt: Verhalten des Sprachmodells festlegen, indem man z.B. eine bestimmte Rolle vergibt.</li>
                                                </ul>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t('version.fixed')}</h3>
                                <ul>
                                    <li>Bei längeren Eingaben ist das Eingabetextfeld nicht mitgewachsen</li>
                                    <li>Falls Antworten HTML enthalten wie &lt; enthalten, wird dies nicht mehr in &amp;lt; übersetzt. R-Skripte oder Bash Skripte sollten nun wieder korrekt generiert werden</li>
                                    <li>Generierte Antworten mit Codeblöcken in Markdown: Falls keine Sprache im zurückgegebenen Codeblock definiert war und dieser sehr lange Zeilen enthalten hat, gab es keinen Zeilenumbruch</li>
                                    <li>Falls die Authentifizierungsinformationen ausgelaufen sind (Fenster zu lange offen ohne Interaktion), wird die Seite neu geladen.</li>
                                </ul>
                                <h3>{t('version.changed')}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion >
            </div>
        </div >
    );
};

export default Version;
