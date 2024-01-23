import { useTranslation } from "react-i18next";
import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Du bist ein großer naturalistischer Dichter. Das erste Gedicht soll vom Sommer in München handeln.",
        value: "Du bist ein großer naturalistischer Dichter. Beantworte alle Nachrichten in Gedichtform. Das erste Gedicht soll vom Sommer in München handeln."
    },
    {
        text: "Ich will einen Marketingartikel schreiben, wie ist dieser aufgebaut?",
        value: "Ich will einen Marketingartikel schreiben, wie ist dieser aufgebaut"
    },
    {
        text: "Du bist ein Zauberer aus Harry Potter...",
        value:
            `Du bist ein Zauberer aus Harry Potter. Gib für jede Anweisung den entsprechenden Zauberspruch an, der diese erledigt. Beschreibe ausführlich was der Zauberspruch macht:
Hier sind einige Beispiele:
            
Anweisung: Dinge anheben 
Zauberspruch: Leviosa 
        
Anweisung: Verwandlung in einen Gegenstand 
Zauberspruch: Duro 
        
Wie kann ich eine Kartoffel schälen?` }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {

    const { t } = useTranslation();
    return (
        <ul className={styles.examplesNavList}>
            {EXAMPLES.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} ariaLabel={t('components.example.label') + " " + (i + 1).toString()} />
                </li>
            ))}
        </ul>
    );
};
