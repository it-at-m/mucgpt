import { Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Button, Link, Tooltip } from "@fluentui/react-components";
import { Checkmark24Filled, DocumentBulletListMultiple24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import styles from "./TermsOfUseDialog.module.css";

interface TermsOfUseDialogProps {
    defaultOpen: boolean;
    onAccept: () => void;
}

export const TermsOfUseDialog = ({ defaultOpen, onAccept }: TermsOfUseDialogProps) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState<boolean>(defaultOpen);

    return (
        <div className={styles.container}>
            <Dialog modalType="alert" open={open} onOpenChange={(_event, data) => setOpen(data.open)}>
                <DialogTrigger disableButtonEnhancement>
                    <Tooltip content={t("components.terms_of_use.tooltip", "Nutzungsbedingungen anzeigen")} relationship="description" positioning="above">
                        <div className={styles.triggerContainer}>
                            <DocumentBulletListMultiple24Regular className={styles.termsIcon} />
                            <span className={styles.termsText}>{t("components.terms_of_use.label", "Nutzungsbedingungen")}</span>
                        </div>
                    </Tooltip>
                </DialogTrigger>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle>Nutzungsbedingungen (Zustimmung erforderlich)</DialogTitle>
                        <DialogContent>
                            <ul>
                                <li>
                                    <strong>Zielgruppe:</strong> MUCGPT darf von allen städtischen Mitarbeiter*innen und von allen Personen mit einem
                                    München-Account (muenchen.de Email-Adresse) verwendet werden.
                                </li>
                                <li>
                                    <strong>Erlaubte Nutzung:</strong> MUCGPT darf nur im dienstlichen Kontext genutzt werden. Die Nutzung vergleichbarer
                                    kommerzieller KI-Produkte (z.B. ChatGPT, Gemini etc.) ist nur mit öffentlichen Daten erlaubt.{" "}
                                </li>
                                <li>
                                    <strong>Informationssicherheit und Datenschutz</strong> Bei der Nutzung von MUCGPT dürfen keine personenbezogenen Daten
                                    (z.B. Name, Anschrift, E-Mail-Adressen etc.) oder als vertraulich klassifizierte Daten (siehe{" "}
                                    <Link
                                        inline
                                        href="https://wilma.muenchen.de/pages/informationssicherheit/apps/wiki/regelwerk-aktuell/list/view/0b6737b2-9712-4fba-9fd3-a86f9daf98c5"
                                    >
                                        Regelwerk Informationssicherheit
                                    </Link>
                                    ) eingegeben werden.
                                </li>
                                <li>
                                    <strong>Überprüfung der Ergebnisse</strong> Die generierten Informationen bzw. Ergebnisse müssen stets auf inhaltliche
                                    Richtigkeit, Angemessenheit und Aktualität überprüft und bei Bedarf angepasst werden. Es kann vorkommen, dass aufgrund einer
                                    älteren Datenbasis, MUCGPT veraltete Ergebnisse liefert. Für die inhaltliche Richtigkeit ist immer der MUCGPT-Nutzende
                                    verantwortlich.
                                </li>
                                <li>
                                    <strong>Weiterverwendung der Ergebnisse:</strong> Die Verantwortung für die Weiterverwendung der Ergebnisse trägt die/der
                                    MUCGPT Nutzer*in. Die Ergebnisse müssen als solche sowohl für intern, als auch für extern gekennzeichnet (z.B.: „Quelle:
                                    MUCGPT“) werden. Siehe Details und weitere Zitierstile hierzu in den{" "}
                                    <Link inline href={import.meta.env.BASE_URL + "#/faq"}>
                                        FAQs
                                    </Link>
                                    .
                                </li>
                                <li>
                                    <strong>Entscheidungsfindung:</strong> MUCGPT darf nicht für abschließende Entscheidungen verwendet werden, die gegenüber
                                    Personen rechtliche Wirkung entfalten oder sie in ähnlicher Weise erheblich beeinträchtigen (Art. 22 Abs. 1 DSGVO).
                                    Derartige Entscheidungen müssen stets von Menschen getroffen werden.
                                </li>
                                <li>
                                    <strong>Nachhaltigkeit/GreenIT</strong> Bitte denken Sie daran, dass bei der Nutzung von MUCGPT jede Anfrage Rechenleistung
                                    benötigt. Für Suchanfragen im Internet empfehlen wir eine Suchmaschine wie Ecosia/Google oder andere Suchmaschinen zu
                                    verwenden.
                                </li>
                                <li>
                                    <strong>Ansprechpartner*innen:</strong> Bei Fragen und Feedback, sowie zum Melden von unangemessenen Ergebnissen von MUCGPT
                                    bitte an{" "}
                                    <Link inline href="mailto:itm.kicc@muenchen.de?subject=MUCGPT">
                                        {" "}
                                        itm.kicc@muenchen.de
                                    </Link>{" "}
                                    wenden. Technische Fehler bitte an den{" "}
                                    <Link inline href="https://wilma.muenchen.de/pages/it-nutzung-support/apps/content/it-servicedesk-neu">
                                        {" "}
                                        zuständigen Servicedesk
                                    </Link>{" "}
                                    melden
                                </li>
                                <li>
                                    <strong>FAQs:</strong> Weitere Fragen und Antworten (u.a. zu Ziel und Einsatzzwecke von MUCGPT sowie zur Weiterverwendung
                                    der Eingaben und Ergebnisse) geben die{" "}
                                    <Link inline href={import.meta.env.BASE_URL + "#/faq"}>
                                        FAQs
                                    </Link>
                                    .
                                </li>
                                <li>
                                    <strong>Best-Practice Dokumentation/Wissensmanagement:</strong> Erfolgreiche Anwendungsfälle von MUCGPT sollen dokumentiert
                                    werden, um wertvolles Wissen für zukünftige Projekte zu generieren. Tragen Sie diese Beispiele gerne{" "}
                                    <Link inline href="https://wilma.muenchen.de/workspaces/innovationcenter/apps/list/best-practices">
                                        hier
                                    </Link>{" "}
                                    ein.
                                </li>
                            </ul>
                            <div className={styles.responsibleContainer}>
                                Verantwortlich für die Nutzungsbedingungen ist RIT-I (STRAC). Bei Fragen oder Anmerkungen hierzu bitte an folgende E-Mail
                                Adresse wenden:
                                <Link inline href="mailto:it-vorschriften.strac.rit@muenchen.de?subject=MUCGPT">
                                    {" "}
                                    it-vorschriften.strac.rit@muenchen.de
                                </Link>
                            </div>
                        </DialogContent>
                        <DialogActions className={styles.dialogActions}>
                            <DialogTrigger disableButtonEnhancement>
                                <Button
                                    appearance="primary"
                                    size="medium"
                                    onClick={() => {
                                        onAccept();
                                        setOpen(false);
                                    }}
                                    className={styles.acceptButton}
                                >
                                    <Checkmark24Filled className={styles.checkIcon} />
                                    {t("components.terms_of_use.accept", "Zustimmen")}
                                </Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};

export default TermsOfUseDialog;
