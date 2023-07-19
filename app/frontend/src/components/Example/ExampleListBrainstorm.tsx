import { Example } from "./Example";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: "advantages of birds over crocodiles ",
        value: "advantages of birds over crocodiles"
    },
    {
        text: "warum man in münchen wohnen sollte",
        value: "warum man in münchen wohnen sollte"
    }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleListBrainstorm = ({ onExampleClicked }: Props) => {
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
