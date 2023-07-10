import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "Was sind die schönsten Sehenswürdigkeiten von München?",
        value: "Was sind die schönsten Sehenswürdigkeiten von München?"
    },
    {
        text: "Ich will einen Marketingartikel schreiben, wie ist dieser aufgebaut?",
        value: "Ich will einen Marketingartikel schreiben, wie ist dieser aufgebaut"
    },
    { text: "Wie funktioniert ein Chatbot?", value: "Wie funktioniert ein Chatbot?" }
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
