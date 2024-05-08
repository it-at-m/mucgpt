import { useTranslation } from "react-i18next";
import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
    system?: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Du bist König Ludwig II. von Bayern. Schreibe einen Brief an alle Mitarbeiter*innen der Stadtverwaltung München.",
        value: "Du bist König Ludwig II. von Bayern. Schreibe einen Brief an alle Mitarbeiter*innen der Stadtverwaltung München, indem Du Dich für die tolle Leistung bedankst und den Bau eines neuen Schlosses (noch beeindruckender als Neuschwanstein) in der Stadt München wünschst."
    },
    {
        text: "Stell dir vor, es ist schlechtes Wetter.",
        value:
            `Stell dir vor, es ist schlechtes Wetter und du sitzt lustlos im Büro. Alle möglichen Leute wollen etwas von Dir und Du spürst eine Stimmung, als ob irgendeine Kleinigkeit gleich eskalieren wird. Schreibe mir etwas, das dir in dieser Situation gut tut und dich aufmuntert.`
    },
    {
        text: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?",
        value: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?"
    },
    {
        text: "Arielle, die Diagramm-Assistentin. [Mittels System-Prompt, muss gelöscht werden für andere Aufgaben]",
        value: "Hallo",
        system: `Du bist Arielle, ein Assistent für das Erstellen von Mermaid Diagrammen. Du hilfst dem Nutzer dabei syntaktisch korrekte Mermaid Diagramme zu erstellen.

        Gehe in folgenden Schritten vor, jeder Schritt ist eine eigene Nachricht.
        1. Stelle dich kurz freundlich vor und frag den Nutzer nach dem Thema des Diagramms und der Art des Diagramms?
        2. Frage den Nutzer nach den Daten, die dargestellt werden sollen?
        3. Gib den Mermaid-Code für das entsprechende Mermaid Diagramm zurück:
        
        Halte unbedingt folgende Regeln bei Schritt 3 ein:
        - Antworte dabei ausschließlich in Markdown- Codeblöcken in Mermaid Syntax
        - Beschrifte die Knoten der Diagramme passend
        - Verwende ausschließlich die Daten aus Schritt 1 und 2
        
        
        Starte mit Schritt 1.
        `
    }
];

interface Props {
    onExampleClicked: (value: string, system?: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {

    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList} aria-description={t('common.examples')}>
            {EXAMPLES.map((x, i) => (
                <li key={i} tabIndex={0}>
                    <Example text={x.text} system={x.system} value={x.value} onClick={onExampleClicked} ariaLabel={t('components.example.label') + " " + (i + 1).toString()} />
                </li>
            ))}
        </ul>
    );
};
