import styles from "./Version.module.css";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, Button, Tooltip } from "@fluentui/react-components";
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
                <Accordion multiple collapsible defaultOpenItems="2.0.2">
                    <AccordionItem value="2.0.21">
                        <AccordionHeader>Änderung der Kennzeichnungsplicht</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <p>
                                    <strong>Nutzungsbedingungen:</strong> Wenn die Ergebnisse von einer Person überprüft wurden, müssen sie nicht gekennzeichnet
                                    werden. Weitere Informationen finden Sie im Abschnitt <i>Weiterverwendung der Ergebnisse</i> der Nutzungsbedingungen.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2.0.2">
                        <AccordionHeader>[2.0.2]</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h2>Version 2.0.2</h2>

                                <h3>Modelle</h3>
                                <p>
                                    <strong>gpt-5.6 luna</strong> und <strong>gpt-5.6 terra</strong> sind nun verfügbar.
                                </p>

                                <h3>Oberfläche</h3>
                                <p>
                                    <strong>Modelpicker:</strong> Der Modelpicker wurde in das Prompt-Input integriert und vereinfacht.
                                </p>
                                <p>
                                    <strong>Teilen:</strong> Assistenten können nun auch über einen Link bzw. durch Klicken auf einen Button geteilt werden.
                                </p>
                                <p>
                                    <strong>Design:</strong> Weitere Vereinheitlichung des Designs für die Sidebar (Chats), die Discovery-Seite und die
                                    Assistenten-Detail-Sidebar.
                                </p>
                                <p>
                                    <strong>Animation:</strong> Die Animation während das Sprachmodell nachdenkt, bis die erste Antwort kommt, wurde geändert.
                                </p>
                                <p>
                                    <strong>Admins:</strong> Assistenten können nun von Admins als "empfohlen" gekennzeichnet werden.
                                </p>

                                <h3>Fehlerbehebungen</h3>
                                <p>
                                    <strong>Prompt-Input:</strong> Das Prompt-Input wächst nun korrekt und springt nicht mehr ständig hin und her, wenn man
                                    mehrere Zeilen eingibt.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="2.0.1">
                        <AccordionHeader>[2.0.1]</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h2>Version 2.0.1</h2>

                                <h3>Neu</h3>
                                <p>
                                    <strong>Live-Preview:</strong> Beim Bearbeiten eines Assistenten wird nun eine Vorschau angezeigt, wie der fertige Assistent
                                    aussieht.
                                </p>
                                <p>
                                    <strong>Zwischenspeichern:</strong> Der Bearbeitungsstand eines Assistenten wird automatisch zwischengespeichert und bleibt
                                    dadurch auch nach einer abgelaufenen Sitzung oder beim Wechsel auf eine andere Seite erhalten.
                                </p>

                                <h3>Redesign</h3>
                                <p>
                                    <strong>Minimalistischer:</strong> Chat-Nachrichten, Folge-Aktionen und Startvorschläge sind jetzt übersichtlicher und
                                    minimalistischer gestaltet.
                                </p>

                                <h3>Änderungen</h3>
                                <p>
                                    <strong>Detailansicht:</strong> In der Detailansicht eines Assistenten werden nun mehr Informationen in der Seitenleiste
                                    angezeigt.
                                </p>
                                <p>
                                    <strong>Besitzer-Ansicht:</strong> Besitzer von Assistenten können sich die Details zu ihrem Assistenten in einer
                                    Seitenleiste anschauen, ohne diesen bearbeiten zu müssen.
                                </p>
                                <p>
                                    <strong>Eingabefenster:</strong> Die Auslastung des Kontextfensters des Sprachmodells und eine Kostenschätzung werden nun im
                                    Eingabefenster angezeigt.
                                </p>
                                <p>
                                    <strong>Assistenten:</strong> "Standard-Modell" wurde in "Festgelegtes Modell" umbenannt.
                                </p>
                                <p>
                                    <strong>Best Practice:</strong> Der Abschnitt wurde aus dem Nutzungsdialog entfernt.
                                </p>

                                <h3>Fehlerbehebungen</h3>
                                <p>
                                    <strong>Sitzungsdauer:</strong> Die Sitzungsdauer wurde auf 10 Stunden verlängert. Dies sollte häufiges neu laden der
                                    Anwendung verhindern.
                                </p>
                                <p>
                                    <strong>Update-Meldung:</strong> Beim Update eines Assistenten kam es zu einer fehlerhaften Meldung, dass das Update
                                    fehlschlägt. Dies tritt nicht mehr auf.
                                </p>
                                <p>
                                    <strong>Abonnenten-Anzeige:</strong> Die Anzahl der Abonnenten bei abonnierten Assistenten wird nun korrekt angezeigt.
                                </p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem value="15">
                        <AccordionHeader>{t("versions.v2_0.date")}</AccordionHeader>
                        <AccordionPanel>
                            <div className={styles.panel}>
                                <h2>{t("versions.v2_0.title")}</h2>

                                <h3>{t("versions.v2_0.newInterface.title")}</h3>
                                <p>{t("versions.v2_0.newInterface.paragraph1")}</p>
                                <p>{t("versions.v2_0.newInterface.paragraph2")}</p>

                                <h3>{t("versions.v2_0.shareableAssistants.title")}</h3>
                                <p>{t("versions.v2_0.shareableAssistants.paragraph1")}</p>
                                <p>{t("versions.v2_0.shareableAssistants.paragraph2")}</p>

                                <h3>{t("versions.v2_0.interfacesFoundation.title")}</h3>
                                <p>{t("versions.v2_0.interfacesFoundation.paragraph1")}</p>
                                <p>{t("versions.v2_0.interfacesFoundation.paragraph2")}</p>
                            </div>
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
};

export default Version;
