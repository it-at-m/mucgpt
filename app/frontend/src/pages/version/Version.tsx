import styles from "./Version.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
import vorgeschlageneAntworten from "../../assets/vorgeschlagene_antworten.png";
import zurückziehen from "../../assets/zurückziehen.png";
import history from "../../assets/History.png";
import simply from "../../assets/simply.png";
import latex from "../../assets/latex.png";
import { useTranslation } from "react-i18next";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";

const Version = () => {
    const { t } = useTranslation();
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

            <div className={styles.versionRoot}>
                <h1 className={styles.header}>{t("version.header")}</h1>
                <Accordion multiple collapsible defaultOpenItems="14">
                    <AccordionItem value="14">
                        <AccordionHeader>[1.2.5] 24.04.2025</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Fehler beim Einstellen der Tokenanzahl im Assistentenchat gefixt.</li>
                                    <li>Fehler mit "Nachricht zurückrufen" und "Nachricht neu generieren" der ersten Nachricht gefixt.</li>
                                    <li>Fehler beim Darstellen des Generierens einer Nachricht wurde behoben.</li>
                                    <li>Mathematische Formeln werden nun mit LaTeX korrekt gerendert.
                                        <p>
                                            <img width="50%" src={latex} alt="Bild von mathematischen Formeln in MUCGPT"></img>
                                        </p>
                                    </li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        Der Prompt für <i>einfache Sprache</i> wurde an neue Guidelines angepasst.
                                    </li>
                                    <li>
                                        Allgemeine Verbesserungen der Benutzeroberfläche und des Quellcodes.
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="13">
                        <AccordionHeader>[1.2.4] 4.03.2025</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    Community Assistenten:
                                    <ul>
                                        <li>Community-Assistenten können nun eigene Beispiele und vorgeschlagene Antworten haben.</li>
                                        <li>
                                            Neue Versionen von Community-Assistenten
                                            <ul>
                                                <li>Sherlock🕵Testfallgenerator: Erstellt und exportiert Tesftälle. Von itm.km73</li>
                                                <li>Consultor: Berät zum Angebot von consult.in.M. Von consult.in.M </li>
                                                <li>🧜Arielle: Erstellt Mermaid Diagramme</li>
                                            </ul>
                                        </li>

                                        <li>Community-Assistenten können zentral konfiguriert werden und es wird stets die neueste Version verwendet</li>
                                    </ul>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Performanceprobleme bei langen Chats (mehr als 20k Tokens). </li>
                                    <li>
                                        Wird ein Prompt als gefährlich identifziert, wird nun nur noch "Es wurde ein Richtlinienverstoß festgestellt und der
                                        Chat wird hier beendet" zurückgegeben.{" "}
                                    </li>
                                    <li>Code-Blöcke passen sich nun an die Schriftgröße an.</li>
                                    <li>"Einstellungen & Feedback"-Button bleiben jetzt im Header beim Vergrößern der Schriftgröße.</li>
                                    <li>Version & FAQ: Stil angepasst sowie Rechtschreib- und Grammatikfehler korrigiert.</li>
                                    <li>
                                        Token-Nutzung:
                                        <ul>
                                            <li>Anzeigeproblem beim Neuladen behoben.</li>
                                            <li>
                                                Token-Usage aus den Features <i>Zusammenfassen</i> und <i>Brainstorming</i> entfernt.
                                            </li>
                                            <li>
                                                Wenn keine Tokens verwendet werden, wird die Token-Usage nicht angezeigt, um eine übersichtlichere Oberfläche zu
                                                bieten.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>Zahlreiche Rechtschreib- und Grammatikfehler wurden korrigiert.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        Einfache Sprache:
                                        <ul>
                                            <li>
                                                <i>Leichte Sprache</i> wurde entfernt, da wir keine vollständige Übersetzung in leichte Sprache durchführen
                                                können und der Name deswegen irreführend ist.
                                            </li>
                                            <li>
                                                Der Prompt für <i>einfache Sprache</i> wurde angepasst und erweitert.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Eigene Assistenten:
                                        <ul>
                                            <li>
                                                Einstellungen wie <i>System-Prompt</i> oder <i>Maximale Token-Anzahl</i> werden nur beim Bearbeiten angezeigt.
                                            </li>
                                            <li>Beim Bearbeiten eines Assistenten verbreitert sich die Einstellungs-Sidebar.</li>
                                            <li>Community-Assistenten sind Read-Only und können von den Benutzern nicht verändert werden.</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="12">
                        <AccordionHeader>[1.2.3] 30.01.2025</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Neuer Community-Assistent Sherlock 🕵️‍♂️. Unterstützt beim Review und der Erstellung von Testfällen. Entwickelt von
                                        itm.km73.
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>
                                        Brainstorming:
                                        <ul>
                                            <li>Mindmaps werden nun im dunklen Design richtig dargestellt.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        Einfache Sprache:
                                        <ul>
                                            <li>
                                                Links werden nun beim Übersetzen in einfache Sprache ignoriert. Dies hatte zuvor zu Halluzinationen geführt.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Es ist nun möglich, partielle Codeblöcke in Chrome zu kopieren. Dies hatte zuvor zu Zeilenumbrüchen nach jedem Wort
                                        geführt.
                                    </li>
                                    <li>Ein Fehler bei der Kommunikation mit Mistral-Modellen über die API wurde behoben.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        Brainstorming:
                                        <ul>
                                            <li>
                                                Mindmap-Erstellung wurde verbessert. Mehr Kindknoten werden generiert, was zu größeren, detaillierteren Mindmaps
                                                führt.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Assistenten:
                                        <ul>
                                            <li>
                                                Assistenten können nun mehrere Chatverläufe haben. Ähnlich wie bei der Chatfunktion kann ein Chatverlauf
                                                umbenannt und favorisiert werden. Die Daten werden ausschließlich lokal im Browser gespeichert.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Einfache Sprache:
                                        <ul>
                                            <li>
                                                Der Titel des <i>leichte Sprache</i> Beispiels wurde umbenannt. Es handelt sich hierbei richtigerweise um einen
                                                Artikel zum Arbeitsschutzgesetz.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Generelle Oberflächenverbesserungen:
                                        <ul>
                                            <li>
                                                Jede Funktion (z.B. Chat, Zusammenfassen) hat nun die Aktionselemente in einer immer geöffneten Sidebar auf der
                                                linken Seite.
                                            </li>
                                            <li>
                                                Das lokale Speichermanagement in der Browserdatenbank wurde verbessert und vereinheitlicht. Bestehende Daten
                                                (alte Chats und Assistenten) werden migriert. ⚠ Konversationen in <i>Zusammenfassen</i>, <i>Brainstorming</i>{" "}
                                                und <i>Einfache Sprache</i> bleiben nicht erhalten.
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="11">
                        <AccordionHeader>[1.2.2] 07.11.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Es besteht nun die Möglichkeit, eigene Assistenten zu erstellen. Diese Funktion ermöglicht es den Benutzern, für
                                        wiederkehrende Aufgaben spezialisierte Assistenten zu entwickeln, die mit einem Systemprompt ausgestattet sind.
                                        <ul>
                                            Beispiele für Assistenten sind:
                                            <li>Englisch-Übersetzer: Übersetzt alle Eingaben ins Englische.</li>
                                            <li>Testgenerator: Erstellt hilfreiche Testfälle basierend auf dem eingegebenen Programmcode.</li>
                                            <li>Lektor: Korrigiert eingegebene Texte und schlägt alternative Formulierungen vor.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        Um einen Assistenten zu erstellen, beschreibt der Benutzer die gewünschte Funktion in einem Textfeld. MUCGPT generiert
                                        daraufhin einen passenden Titel, eine Beschreibung und einen Systemprompt, die anschließend weiter angepasst werden
                                        können.
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Verschiedene Fehler im Frontend wurden behoben.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>Das Design der Benutzeroberfläche von MUCGPT wurde aktualisiert.</li>
                                    <li>🧜‍♀️ Arielle, die Diagramm-Assistentin, ist jetzt unter "Community Assistenten" zu finden und nicht mehr im Chat.</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="10">
                        <AccordionHeader>[1.2.1] 27.09.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Neben den Funktionen Chat, Zusammenfassen und Brainstorming bieten wir nun als viertes Feature "Leichte Sprache" an.
                                        <p>
                                            <img width="70%" src={simply} alt="Bild zur Leichten Sprache"></img>
                                        </p>
                                        <ul>
                                            <li>
                                                Über einen Chat können Texte an das Sprachmodell gesendet werden, die in leichte oder einfache Sprache übersetzt
                                                werden.
                                            </li>
                                            <li>Oben rechts können Sie auswählen, ob der Text in leichte oder einfache Sprache übersetzt werden soll.</li>
                                            <li>
                                                Einfache Sprache ist eine vereinfachte Form der Standardsprache, die auf Komplexität verzichtet, um eine
                                                breitere Zielgruppe zu erreichen.
                                            </li>
                                            <li>
                                                Leichte Sprache verwendet einfache Wörter und kurze Sätze, um Informationen klar und verständlich zu vermitteln.
                                            </li>
                                            <li>
                                                Das Feature "Leichte Sprache" nutzt dasselbe Sprachmodell wie die anderen Features, das über die Einstellungen
                                                ausgewählt wird. Wir empfehlen jedoch für die Nutzung von "Leichte Sprache" die Modelle{" "}
                                                <strong>mistral-large-2407</strong> oder <strong>gpt-4o</strong> zu verwenden.
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>
                                        Benutzer, die sich noch nicht in ServiceNow für MUCGPT registriert haben, werden beim Aufrufen des Dienstes automatisch
                                        zu ServiceNow weitergeleitet.
                                    </li>
                                    <li>Die Performance bei längeren Chats mit einer hohen Anzahl an generierten Tokens wurde optimiert.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="9">
                        <AccordionHeader>[1.2.0] 18.09.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Generierter Code wurde manchmal nicht korrekt dargestellt (Klammern entfernt).</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="8">
                        <AccordionHeader>[1.1.4] 11.09.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Versionsnummer wird wieder richtig gespeichert und in den Einstellungen angezeigt.</li>
                                    <li>
                                        Maximale Tokens aus der Config aufgeteilt in Input- und Output-Tokens. Dadurch laufen Modelle mit kleineren
                                        Kontextfenstern (wie z.B. Mistral) nicht mehr in einen Fehler.
                                    </li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="7">
                        <AccordionHeader>[1.1.3] 28.08.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Benutzer haben nun die Möglichkeit, zwischen 3 verschiedenen Sprachmodellen zu wählen, welches für ihren Anwendungsfall
                                        am besten passt.
                                        <ul>
                                            <li>GPT-4o-mini</li>
                                            <li>GPT-4o</li>
                                            <li>Mistral-Large-2407</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>Das standardmäßig benutzte Sprachmodell wurde von GPT-3.5 auf die neuere Version GPT-4o-mini geändert.</li>
                                    <li>
                                        Verbesserung der "Zusammenfassen"-Funktion:
                                        <ul>
                                            <li>Weniger Fehler</li>
                                            <li>Zuverlässigere Zusammenfassungen in der gewünschten Struktur</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="6">
                        <AccordionHeader>[1.1.2] 31.07.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Für die Chat-Funktion gibt es nun eine Historie aller durchgeführten Konversationen.
                                        <p>
                                            <img width="70%" src={history}></img>
                                        </p>
                                        <ul>
                                            <li>Alle Chat-Verläufe im Tab "Chat" werden automatisch gespeichert.</li>
                                            <li>Chats können im "Historie"-Fenster gelöscht, umbenannt oder favorisiert werden.</li>
                                            <li>Favorisierte Chats werden immer ganz oben angezeigt.</li>
                                            <li>
                                                Die Chats werden nach dem letzten Bearbeitungszeitpunkt sortiert und gruppiert in "Heute", "Gestern", "Letzte 7
                                                Tage" und "Älter".
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="5">
                        <AccordionHeader>[1.1.1] 04.06.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>Neuer Hinweis im Antwortfeld vom Chat: MUCGPT macht Fehler.</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Der Hilfstext für den Systemprompt ist nicht mehr transparent.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>Die Beschreibung des Arielle-Chat-Beispiels wurde verbessert.</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="1">
                        <AccordionHeader>[1.1.0] 22.05.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Chat/Zusammenfassen/Brainstorming:
                                        <ul>
                                            <li>
                                                Eigene Nachrichten können zurückgenommen werden. Beim Klicken des entsprechenden Buttons werden alle darunter
                                                liegenden Nachrichten und die ausgewählte Nachricht gelöscht. In das Eingabefeld wird die ausgewählte Nachricht
                                                eingefügt und kann abgeändert werden:
                                                <p>
                                                    <img width="70%" src={zurückziehen}></img>
                                                </p>
                                            </li>
                                            <li>
                                                Der aktuelle Chatverlauf wird im Browser zwischengespeichert und bleibt somit beim Verlassen der Seite bestehen.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>Was gibt's Neues?: Updatehistorie kann angezeigt werden.</li>
                                    <li>
                                        Chat:
                                        <ul>
                                            <li>
                                                <div>
                                                    Auf eine Antwort von MUCGPT werden nun <b>Antwortmöglichkeiten</b> vorgeschlagen. Beim Auswählen einer
                                                    Antwortmöglichkeit wird ein entsprechender Prompt in das Eingabefeld geladen:
                                                </div>
                                                <p>
                                                    <img width="80%" src={vorgeschlageneAntworten}></img>
                                                </p>
                                            </li>
                                            <li>
                                                <b>Mermaid-Diagramme</b> können im Chat angezeigt und heruntergeladen werden.
                                            </li>
                                            <li>
                                                Es gibt Arielle, die Diagramm-Assistentin. Diese begleitet den Nutzer beim Erstellen von Mermaid-Diagrammen.
                                            </li>
                                            <li>Mehr Platz für die Eingabe des Systemprompts.</li>
                                            <li>Warnmeldung wird angezeigt, falls ein Systemprompt gesetzt ist.</li>
                                            <li>Bessere Beschreibungen für die Temperatureinstellung.</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Der Systemprompt wird nun ins Tokenlimit miteinbezogen.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2">
                        <AccordionHeader>[1.0.0] 26.02.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>Produktivumgebung aufgebaut.</li>
                                    <li>FAQ wurde ergänzt.</li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Fehlermeldungen anzeigen, falls das Sprachmodell während des Streamings überlastet ist.</li>
                                    <li>Rechtschreibfehler in Hilfetexten verbessert.</li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>Nutzungsbedingungen müssen nun einmal am Tag bestätigt werden.</li>
                                    <li>Nutzungsbedingungen wurden ergänzt.</li>
                                    <li>Hinweis auf Servicedesk.</li>
                                    <li>Link zum Wilma-Arbeitsraum.</li>
                                </ul>
                                <li>Chat-Beispiele von der Community wurden eingepflegt.</li>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="3">
                        <AccordionHeader>[0.3.0] 06.02.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>Bereits getätigte Einstellungen werden gespeichert (z.B. Sprache, Systemprompt, Nutzungsbedingungen gelesen).</li>
                                    <li>
                                        Barrierefreiheit:
                                        <ul>
                                            <li>Optimierte Darstellung für Screenreader.</li>
                                            <li>Bessere Unterscheidbarkeit für Farbenblinde.</li>
                                            <li>Unterstützung von Windows High Contrast Mode.</li>
                                            <li>Und noch viele weitere Optimierungen ...</li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>
                                        Als Code (mit Single-Backticks, ` ) formatierte Wörter in Antworten werden nun nicht mehr als Codeblock dargestellt, da
                                        dies zu sehr den Lesefluss gestört hat.
                                    </li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                                <ul>
                                    <li>
                                        Brainstorm:
                                        <ul>
                                            <li>
                                                Mindmaps sind nun im .mm-Format herunterladbar und können mit dem Mindmap-Tool Freeplane weiterverarbeitet
                                                werden.
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        Zusammenfassen:
                                        <ul>
                                            <li>
                                                Die Länge der Zusammenfassung hängt nun von der Gesamtlänge des Eingabetexts ab - längere Eingabetexte führen zu
                                                längeren Zusammenfassungen.
                                            </li>
                                            <li>Der Detaillierungsgrad (kurz, mittel, lang) lässt sich über eine eigene Einstellung setzen.</li>
                                        </ul>
                                    </li>
                                    <li>Design vereinheitlicht.</li>
                                    <li>Dark Mode hinzugefügt.</li>
                                    <li>Nutzungsbedingungen aktualisiert.</li>
                                </ul>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="4">
                        <AccordionHeader>[0.3.0] 06.02.2024</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                ❄Neujahrsupdate❄
                                <h3>{t("version.added")}</h3>
                                <ul>
                                    <li>
                                        Bessere Darstellung von Antworten, die Markdown enthalten:
                                        <ul>
                                            <li>Bei Codeblöcken wird die Programmiersprache mit angezeigt.</li>
                                            <li>Bei Codeblöcken werden die Zeilennummern mit angegeben.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        Zusammenfassen:
                                        <ul>
                                            <li>Zusammenfassungen können kopiert werden.</li>
                                            <li>Tokenlimit (Wörterlimit) wurde entfernt.</li>
                                            <li>Es können PDFs hochgeladen werden, die anschließend zusammengefasst werden.</li>
                                        </ul>
                                    </li>
                                    <li>
                                        Chat:
                                        <ul>
                                            <li>
                                                Antworten können nun optional unformatiert angezeigt werden (Alternative zur automatischen Darstellung als
                                                HTML/Markdown).
                                            </li>
                                            <li>
                                                Mehr Einstellungen für den Chat:
                                                <ul>
                                                    <li>Temperatur: Kreativität der Antworten festlegen.</li>
                                                    <li>Maximale Antwortlänge.</li>
                                                    <li>Systemprompt: Verhalten des Sprachmodells festlegen, indem man z.B. eine bestimmte Rolle vergibt.</li>
                                                </ul>
                                            </li>
                                        </ul>
                                    </li>
                                </ul>
                                <h3>{t("version.fixed")}</h3>
                                <ul>
                                    <li>Bei längeren Eingaben ist das Eingabetextfeld nicht mitgewachsen.</li>
                                    <li>
                                        Falls Antworten HTML enthalten wie &lt;, wird dies nicht mehr in &amp;lt; übersetzt. R-Skripte oder Bash Skripte sollten
                                        nun wieder korrekt generiert werden.
                                    </li>
                                    <li>
                                        Generierte Antworten mit Codeblöcken in Markdown: Falls keine Sprache im zurückgegebenen Codeblock definiert war und
                                        dieser sehr lange Zeilen enthalten hat, gab es keinen Zeilenumbruch.
                                    </li>
                                    <li>
                                        Falls die Authentifizierungsinformationen ausgelaufen sind (Fenster zu lange offen ohne Interaktion), wird die Seite neu
                                        geladen.
                                    </li>
                                </ul>
                                <h3>{t("version.changed")}</h3>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Version;
