import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Link,
} from "@fluentui/react-components";
import { Checkmark24Filled } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';

import styles from "./TermsOfUseDialog.module.css";

interface Props {
    defaultOpen: boolean;
    onAccept: () => void;
}

export const TermsOfUseDialog = ({ defaultOpen, onAccept }: Props) => {
    const { t } = useTranslation();
    return (
        <div>
            <Dialog modalType="alert" defaultOpen={defaultOpen}>
                <DialogTrigger disableButtonEnhancement>
                    <Button appearance="primary">{t('header.nutzungsbedingungen')}</Button>
                </DialogTrigger>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent} >
                        <DialogTitle >Nutzungsbedingungen (Zustimmung erforderlich)</DialogTitle>
                        <DialogContent>
                            <ul>
                                <li><strong>Zielgruppe:</strong> MUCGPT darf von allen städtischen Mitarbeiter*innen und von allen Personen mit einem München-Account (muenchen.de Email-Adresse) verwendet werden.
                                </li>
                                <li><strong>Erlaubte Nutzung:</strong> MUCGPT darf nur im dienstlichen Kontext genutzt werden. Die Nutzung vergleichbarer kommerzieller KI-Produkte (z.B. ChatGPT, Google Bard etc.) ist nicht erlaubt. </li>
                                <li><strong>Informationssicherheit und Datenschutz</strong> Bei der Nutzung von MUCGPT dürfen keine personenbezogenen Daten (z.B. Name, Anschrift, E-Mail-Adressen etc.) oder als vertraulich klassifizierte Daten (siehe <Link inline href="https://wilma.muenchen.de/pages/informationssicherheit/apps/wiki/regelwerk-aktuell/list/view/0b6737b2-9712-4fba-9fd3-a86f9daf98c5">Regelwerk Informationssicherheit</Link>) eingegeben werden.</li>
                                <li><strong>Überprüfung der Ergebnisse</strong> Die generierten Informationen bzw. Ergebnisse müssen stets auf inhaltliche Richtigkeit, Angemessenheit und Aktualität überprüft und bei Bedarf angepasst werden. Es kann, z.B. aufgrund der älteren Datenbasis (derzeit 2021), vorkommen, dass MUCGPT veraltete Ergebnisse liefert.</li>
                                <li><strong>Weiterverwendung der Ergebnisse:</strong> Die Verantwortung für die Weiterverwendung der Ergebnisse trägt die/der MUCGPT Nutzer*in. Bei unveränderter bzw. nur geringfügig veränderter Nutzung müssen diese als solche gekennzeichnet werden („Quelle: MUCGPT“). Insbesondere, wenn die Inhalte für die externe Kommunikation verwendet werden. Siehe Details hierzu in den <Link inline href="/#faq">FAQs</Link>.</li>
                                <li><strong>Entscheidungsfindung:</strong> MUCGPT darf nicht für abschließende Entscheidungen verwendet werden, die gegenüber Personen rechtliche Wirkung entfalten oder sie in ähnlicher Weise erheblich beeinträchtigen (Art. 22 Abs. 1 DSGVO). Derartige Entscheidungen müssen stets von Menschen getroffen werden.</li>
                                <li><strong>Nachhaltigkeit/GreenIT</strong> Bitte denken Sie daran, dass bei der Nutzung von MUCGPT jede Anfrage Rechenleistung benötigt. Für Suchanfragen im Internet empfehlen wir eine Suchmaschine wie Ecosia/Google oder andere Suchmaschinen zu verwenden.</li>
                                <li><strong>Ansprechpartner*innen:</strong> Bei Fragen und Feedback, sowie zum Melden von technischen Fehlern oder unangemessenen Ergebnissen von MUCGPT bitte an <Link inline href="mailto:itm.kicc@muenchen.de?subject=MUCGPT"> itm.kicc@muenchen.de
                                </Link> wenden.</li>
                                <li><strong>FAQs:</strong> Weitere Fragen und Antworten (u.a. zu Ziel und Einsatzzwecke von MUCGPT sowie zur Weiterverwendung der Eingaben und Ergebnisse) geben die <Link inline href="/#faq">FAQs</Link>.</li>
                                <li><strong>Best-Practice Dokumentation/Wissensmanagement:</strong> Erfolgreiche Anwendungsfälle von MUCGPT sollen dokumentiert werden, um wertvolles Wissen für zukünftige Projekte zu generieren. Tragen Sie diese Beispiele gerne <Link inline href="https://wilma.muenchen.de/workspaces/mucgpt-kuenstliche-intelligenz">hier</Link> ein.</li>
                            </ul>
                            <div className={styles.responsibleContainer} >Verantwortlich für die Nutzungsbedingungen ist RIT-I (STRAC). Bei Fragen oder Anmerkungen hierzu bitte an folgende E-Mail Adresse wenden:
                                <Link inline href="mailto:it-vorschriften.strac.rit@muenchen.de?subject=MUCGPT"> it-vorschriften.strac.rit@muenchen.de</Link></div>
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={(_) => onAccept()}>
                                    <Checkmark24Filled className={styles.checkIcon} />Zustimmen</Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};