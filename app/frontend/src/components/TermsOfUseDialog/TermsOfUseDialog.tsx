import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
} from "@fluentui/react-components";
import { Checkmark24Filled } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';

import styles from "./TermsOfUseDialog.module.css";

export const TermsOfUseDialog = () => {
  const { t} = useTranslation ();
  return (
    <div>
        <Dialog modalType="alert" defaultOpen={true}>
        <DialogTrigger disableButtonEnhancement>
            <Button>{t('header.nutzungsbedingungen')}</Button>
        </DialogTrigger>
        <DialogSurface className={styles.dialog}>
            <DialogBody  className={styles.dialogContent} >
            <DialogTitle >{t('header.nutzungsbedingungen')}</DialogTitle>
            <DialogContent>
                <ul>
                    <li>
                    Keine Nutzung für Daten mit LHM-Schutzbedarf "hoch" oder "sehr hoch" oder mit der Klassifizierung "vertraulich" oder "streng vertraulich". Generell dürfen alle für Microsoft Azure zugelassenen Daten verarbeitet werden.
                    </li>
                    <li>
                    Einsatz nur für interne, betriebliche Tätigkeiten.
                    </li>
                    <li>
                    KI-generierte Inhalte dürfen nicht extern veröffentlicht werden. KI-generierte Inhalte müssen bei interner unveränderter Nutzung als solche gekennzeichnet werden.
                    </li>
                    <li>
                    Achtung: MUCGPT ist darauf trainiert immer zu antworten, auch wenn es die Antwort nicht kennt.
                    Dementsprechend entstehen sogenannte Halluzinationen. In jedem Anwendungsfall sind die Ergebnisse vor dem Einsatz manuell auf Korrektheit und Angemessenheit im LHM-Kontext zu überprüfen.
                    </li>
                    <li>
                    Die Verantwortung für die Ergebnisse trägt bei der Weiterverwendung die/der MUCGPT Nutzer*in. KI-generierte Inhalte dürfen in keinem Fall zu einer automatisierten Entscheidungsfindung genutzt werden.
                    </li>
                    <li>
                    Bei technischen Fehlern oder moralischem Fehlverhalten der KI wendet euch bitte an itm.innolab@muenchen.de.
                    </li>
                </ul>
            </DialogContent>
            <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary" size="small">
                <Checkmark24Filled className={styles.checkIcon} />Zustimmen</Button>
                </DialogTrigger>
            </DialogActions>
            </DialogBody>
        </DialogSurface>
        </Dialog>
    </div>
  );
};