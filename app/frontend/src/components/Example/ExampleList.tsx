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
    { text: "Wie funktioniert ein Sprachmodell? Beantworte diese Frage so, dass sie auch ein Grundschüler versteht.", value: "Wie funktioniert ein Sprachmodell? Beantworte diese Frage so, dass sie auch ein Grundschüler versteht." }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {
    return (
        <ul className={styles.examplesNavList}>
            {EXAMPLES.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
