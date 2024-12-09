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
        value: `Stell dir vor, es ist schlechtes Wetter und du sitzt lustlos im Büro. Alle möglichen Leute wollen etwas von Dir und Du spürst eine Stimmung, als ob irgendeine Kleinigkeit gleich eskalieren wird. Schreibe mir etwas, das dir in dieser Situation gut tut und dich aufmuntert.`
    },
    {
        text: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?",
        value: "Motiviere, warum eine öffentliche Verwaltung Robot Process Automation nutzen sollte und warum nicht?"
    }
];

interface Props {
    onExampleClicked: (value: string, system?: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {
    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList} aria-description={t("common.examples")}>
            {EXAMPLES.map((x, i) => (
                <li key={i} tabIndex={0}>
                    <Example
                        text={x.text}
                        system={x.system}
                        value={x.value}
                        onClick={onExampleClicked}
                        ariaLabel={t("components.example.label") + " " + (i + 1).toString()}
                    />
                </li>
            ))}
        </ul>
    );
};
